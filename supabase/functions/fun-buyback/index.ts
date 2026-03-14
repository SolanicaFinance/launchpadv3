import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet
const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Buyback allocation from claimed fees
const BUYBACK_FEE_SHARE = 0.3; // 30%

// Minimum SOL to execute a buyback (avoid micro-transactions)
const MIN_BUYBACK_SOL = 0.05;

// Jupiter API for swap execution
const JUPITER_API_URL = "https://api.jup.ag";

// Maximum retries for transaction
const MAX_TX_RETRIES = 3;

interface BuybackResult {
  funTokenId: string;
  tokenName: string;
  solSpent: number;
  tokensBought: number | null;
  success: boolean;
  signature?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[fun-buyback] ⏰ Starting automated buyback execution...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get treasury keypair for executing swaps
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryPrivateKey) {
      throw new Error("TREASURY_PRIVATE_KEY not configured");
    }

    // Get the buyback target token mint address
    const buybackTokenMint = Deno.env.get("BUYBACK_TOKEN_MINT");
    if (!buybackTokenMint) {
      console.log("[fun-buyback] ⚠️ BUYBACK_TOKEN_MINT not configured, skipping buybacks");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "BUYBACK_TOKEN_MINT not configured",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Parse treasury keypair
    let treasuryKeypair: Keypair;
    try {
      if (treasuryPrivateKey.startsWith("[")) {
        const keyArray = JSON.parse(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        const decoded = bs58.decode(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(decoded);
      }
    } catch (e) {
      throw new Error("Invalid TREASURY_PRIVATE_KEY format");
    }

    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Check treasury balance first
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / 1e9;
    console.log(`[fun-buyback] Treasury balance: ${treasuryBalanceSol.toFixed(4)} SOL`);

    if (treasuryBalanceSol < MIN_BUYBACK_SOL + 0.01) {
      console.warn("[fun-buyback] ⚠️ Treasury balance too low for buybacks");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Treasury balance too low for buybacks",
          treasuryBalance: treasuryBalanceSol 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 1: Find fee claims that have been distributed to creators but not yet bought back
    // We track buyback execution using the fun_buybacks table
    const { data: completedDistributions, error: distError } = await supabase
      .from("fun_distributions")
      .select(`
        id,
        fun_token_id,
        amount_sol,
        fun_token:fun_tokens(id, name, ticker, image_url, creator_wallet, status)
      `)
      .eq("status", "completed")
      .eq("distribution_type", "creator")
      .order("created_at", { ascending: true });

    if (distError) {
      throw new Error(`Failed to fetch distributions: ${distError.message}`);
    }

    if (!completedDistributions || completedDistributions.length === 0) {
      console.log("[fun-buyback] No completed distributions to process");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending buybacks",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already processed distribution IDs
    const { data: existingBuybacks } = await supabase
      .from("fun_buybacks")
      .select("fun_token_id, amount_sol");

    const processedMap = new Map<string, number>();
    for (const bb of existingBuybacks || []) {
      const existing = processedMap.get(bb.fun_token_id) || 0;
      processedMap.set(bb.fun_token_id, existing + Number(bb.amount_sol || 0));
    }

    // Calculate pending buyback amount per token
    const pendingBuybacks = new Map<string, { token: any; totalCreatorPaid: number; alreadyBoughtBack: number }>();

    for (const dist of completedDistributions) {
      const tokenId = dist.fun_token_id;
      if (!tokenId || !dist.fun_token) continue;

      const existing = pendingBuybacks.get(tokenId);
      const creatorAmount = Number(dist.amount_sol) || 0;
      // Buyback amount should be 30/50 of creator amount (since creator gets 50%, buyback gets 30%)
      // But we'll calculate from total claimed: if creator got X, buyback portion = X * (30/50) = X * 0.6
      // Actually, let's track by total creator paid and derive buyback
      
      if (existing) {
        existing.totalCreatorPaid += creatorAmount;
      } else {
        pendingBuybacks.set(tokenId, {
          token: dist.fun_token,
          totalCreatorPaid: creatorAmount,
          alreadyBoughtBack: processedMap.get(tokenId) || 0
        });
      }
    }

    const results: BuybackResult[] = [];
    let totalBoughtBack = 0;
    let successCount = 0;
    let failureCount = 0;

    // STEP 2: Execute buybacks for each token with pending amounts
    for (const [tokenId, data] of pendingBuybacks.entries()) {
      // Calculate how much we should have bought back
      // Creator share = 50%, Buyback share = 30%
      // If creator was paid X, total claimed was X / 0.5 = 2X
      // Buyback amount should be 2X * 0.3 = X * 0.6
      const expectedBuyback = data.totalCreatorPaid * (BUYBACK_FEE_SHARE / 0.5);
      const pendingBuybackSol = expectedBuyback - data.alreadyBoughtBack;

      if (pendingBuybackSol < MIN_BUYBACK_SOL) {
        console.log(`[fun-buyback] Skipping ${data.token.ticker}: pending buyback ${pendingBuybackSol.toFixed(6)} < ${MIN_BUYBACK_SOL}`);
        continue;
      }

      // Don't spend more than available
      const buybackAmount = Math.min(pendingBuybackSol, treasuryBalanceSol - 0.01);
      if (buybackAmount < MIN_BUYBACK_SOL) {
        console.log(`[fun-buyback] Insufficient funds for ${data.token.ticker}`);
        continue;
      }

      console.log(`[fun-buyback] Executing buyback for ${data.token.ticker}: ${buybackAmount.toFixed(6)} SOL → ${buybackTokenMint}`);

      // STEP 3: Create pending buyback record
      const { data: buybackRecord, error: bbError } = await supabase
        .from("fun_buybacks")
        .insert({
          fun_token_id: tokenId,
          amount_sol: buybackAmount,
          status: "pending",
        })
        .select()
        .single();

      if (bbError) {
        console.error(`[fun-buyback] Failed to create buyback record:`, bbError);
        results.push({
          funTokenId: tokenId,
          tokenName: data.token.name,
          solSpent: buybackAmount,
          tokensBought: null,
          success: false,
          error: `DB error: ${bbError.message}`,
        });
        failureCount++;
        continue;
      }

      // STEP 4: Execute swap via Jupiter
      let txSuccess = false;
      let txSignature: string | undefined;
      let tokensBought: number | null = null;
      let txError: string | undefined;

      for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
        try {
          console.log(`[fun-buyback] Jupiter swap attempt ${attempt}: ${buybackAmount} SOL → ${buybackTokenMint}`);

          // Get quote from Jupiter
          const lamports = Math.floor(buybackAmount * 1e9);
          const quoteUrl = `${JUPITER_API_URL}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${buybackTokenMint}&amount=${lamports}&slippageBps=500`;
          
          const quoteRes = await fetch(quoteUrl);
          if (!quoteRes.ok) {
            throw new Error(`Jupiter quote failed: ${quoteRes.status}`);
          }
          const quoteData = await quoteRes.json();
          
          if (!quoteData || quoteData.error) {
            throw new Error(`Jupiter quote error: ${quoteData?.error || "No route found"}`);
          }

          // Get swap transaction
          const swapRes = await fetch(`${JUPITER_API_URL}/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quoteResponse: quoteData,
              userPublicKey: treasuryKeypair.publicKey.toBase58(),
              wrapAndUnwrapSol: true,
              computeUnitPriceMicroLamports: 100000,
            }),
          });

          if (!swapRes.ok) {
            throw new Error(`Jupiter swap request failed: ${swapRes.status}`);
          }
          const swapData = await swapRes.json();

          if (!swapData.swapTransaction) {
            throw new Error("No swap transaction returned");
          }

          // Decode and sign transaction
          const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));
          const transaction = VersionedTransaction.deserialize(txBytes);
          transaction.sign([treasuryKeypair]);

          // Send transaction
          const rawTx = transaction.serialize();
          txSignature = await connection.sendRawTransaction(rawTx, {
            skipPreflight: true,
            maxRetries: 3,
          });

          // Confirm transaction
          const confirmation = await connection.confirmTransaction(txSignature, "confirmed");
          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }

          // Parse tokens bought from quote
          tokensBought = Number(quoteData.outAmount) / 1e6; // Assuming 6 decimals

          console.log(`[fun-buyback] ✅ Buyback successful: ${txSignature}, got ${tokensBought} tokens`);
          txSuccess = true;
          break;

        } catch (e) {
          txError = e instanceof Error ? e.message : "Unknown error";
          console.error(`[fun-buyback] ❌ Attempt ${attempt} failed:`, txError);
          
          if (attempt < MAX_TX_RETRIES) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      }

      // STEP 5: Update buyback record
      if (txSuccess && txSignature) {
        await supabase
          .from("fun_buybacks")
          .update({
            status: "completed",
            signature: txSignature,
            tokens_bought: tokensBought,
          })
          .eq("id", buybackRecord.id);

        results.push({
          funTokenId: tokenId,
          tokenName: data.token.name,
          solSpent: buybackAmount,
          tokensBought,
          success: true,
          signature: txSignature,
        });

        totalBoughtBack += buybackAmount;
        successCount++;
      } else {
        await supabase
          .from("fun_buybacks")
          .update({ status: "failed" })
          .eq("id", buybackRecord.id);

        results.push({
          funTokenId: tokenId,
          tokenName: data.token.name,
          solSpent: buybackAmount,
          tokensBought: null,
          success: false,
          error: txError || "Transaction failed after retries",
        });

        failureCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[fun-buyback] ✅ Complete: ${successCount} successful, ${failureCount} failed, ${totalBoughtBack.toFixed(4)} SOL bought back in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        buybackTokenMint,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        totalSolSpent: totalBoughtBack,
        durationMs: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fun-buyback] ❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
