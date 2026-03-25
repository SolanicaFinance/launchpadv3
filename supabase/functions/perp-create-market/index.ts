import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Vault size tiers → market parameters (like FlapFutures)
function computeMarketParams(vaultUsd: number, marketCapUsd: number) {
  // Determine mcap tier for leverage
  let maxLeverage = 2;
  if (marketCapUsd >= 1_000_000) maxLeverage = 10;
  else if (marketCapUsd >= 300_000) maxLeverage = 8;
  else if (marketCapUsd >= 100_000) maxLeverage = 7;
  else if (marketCapUsd >= 50_000) maxLeverage = 5;
  else if (marketCapUsd >= 25_000) maxLeverage = 3;

  // Max position = min($100, max($5, vault / 50))
  const maxPosition = Math.min(100, Math.max(5, vaultUsd / 50));

  // Max OI capped at vault size
  const maxOI = vaultUsd;

  // Spread based on vault size
  let spread = 0.50;
  if (vaultUsd >= 5000) spread = 0.20;
  else if (vaultUsd >= 2000) spread = 0.25;
  else if (vaultUsd >= 1000) spread = 0.30;
  else if (vaultUsd >= 600) spread = 0.40;

  // Insurance floor = 10% of vault
  const insuranceFloor = vaultUsd * 0.10;

  return {
    max_leverage: maxLeverage,
    max_position_usd: Math.round(maxPosition * 100) / 100,
    max_open_interest_usd: maxOI,
    spread_pct: spread,
    insurance_floor_pct: 10,
    insurance_balance_usd: insuranceFloor,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      action,
      tokenAddress,
      creatorWallet,
      vaultAmountUsd,
      lockDurationDays,
      // Token metadata (from oracle lookup)
      tokenName,
      tokenSymbol,
      tokenImageUrl,
      dexPairAddress,
      dexQuoteToken,
      marketCapUsd,
      liquidityUsd,
      priceUsd,
      // Admin actions
      adminPassword,
      marketId,
    } = await req.json();

    // ---- CREATE MARKET ----
    if (action === "create") {
      if (!tokenAddress || !creatorWallet || !vaultAmountUsd) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check minimum vault
      if (vaultAmountUsd < 500) {
        return new Response(
          JSON.stringify({ success: false, error: "Minimum vault deposit is $500 USDT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if market already exists
      const { data: existing } = await supabase
        .from("perp_markets")
        .select("id")
        .eq("token_address", tokenAddress.toLowerCase())
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "A perpetual market already exists for this token" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compute parameters
      const params = computeMarketParams(vaultAmountUsd, marketCapUsd || 0);
      const lockExpiry = new Date();
      lockExpiry.setDate(lockExpiry.getDate() + (lockDurationDays || 30));

      const { data: market, error } = await supabase
        .from("perp_markets")
        .insert({
          token_address: tokenAddress.toLowerCase(),
          token_name: tokenName || "Unknown",
          token_symbol: tokenSymbol || "???",
          token_image_url: tokenImageUrl,
          chain: "bsc",
          dex_pair_address: dexPairAddress,
          dex_quote_token: dexQuoteToken,
          ...params,
          fee_pct: 0.30,
          min_fee_usd: 1.00,
          min_collateral_usd: 1.00,
          vault_balance_usd: vaultAmountUsd,
          creator_wallet: creatorWallet,
          creator_fee_share_pct: 60,
          lock_duration_days: lockDurationDays || 30,
          lock_expires_at: lockExpiry.toISOString(),
          last_price_usd: priceUsd || 0,
          last_price_updated_at: new Date().toISOString(),
          market_cap_usd: marketCapUsd || 0,
          liquidity_usd: liquidityUsd || 0,
          status: "active",
          created_by_admin: false,
        })
        .select()
        .single();

      if (error) {
        console.error("Create market error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log initial vault deposit
      await supabase.from("perp_vault_deposits").insert({
        market_id: market.id,
        wallet_address: creatorWallet,
        amount_usd: vaultAmountUsd,
        deposit_type: "initial",
      });

      // Cache the price
      await supabase.from("perp_price_cache").upsert(
        {
          token_address: tokenAddress.toLowerCase(),
          chain: "bsc",
          price_usd: priceUsd || 0,
          market_cap: marketCapUsd || 0,
          liquidity: liquidityUsd || 0,
          source: "dexscreener",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token_address,chain" }
      );

      return new Response(
        JSON.stringify({ success: true, market }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- ADMIN CREATE (simplified, no vault deposit required) ----
    if (action === "admin_create") {
      if (adminPassword !== "saturn135@") {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = computeMarketParams(vaultAmountUsd || 10000, marketCapUsd || 100000);

      const { data: market, error } = await supabase
        .from("perp_markets")
        .insert({
          token_address: tokenAddress.toLowerCase(),
          token_name: tokenName || "Unknown",
          token_symbol: tokenSymbol || "???",
          token_image_url: tokenImageUrl,
          chain: "bsc",
          dex_pair_address: dexPairAddress,
          dex_quote_token: dexQuoteToken,
          ...params,
          fee_pct: 0.30,
          min_fee_usd: 1.00,
          min_collateral_usd: 1.00,
          vault_balance_usd: vaultAmountUsd || 10000,
          creator_wallet: creatorWallet || "admin",
          creator_fee_share_pct: 100,
          lock_duration_days: 365,
          last_price_usd: priceUsd || 0,
          last_price_updated_at: new Date().toISOString(),
          market_cap_usd: marketCapUsd || 0,
          liquidity_usd: liquidityUsd || 0,
          status: "active",
          is_featured: true,
          created_by_admin: true,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, market }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- PAUSE / UNPAUSE ----
    if (action === "toggle_status" && marketId) {
      if (adminPassword !== "saturn135@") {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: market } = await supabase
        .from("perp_markets")
        .select("status")
        .eq("id", marketId)
        .single();

      const newStatus = market?.status === "active" ? "paused" : "active";

      await supabase
        .from("perp_markets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", marketId);

      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create market error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
