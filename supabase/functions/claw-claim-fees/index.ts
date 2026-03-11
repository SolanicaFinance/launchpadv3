import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_CLAIM_SOL = 0.001;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  console.log("[saturn-claim-fees] ⏰ Cron job started at", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query fun_tokens (the live data table)
    const { data: tokens, error: fetchError } = await supabase
      .from("fun_tokens")
      .select("*")
      .eq("status", "active")
      .not("dbc_pool_address", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) throw new Error(`Failed to fetch tokens: ${fetchError.message}`);

    const validTokens = (tokens || []).filter(t => t.dbc_pool_address && t.dbc_pool_address.length >= 32);
    console.log(`[saturn-claim-fees] Found ${validTokens.length} tokens to process`);

    if (validTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active tokens with pools", duration: Date.now() - startTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) throw new Error("METEORA_API_URL not configured");

    const results: any[] = [];

    for (const token of validTokens) {
      try {
        console.log(`[saturn-claim-fees] Processing ${token.name} ($${token.ticker}) - Pool: ${token.dbc_pool_address}`);

        const checkResponse = await fetch(`${meteoraApiUrl}/api/fees/claim-from-pool?poolAddress=${token.dbc_pool_address}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!checkResponse.ok) {
          results.push({ tokenId: token.id, tokenName: token.name, ticker: token.ticker, poolAddress: token.dbc_pool_address, success: false, error: await checkResponse.text() });
          continue;
        }

        const checkData = await checkResponse.json();
        const claimableSol = checkData.claimableSol || 0;

        if (claimableSol < MIN_CLAIM_SOL) {
          results.push({ tokenId: token.id, tokenName: token.name, ticker: token.ticker, poolAddress: token.dbc_pool_address, success: true, claimedSol: 0 });
          continue;
        }

        // Claim fees - uses CLAW treasury
        const claimResponse = await fetch(`${meteoraApiUrl}/api/fees/claim-from-pool`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poolAddress: token.dbc_pool_address, tokenId: token.id, isFunToken: true }),
        });

        if (claimResponse.ok) {
          const claimData = await claimResponse.json();
          const claimedSol = claimData.claimedSol || 0;
          const signature = claimData.signature || null;

          if (claimedSol > 0 && signature) {
            // Record in fun_fee_claims (live data table)
            await supabase.from("fun_fee_claims").insert({
              fun_token_id: token.id,
              pool_address: token.dbc_pool_address,
              claimed_sol: claimedSol,
              signature,
              claimed_at: new Date().toISOString(),
            });

            await supabase.from("fun_tokens").update({
              total_fees_earned: (token.total_fees_earned || 0) + claimedSol,
              updated_at: new Date().toISOString(),
            }).eq("id", token.id);
          }

          results.push({ tokenId: token.id, tokenName: token.name, ticker: token.ticker, poolAddress: token.dbc_pool_address, success: true, claimedSol, signature });
        } else {
          results.push({ tokenId: token.id, tokenName: token.name, ticker: token.ticker, poolAddress: token.dbc_pool_address, success: false, error: await claimResponse.text() });
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (tokenError) {
        results.push({ tokenId: token.id, tokenName: token.name, ticker: token.ticker, poolAddress: token.dbc_pool_address, success: false, error: tokenError instanceof Error ? tokenError.message : "Unknown error" });
      }
    }

    const successCount = results.filter(r => r.success && (r.claimedSol || 0) > 0).length;
    const totalClaimed = results.reduce((sum, r) => sum + (r.claimedSol || 0), 0);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, claimed: successCount, totalClaimedSol: totalClaimed, duration: Date.now() - startTime, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-claim-fees] ❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error", duration: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
