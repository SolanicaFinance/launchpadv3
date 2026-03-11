// PUMP Claim Fees - Collects creator fees from pump.fun tokens via PumpPortal API
// Runs every 5 minutes via cron job
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PumpPortal API endpoint
const PUMPPORTAL_API_URL = "https://pumpportal.fun/api/trade";

// Minimum SOL to consider claiming (avoid dust)
const MIN_CLAIMABLE_SOL = 0.001;

// Fee distribution splits for pump.fun tokens (matches Saturn agents)
const CREATOR_FEE_SHARE = 0.8;   // 80% to creator
const PLATFORM_FEE_SHARE = 0.2; // 20% to platform

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[pump-claim-fees] ⏰ Starting pump.fun fee claim job...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pumpPortalApiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!pumpPortalApiKey) {
      throw new Error("PUMPPORTAL_API_KEY not configured");
    }
    if (!deployerPrivateKey) {
      throw new Error("PUMP_DEPLOYER_PRIVATE_KEY not configured");
    }
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse deployer keypair
    let deployerKeypair: Keypair;
    try {
      if (deployerPrivateKey.startsWith("[")) {
        const keyArray = JSON.parse(deployerPrivateKey);
        deployerKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        deployerKeypair = Keypair.fromSecretKey(bs58.decode(deployerPrivateKey));
      }
    } catch (e) {
      throw new Error("Invalid PUMP_DEPLOYER_PRIVATE_KEY format");
    }

    const deployerPublicKey = deployerKeypair.publicKey.toBase58();
    console.log("[pump-claim-fees] Deployer public key:", deployerPublicKey);

    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Step 1: Query all active pump.fun tokens
    const { data: pumpTokens, error: queryError } = await supabase
      .from("fun_tokens")
      .select("id, name, ticker, mint_address, deployer_wallet, total_fees_earned, total_fees_claimed")
      .eq("launchpad_type", "pumpfun")
      .eq("status", "active");

    if (queryError) {
      throw new Error(`Failed to query pump.fun tokens: ${queryError.message}`);
    }

    console.log(`[pump-claim-fees] Found ${pumpTokens?.length || 0} active pump.fun tokens`);

    if (!pumpTokens || pumpTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pump.fun tokens to process",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      tokenId: string;
      ticker: string;
      mintAddress: string;
      claimedSol: number;
      signature?: string;
      error?: string;
    }> = [];

    let successCount = 0;
    let failCount = 0;
    let totalClaimedSol = 0;

    // Step 2: Process each token
    for (const token of pumpTokens) {
      try {
        console.log(`[pump-claim-fees] Processing ${token.ticker} (${token.mint_address})...`);

        // Call PumpPortal collectCreatorFee endpoint
        const claimPayload = {
          action: "collectCreatorFee",
          mint: token.mint_address,
          priorityFee: 0.0001,
          pool: "pump",
        };

        const claimResponse = await fetch(`${PUMPPORTAL_API_URL}?api-key=${pumpPortalApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(claimPayload),
        });

        if (!claimResponse.ok) {
          const errorText = await claimResponse.text();
          
          // Check if it's "no fees to claim" error (not a real error)
          if (errorText.includes("no fees") || errorText.includes("nothing to claim")) {
            console.log(`[pump-claim-fees] ${token.ticker}: No fees to claim`);
            results.push({
              tokenId: token.id,
              ticker: token.ticker,
              mintAddress: token.mint_address,
              claimedSol: 0,
            });
            continue;
          }

          throw new Error(`PumpPortal API error: ${claimResponse.status} - ${errorText}`);
        }

        // PumpPortal returns a binary VersionedTransaction that needs to be signed
        const txData = await claimResponse.arrayBuffer();
        
        if (txData.byteLength === 0) {
          console.log(`[pump-claim-fees] ${token.ticker}: Empty response (no fees available)`);
          results.push({
            tokenId: token.id,
            ticker: token.ticker,
            mintAddress: token.mint_address,
            claimedSol: 0,
          });
          continue;
        }

        // Deserialize, sign and send the transaction
        const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
        tx.sign([deployerKeypair]);

        const signature = await connection.sendTransaction(tx, {
          skipPreflight: false,
          maxRetries: 3,
        });

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`[pump-claim-fees] ✅ ${token.ticker}: Claimed fees, sig: ${signature}`);

        // We don't know the exact amount claimed without parsing the transaction
        // For now, we'll record the claim and the distribute cron will handle the actual amounts
        const estimatedClaim = MIN_CLAIMABLE_SOL; // Conservative estimate

        // Record the claim in database
        const { error: claimInsertError } = await supabase
          .from("pumpfun_fee_claims")
          .insert({
            fun_token_id: token.id,
            mint_address: token.mint_address,
            claimed_sol: estimatedClaim, // Will be updated when we parse tx
            signature,
            distributed: false,
          });

        if (claimInsertError) {
          console.error(`[pump-claim-fees] DB insert error for ${token.ticker}:`, claimInsertError);
        }

        // Update token's total_fees_claimed
        await supabase
          .from("fun_tokens")
          .update({
            total_fees_claimed: (token.total_fees_claimed || 0) + estimatedClaim,
          })
          .eq("id", token.id);

        results.push({
          tokenId: token.id,
          ticker: token.ticker,
          mintAddress: token.mint_address,
          claimedSol: estimatedClaim,
          signature,
        });

        totalClaimedSol += estimatedClaim;
        successCount++;

      } catch (tokenError) {
        const errorMessage = tokenError instanceof Error ? tokenError.message : "Unknown error";
        console.error(`[pump-claim-fees] ❌ ${token.ticker} error:`, errorMessage);
        
        results.push({
          tokenId: token.id,
          ticker: token.ticker,
          mintAddress: token.mint_address,
          claimedSol: 0,
          error: errorMessage,
        });
        
        failCount++;
      }

      // Small delay between tokens to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    const duration = Date.now() - startTime;
    console.log(`[pump-claim-fees] ✅ Complete: ${successCount} claimed, ${failCount} failed, ${totalClaimedSol.toFixed(6)} SOL total in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pumpTokens.length,
        successful: successCount,
        failed: failCount,
        totalClaimedSol,
        durationMs: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[pump-claim-fees] ❌ Error:", error);
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
