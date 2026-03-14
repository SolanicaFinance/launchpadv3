import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet that receives all fees
const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Minimum SOL to claim (to avoid dust transactions)
const MIN_CLAIM_SOL = 0.001;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[fun-claim-fees] ⏰ Cron job started at", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active fun tokens, ordered by bonding progress (actual trading activity) first
    // Then by newest first for tokens with equal progress
    // This ensures active tokens get processed before rate limits kick in
    const { data: funTokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("*")
      .eq("status", "active")
      .eq("chain", "solana")
      .not("dbc_pool_address", "is", null)
      .order("bonding_progress", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100); // Process top 100 by activity to avoid rate limits

    if (fetchError) {
      throw new Error(`Failed to fetch fun tokens: ${fetchError.message}`);
    }

    // Filter tokens with valid pool addresses (Solana addresses are 32-44 chars)
    const validTokens = (funTokens || []).filter(
      (t) => t.dbc_pool_address && t.dbc_pool_address.length >= 32
    );

    console.log(`[fun-claim-fees] Found ${validTokens.length} tokens to process (ordered by bonding progress)`);

    if (validTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active fun tokens with pools to claim from",
          duration: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) {
      console.error("[fun-claim-fees] METEORA_API_URL not configured");
      throw new Error("METEORA_API_URL not configured - cannot claim fees");
    }

    console.log("[fun-claim-fees] Using Meteora API:", meteoraApiUrl);

    const results: Array<{
      tokenId: string;
      tokenName: string;
      ticker: string;
      poolAddress: string;
      success: boolean;
      claimedSol?: number;
      signature?: string;
      error?: string;
    }> = [];

    // Process each token sequentially to avoid overwhelming the RPC
    for (const token of validTokens) {
      try {
        console.log(`[fun-claim-fees] Processing ${token.name} ($${token.ticker}) - Pool: ${token.dbc_pool_address}`);

        // First, check claimable fees (GET request)
        const checkResponse = await fetch(
          `${meteoraApiUrl}/api/fees/claim-from-pool?poolAddress=${token.dbc_pool_address}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!checkResponse.ok) {
          const errorText = await checkResponse.text();
          console.log(`[fun-claim-fees] Check failed for ${token.ticker}:`, errorText);
          results.push({
            tokenId: token.id,
            tokenName: token.name,
            ticker: token.ticker,
            poolAddress: token.dbc_pool_address,
            success: false,
            error: `Check failed: ${errorText}`,
          });
          continue;
        }

        const checkData = await checkResponse.json();
        const claimableSol = checkData.claimableSol || 0;

        console.log(`[fun-claim-fees] ${token.ticker} has ${claimableSol} SOL claimable`);

        // Skip if below minimum threshold
        if (claimableSol < MIN_CLAIM_SOL) {
          console.log(`[fun-claim-fees] Skipping ${token.ticker} - below minimum (${MIN_CLAIM_SOL} SOL)`);
          results.push({
            tokenId: token.id,
            tokenName: token.name,
            ticker: token.ticker,
            poolAddress: token.dbc_pool_address,
            success: true,
            claimedSol: 0,
            error: `Below minimum (${claimableSol} < ${MIN_CLAIM_SOL})`,
          });
          continue;
        }

        // Claim the fees (POST request) - explicitly mark as fun token
        const claimResponse = await fetch(`${meteoraApiUrl}/api/fees/claim-from-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poolAddress: token.dbc_pool_address,
            tokenId: token.id,
            isFunToken: true, // Tell the API to check fun_tokens table
          }),
        });

        if (claimResponse.ok) {
          const claimData = await claimResponse.json();
          const claimedSol = claimData.claimedSol || 0;
          const signature = claimData.signature || null;

          console.log(`[fun-claim-fees] ✅ Claimed ${claimedSol} SOL from ${token.ticker} - TX: ${signature}`);

          // Record fee claim in fun_fee_claims table
          if (claimedSol > 0 && signature) {
            const { error: insertError } = await supabase
              .from("fun_fee_claims")
              .insert({
                fun_token_id: token.id,
                pool_address: token.dbc_pool_address,
                claimed_sol: claimedSol,
                signature,
                claimed_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error(`[fun-claim-fees] Failed to record claim for ${token.ticker}:`, insertError);
            }

            // Update token with total fees earned
            await supabase
              .from("fun_tokens")
              .update({
                total_fees_earned: (token.total_fees_earned || 0) + claimedSol,
                updated_at: new Date().toISOString(),
              })
              .eq("id", token.id);
          }

          results.push({
            tokenId: token.id,
            tokenName: token.name,
            ticker: token.ticker,
            poolAddress: token.dbc_pool_address,
            success: true,
            claimedSol,
            signature,
          });
        } else {
          const errorText = await claimResponse.text();
          console.error(`[fun-claim-fees] ❌ Claim failed for ${token.ticker}:`, errorText);
          results.push({
            tokenId: token.id,
            tokenName: token.name,
            ticker: token.ticker,
            poolAddress: token.dbc_pool_address,
            success: false,
            error: errorText,
          });
        }

        // Longer delay between claims to avoid rate limiting (1.5 seconds)
        await new Promise((resolve) => setTimeout(resolve, 1500));

      } catch (tokenError) {
        console.error(`[fun-claim-fees] Error processing ${token.ticker}:`, tokenError);
        results.push({
          tokenId: token.id,
          tokenName: token.name,
          ticker: token.ticker,
          poolAddress: token.dbc_pool_address,
          success: false,
          error: tokenError instanceof Error ? tokenError.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success && (r.claimedSol || 0) > 0).length;
    const totalClaimed = results.reduce((sum, r) => sum + (r.claimedSol || 0), 0);
    const duration = Date.now() - startTime;

    console.log(`[fun-claim-fees] ✅ Complete: ${successCount} claims, ${totalClaimed.toFixed(6)} SOL total, ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        claimed: successCount,
        totalClaimedSol: totalClaimed,
        treasuryWallet: TREASURY_WALLET,
        duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fun-claim-fees] ❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
