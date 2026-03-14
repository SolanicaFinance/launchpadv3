// Bags Claim Fees - Collects platform fees from bags.fm tokens
// 100% of fees go to platform treasury (no creator split)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BAGS_API_URL = "https://public-api-v2.bags.fm/api/v1";
const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Minimum claimable amount (avoid tiny claims that waste gas)
const MIN_CLAIM_SOL = 0.01;

function parseKeypair(privateKey: string): Keypair {
  try {
    if (privateKey.startsWith("[")) {
      const keyArray = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(keyArray));
    } else {
      const decoded = bs58.decode(privateKey);
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    throw new Error("Invalid private key format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[bags-claim-fees] ⏰ Starting bags.fm fee claim...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bagsApiKey = Deno.env.get("BAGS_API_KEY");
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!bagsApiKey) {
      throw new Error("BAGS_API_KEY not configured");
    }
    if (!treasuryPrivateKey) {
      throw new Error("TREASURY_PRIVATE_KEY not configured");
    }
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const connection = new Connection(heliusRpcUrl, "confirmed");
    const treasuryKeypair = parseKeypair(treasuryPrivateKey);

    // Fetch all active bags tokens
    const { data: bagsTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("id, mint_address, ticker, name, bags_pool_address")
      .eq("launchpad_type", "bags")
      .eq("status", "active");

    if (fetchError) {
      throw new Error(`Failed to fetch bags tokens: ${fetchError.message}`);
    }

    console.log(`[bags-claim-fees] Found ${bagsTokens?.length || 0} bags tokens`);

    if (!bagsTokens || bagsTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No bags tokens to claim from",
          claimed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let claimedCount = 0;
    let totalClaimed = 0;
    let failedCount = 0;

    for (const token of bagsTokens) {
      try {
        // Check claimable fees from bags.fm
        const checkResponse = await fetch(`${BAGS_API_URL}/fee-share/claimable/${token.mint_address}`, {
          headers: {
            "x-api-key": bagsApiKey,
          },
        });

        if (!checkResponse.ok) {
          console.warn(`[bags-claim-fees] Failed to check ${token.ticker}: ${checkResponse.status}`);
          failedCount++;
          continue;
        }

        const claimableData = await checkResponse.json();
        const claimableAmount = claimableData.claimableAmount || claimableData.amount || 0;

        if (claimableAmount < MIN_CLAIM_SOL) {
          console.log(`[bags-claim-fees] ${token.ticker}: ${claimableAmount} SOL (below minimum)`);
          continue;
        }

        console.log(`[bags-claim-fees] ${token.ticker}: ${claimableAmount} SOL claimable`);

        // Create claim transaction
        const claimResponse = await fetch(`${BAGS_API_URL}/fee-share/claim`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": bagsApiKey,
          },
          body: JSON.stringify({
            mint: token.mint_address,
            claimer: TREASURY_WALLET,
          }),
        });

        if (!claimResponse.ok) {
          const errorText = await claimResponse.text();
          console.error(`[bags-claim-fees] Claim failed for ${token.ticker}:`, errorText);
          failedCount++;
          continue;
        }

        const claimResult = await claimResponse.json();
        
        let signature: string;
        
        if (claimResult.transaction) {
          // Sign and submit the transaction
          const base64ToBytes = (base64: string) => {
            const binString = atob(base64);
            return Uint8Array.from(binString, (c) => c.charCodeAt(0));
          };
          const txBuffer = base64ToBytes(claimResult.transaction);
          const { VersionedTransaction } = await import("https://esm.sh/@solana/web3.js@1.98.0");
          const transaction = VersionedTransaction.deserialize(txBuffer);
          
          transaction.sign([treasuryKeypair]);
          
          signature = await connection.sendTransaction(transaction, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });
          
          await connection.confirmTransaction(signature, "confirmed");
        } else if (claimResult.signature) {
          signature = claimResult.signature;
        } else {
          console.error(`[bags-claim-fees] No transaction returned for ${token.ticker}`);
          failedCount++;
          continue;
        }

        console.log(`[bags-claim-fees] ✅ Claimed ${claimableAmount} SOL from ${token.ticker}: ${signature}`);

        // Record the claim in our database
        const { error: insertError } = await supabase
          .from("bags_fee_claims")
          .insert({
            fun_token_id: token.id,
            mint_address: token.mint_address,
            claimed_sol: claimableAmount,
            signature,
            distributed: false, // Will be marked true since 100% goes to treasury
          });

        if (insertError) {
          console.error(`[bags-claim-fees] Failed to record claim:`, insertError);
        }

        // Fetch current fees and update
        const { data: currentToken } = await supabase
          .from("fun_tokens")
          .select("total_fees_earned, total_fees_claimed")
          .eq("id", token.id)
          .single();

        await supabase
          .from("fun_tokens")
          .update({
            total_fees_earned: (currentToken?.total_fees_earned || 0) + claimableAmount,
            total_fees_claimed: (currentToken?.total_fees_claimed || 0) + claimableAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", token.id);

        claimedCount++;
        totalClaimed += claimableAmount;

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (tokenError) {
        console.error(`[bags-claim-fees] Error claiming ${token.ticker}:`, tokenError);
        failedCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[bags-claim-fees] ✅ Completed in ${duration}ms: ${claimedCount} claims, ${totalClaimed.toFixed(4)} SOL total, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        claimed: claimedCount,
        totalSol: totalClaimed,
        failed: failedCount,
        duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bags-claim-fees] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
