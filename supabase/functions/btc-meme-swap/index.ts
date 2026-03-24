const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { tokenId, walletAddress, tradeType, amount } = body;

    if (!tokenId || !walletAddress || !tradeType || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "tokenId, walletAddress, tradeType, and positive amount required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["buy", "sell"].includes(tradeType)) {
      return new Response(JSON.stringify({ error: "tradeType must be 'buy' or 'sell'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Execute the atomic swap — all validation, locking, balance updates,
    // and pool state changes happen inside a single Postgres transaction.
    // SELECT ... FOR UPDATE on the token row serializes concurrent trades.
    const { data: result, error: rpcErr } = await supabase.rpc("execute_btc_swap", {
      p_token_id: tokenId,
      p_wallet_address: walletAddress,
      p_trade_type: tradeType,
      p_amount: amount,
    });

    if (rpcErr) {
      // Postgres RAISE EXCEPTION messages come through as the error message
      const msg = rpcErr.message || "Swap failed";
      const status = msg.includes("not found") ? 404 : 400;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // result is the jsonb returned by execute_btc_swap
    const trade = result as Record<string, unknown>;

    // Fire Solana proof asynchronously (don't block the trade response)
    if (trade.isGraduated) {
      fireAndForget(`${Deno.env.get("SUPABASE_URL")}/functions/v1/btc-meme-graduate`, { tokenId });
      console.log(`[btc-meme-swap] 🎓 Token ${trade.ticker} graduated! Migration initiated.`);
    }

    // Get the latest trade ID for proof linking
    const { data: latestTrade } = await supabase
      .from("btc_meme_trades")
      .select("id")
      .eq("token_id", tokenId)
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTrade?.id) {
      fireAndForget(`${Deno.env.get("SUPABASE_URL")}/functions/v1/btc-solana-proof`, {
        tradeId: latestTrade.id,
        tokenTicker: trade.ticker,
        tokenName: trade.tokenName,
        tradeType,
        btcAmount: trade.btcAmount,
        tokenAmount: trade.tokenAmount,
        walletAddress,
        genesisTxid: trade.genesisTxid || null,
        imageHash: trade.imageHash || null,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      trade: {
        type: tradeType,
        btcAmount: trade.btcAmount,
        tokenAmount: trade.tokenAmount,
        feeBtc: trade.feeBtc,
        priceBtc: trade.priceBtc,
        marketCapBtc: trade.marketCapBtc,
        bondingProgress: trade.bondingProgress,
        isGraduated: trade.isGraduated,
      },
      tradeId: latestTrade?.id || null,
      proofPending: !!latestTrade?.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-swap] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Fire-and-forget helper for async side effects */
function fireAndForget(url: string, body: Record<string, unknown>) {
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify(body),
  }).catch(err => console.warn("[btc-meme-swap] Fire-and-forget error:", err));
}
