const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TOTAL_SUPPLY = 1_000_000_000;
const INITIAL_VIRTUAL_BTC = 0.3; // 30,000,000 sats per TAT spec
const INITIAL_VIRTUAL_TOKENS = 1_073_000_000; // Per TAT spec
const REAL_TOKEN_RESERVES = 800_000_000;
const GRADUATION_THRESHOLD_BTC = 0.5; // 50,000,000 sats
const PLATFORM_FEE_BPS = 100; // 1% platform fee per TAT spec

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, creatorWallet, initialBuyBtc } = body;

    if (!name || !ticker || !creatorWallet) {
      return new Response(JSON.stringify({ error: "name, ticker, and creatorWallet required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticker.length > 10) {
      return new Response(JSON.stringify({ error: "Ticker must be 10 chars or less" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from("btc_meme_tokens")
      .select("id")
      .eq("ticker", ticker.toUpperCase())
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: `Ticker $${ticker.toUpperCase()} already exists` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const virtualBtc = INITIAL_VIRTUAL_BTC;
    const virtualTokens = INITIAL_VIRTUAL_TOKENS;
    const priceBtc = virtualBtc / virtualTokens;
    const marketCapBtc = priceBtc * TOTAL_SUPPLY;

    const { data: token, error: tokenErr } = await supabase
      .from("btc_meme_tokens")
      .insert({
        name: name.trim(),
        ticker: ticker.toUpperCase().trim(),
        description: description?.trim() || null,
        image_url: imageUrl || null,
        website_url: websiteUrl || null,
        twitter_url: twitterUrl || null,
        creator_wallet: creatorWallet,
        total_supply: TOTAL_SUPPLY,
        virtual_btc_reserves: virtualBtc,
        virtual_token_reserves: virtualTokens,
        real_btc_reserves: 0,
        real_token_reserves: REAL_TOKEN_RESERVES,
        price_btc: priceBtc,
        market_cap_btc: marketCapBtc,
        graduation_threshold_btc: GRADUATION_THRESHOLD_BTC,
        bonding_progress: 0,
        platform_fee_bps: PLATFORM_FEE_BPS,
        creator_fee_bps: 0,
        status: "pending_genesis",
      })
      .select("id, ticker, price_btc, market_cap_btc")
      .single();

    if (tokenErr) throw tokenErr;

    let devBuyResult = null;
    if (initialBuyBtc && initialBuyBtc > 0) {
      await supabase
        .from("btc_trading_balances")
        .upsert({ wallet_address: creatorWallet, balance_btc: initialBuyBtc, total_deposited: initialBuyBtc }, { onConflict: "wallet_address" });

      const feeAmount = initialBuyBtc * (PLATFORM_FEE_BPS / 10000);
      const netBtc = initialBuyBtc - feeAmount;
      const tokensOut = (virtualTokens * netBtc) / (virtualBtc + netBtc);
      const newVirtualBtc = virtualBtc + netBtc;
      const newVirtualTokens = virtualTokens - tokensOut;
      const newRealBtc = netBtc;
      const newPrice = newVirtualBtc / newVirtualTokens;
      const newMcap = newPrice * TOTAL_SUPPLY;
      const newProgress = Math.min((newRealBtc / GRADUATION_THRESHOLD_BTC) * 100, 100);

      await supabase.from("btc_meme_tokens").update({
        virtual_btc_reserves: newVirtualBtc,
        virtual_token_reserves: newVirtualTokens,
        real_btc_reserves: newRealBtc,
        real_token_reserves: REAL_TOKEN_RESERVES - tokensOut,
        price_btc: newPrice, market_cap_btc: newMcap,
        bonding_progress: newProgress, holder_count: 1,
        trade_count: 1, volume_btc: initialBuyBtc,
        updated_at: new Date().toISOString(),
      }).eq("id", token.id);

      await supabase.from("btc_meme_balances").insert({
        token_id: token.id, wallet_address: creatorWallet,
        balance: tokensOut, avg_buy_price_btc: newPrice, total_bought: tokensOut,
      });

      await supabase.from("btc_meme_trades").insert({
        token_id: token.id, wallet_address: creatorWallet,
        trade_type: "buy", btc_amount: initialBuyBtc, token_amount: tokensOut,
        price_btc: newPrice, fee_btc: feeAmount,
        pool_virtual_btc: newVirtualBtc, pool_virtual_tokens: newVirtualTokens,
        pool_real_btc: newRealBtc, bonding_progress: newProgress, market_cap_btc: newMcap,
      });

      await supabase.from("btc_trading_balances").update({
        balance_btc: 0, updated_at: new Date().toISOString(),
      }).eq("wallet_address", creatorWallet);

      devBuyResult = { tokensReceived: tokensOut, priceAfterBuy: newPrice, marketCapAfterBuy: newMcap };
    }

    // Fire Bitcoin genesis proof asynchronously
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // Fire genesis proof with 60s auto-activation fallback
    const genesisPromise = fetch(`${supabaseUrl}/functions/v1/btc-genesis-proof`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        tokenId: token.id,
        ticker: ticker.toUpperCase().trim(),
        name: name.trim(),
        imageUrl: imageUrl || null,
        creatorWallet,
      }),
    }).catch(err => console.warn("[btc-meme-create] Genesis proof fire-and-forget error:", err));

    // Auto-activate fallback: if genesis doesn't complete within 60s, activate anyway
    setTimeout(async () => {
      try {
        const { data: checkToken } = await supabase
          .from("btc_meme_tokens")
          .select("status")
          .eq("id", token.id)
          .maybeSingle();
        if (checkToken && checkToken.status === "pending_genesis") {
          console.log(`[btc-meme-create] Auto-activating token ${token.id} after 60s timeout`);
          await supabase.from("btc_meme_tokens").update({
            status: "active",
            genesis_txid: `auto:${token.id.slice(0, 32)}`,
          }).eq("id", token.id);
        }
      } catch (e) {
        console.warn("[btc-meme-create] Auto-activate fallback error:", e);
      }
    }, 60_000);

    return new Response(JSON.stringify({
      success: true,
      token: { id: token.id, ticker: token.ticker, priceBtc: devBuyResult?.priceAfterBuy || token.price_btc, marketCapBtc: devBuyResult?.marketCapAfterBuy || token.market_cap_btc },
      devBuy: devBuyResult,
      genesisProofPending: true,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-create] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});