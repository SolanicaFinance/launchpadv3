import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Wallet-based creator earnings endpoint.
 * Finds tokens by creator_wallet in fun_tokens + tokens tables,
 * calculates earnings from fee claims using creator_fee_bps / trading_fee_bps ratio,
 * and subtracts already-paid distributions.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");

    console.log("[launchpad-earnings] Request:", { walletAddress });

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing wallet parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all tokens created by this wallet from both tables
    const [{ data: funTokens }, { data: saturnTokens }] = await Promise.all([
      supabase
        .from("fun_tokens")
        .select("id, name, ticker, image_url, mint_address, status, creator_fee_bps, trading_fee_bps, total_fees_earned, total_fees_claimed, created_at")
        .eq("creator_wallet", walletAddress),
      supabase
        .from("tokens")
        .select("id, name, ticker, image_url, mint_address, status, creator_fee_bps, system_fee_bps, created_at")
        .eq("creator_wallet", walletAddress),
    ]);

    const allTokens: any[] = [];
    const tokenBpsMap = new Map<string, { creator_fee_bps: number; trading_fee_bps: number }>();

    // Process fun_tokens
    for (const t of funTokens || []) {
      allTokens.push({ ...t, source: "fun_tokens" });
      tokenBpsMap.set(t.id, {
        creator_fee_bps: t.creator_fee_bps || 100,
        trading_fee_bps: t.trading_fee_bps || 200,
      });
    }

    // Process saturn tokens (system_fee_bps is the platform fee, total = system + creator)
    for (const t of saturnTokens || []) {
      // Avoid duplicates if same token exists in both tables
      if (!tokenBpsMap.has(t.id)) {
        const creatorBps = t.creator_fee_bps || 100;
        const totalBps = creatorBps + (t.system_fee_bps || 100);
        allTokens.push({ ...t, source: "tokens" });
        tokenBpsMap.set(t.id, {
          creator_fee_bps: creatorBps,
          trading_fee_bps: totalBps,
        });
      }
    }

    if (allTokens.length === 0) {
      return new Response(
        JSON.stringify({
          earnings: [],
          claims: [],
          summary: { totalEarned: 0, totalUnclaimed: 0, tokensWithEarnings: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenIds = allTokens.map((t) => t.id);
    const funTokenIds = (funTokens || []).map((t: any) => t.id);

    // Get fee claims from the pool (system claimed these from on-chain)
    const [{ data: funFeeClaims }, { data: clawFeeClaims }] = await Promise.all([
      funTokenIds.length > 0
        ? supabase.from("fun_fee_claims").select("fun_token_id, claimed_sol").in("fun_token_id", funTokenIds)
        : Promise.resolve({ data: [] }),
      supabase.from("claw_fee_claims").select("fun_token_id, claimed_sol").in("fun_token_id", tokenIds),
    ]);

    // Calculate earned per token using bps ratio
    const tokenEarnings: Record<string, number> = {};
    for (const fc of [...(funFeeClaims || []), ...(clawFeeClaims || [])]) {
      const bps = tokenBpsMap.get(fc.fun_token_id);
      if (!bps || bps.trading_fee_bps <= 0) continue;
      const ratio = bps.creator_fee_bps / bps.trading_fee_bps;
      const earned = Math.floor((fc.claimed_sol || 0) * ratio * 1e9) / 1e9;
      tokenEarnings[fc.fun_token_id] = (tokenEarnings[fc.fun_token_id] || 0) + earned;
    }

    // Get already-paid distributions (both tables, deduplicated)
    const [{ data: clawDists }, { data: funDists }] = await Promise.all([
      supabase
        .from("claw_distributions")
        .select("id, amount_sol, fun_token_id, signature, created_at")
        .or(`creator_wallet.eq.${walletAddress},fun_token_id.in.(${tokenIds.join(",")})`)
        .in("distribution_type", ["creator_claim", "creator"])
        .in("status", ["completed", "pending"]),
      supabase
        .from("fun_distributions")
        .select("id, amount_sol, fun_token_id, signature, created_at")
        .or(`creator_wallet.eq.${walletAddress},fun_token_id.in.(${tokenIds.join(",")})`)
        .in("distribution_type", ["creator_claim", "creator"])
        .in("status", ["completed", "pending"]),
    ]);

    // Deduplicate distributions
    const allDists = new Map<string, any>();
    for (const d of clawDists || []) allDists.set(d.id, d);
    for (const d of funDists || []) allDists.set("fun_" + d.id, d);

    const paidPerToken: Record<string, number> = {};
    let totalPaid = 0;
    for (const d of allDists.values()) {
      totalPaid += d.amount_sol || 0;
      if (d.fun_token_id) {
        paidPerToken[d.fun_token_id] = (paidPerToken[d.fun_token_id] || 0) + (d.amount_sol || 0);
      }
    }

    // Build earnings response per token
    const earnings = allTokens.map((token) => {
      const earned = tokenEarnings[token.id] || 0;
      const paid = paidPerToken[token.id] || 0;
      const unclaimed = Math.max(0, earned - paid);
      const bps = tokenBpsMap.get(token.id);
      return {
        id: token.id,
        token_id: token.id,
        tokens: {
          id: token.id,
          name: token.name,
          ticker: token.ticker,
          image_url: token.image_url,
          mint_address: token.mint_address,
          status: token.status,
        },
        total_earned_sol: earned,
        unclaimed_sol: unclaimed,
        total_paid_sol: paid,
        creator_fee_bps: bps?.creator_fee_bps || 0,
        trading_fee_bps: bps?.trading_fee_bps || 0,
      };
    }).filter((e) => e.total_earned_sol > 0 || e.unclaimed_sol > 0);

    // Sort by earned descending
    earnings.sort((a, b) => b.total_earned_sol - a.total_earned_sol);

    const totalEarned = earnings.reduce((s, e) => s + e.total_earned_sol, 0);
    const totalUnclaimed = earnings.reduce((s, e) => s + e.unclaimed_sol, 0);

    // Build claims list from completed distributions
    const claims = Array.from(allDists.values())
      .filter((d) => d.signature)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)
      .map((d) => ({
        id: d.id,
        amount_sol: d.amount_sol,
        signature: d.signature,
        created_at: d.created_at,
      }));

    console.log("[launchpad-earnings] Result:", {
      wallet: walletAddress,
      tokensFound: allTokens.length,
      tokensWithEarnings: earnings.length,
      totalEarned: totalEarned.toFixed(6),
      totalUnclaimed: totalUnclaimed.toFixed(6),
    });

    return new Response(
      JSON.stringify({
        earnings,
        claims,
        summary: {
          totalEarned,
          totalUnclaimed,
          tokensWithEarnings: earnings.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[launchpad-earnings] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
