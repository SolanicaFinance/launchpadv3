const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TOTAL_SUPPLY = 1_000_000_000;

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

    const { data: token, error: tokenErr } = await supabase
      .from("btc_meme_tokens")
      .select("*")
      .eq("id", tokenId)
      .single();

    if (tokenErr || !token) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (token.status !== "active") {
      return new Response(JSON.stringify({ error: "Token is no longer active" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalFeeBps = token.platform_fee_bps + token.creator_fee_bps;
    let btcAmount: number, tokenAmount: number, feeAmount: number;
    let newVirtualBtc: number, newVirtualTokens: number, newRealBtc: number, newRealTokens: number;

    if (tradeType === "buy") {
      btcAmount = amount;
      const { data: bal } = await supabase.from("btc_trading_balances").select("balance_btc").eq("wallet_address", walletAddress).maybeSingle();
      if (!bal || bal.balance_btc < btcAmount) {
        return new Response(JSON.stringify({ error: "Insufficient BTC balance", available: bal?.balance_btc || 0 }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      feeAmount = btcAmount * (totalFeeBps / 10000);
      const netBtc = btcAmount - feeAmount;
      tokenAmount = (token.virtual_token_reserves * netBtc) / (token.virtual_btc_reserves + netBtc);

      if (tokenAmount > token.real_token_reserves) {
        return new Response(JSON.stringify({ error: "Not enough tokens in pool" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      newVirtualBtc = token.virtual_btc_reserves + netBtc;
      newVirtualTokens = token.virtual_token_reserves - tokenAmount;
      newRealBtc = token.real_btc_reserves + netBtc;
      newRealTokens = token.real_token_reserves - tokenAmount;

      await supabase.from("btc_trading_balances").update({
        balance_btc: bal.balance_btc - btcAmount, updated_at: new Date().toISOString(),
      }).eq("wallet_address", walletAddress);

      const { data: existingBal } = await supabase.from("btc_meme_balances")
        .select("*").eq("token_id", tokenId).eq("wallet_address", walletAddress).maybeSingle();

      if (existingBal) {
        const newBal = existingBal.balance + tokenAmount;
        const newTotalBought = existingBal.total_bought + tokenAmount;
        const execPrice = newVirtualBtc / newVirtualTokens;
        const newAvg = newTotalBought > 0
          ? ((existingBal.avg_buy_price_btc * existingBal.total_bought) + (execPrice * tokenAmount)) / newTotalBought
          : execPrice;
        await supabase.from("btc_meme_balances").update({
          balance: newBal, total_bought: newTotalBought, avg_buy_price_btc: newAvg, updated_at: new Date().toISOString(),
        }).eq("id", existingBal.id);
      } else {
        await supabase.from("btc_meme_balances").insert({
          token_id: tokenId, wallet_address: walletAddress,
          balance: tokenAmount, avg_buy_price_btc: newVirtualBtc / newVirtualTokens, total_bought: tokenAmount,
        });
      }
    } else {
      tokenAmount = amount;
      const { data: tokenBal } = await supabase.from("btc_meme_balances")
        .select("*").eq("token_id", tokenId).eq("wallet_address", walletAddress).maybeSingle();

      if (!tokenBal || tokenBal.balance < tokenAmount) {
        return new Response(JSON.stringify({ error: "Insufficient token balance", available: tokenBal?.balance || 0 }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const grossBtc = (token.virtual_btc_reserves * tokenAmount) / (token.virtual_token_reserves + tokenAmount);
      feeAmount = grossBtc * (totalFeeBps / 10000);
      btcAmount = grossBtc - feeAmount;

      newVirtualBtc = token.virtual_btc_reserves - grossBtc;
      newVirtualTokens = token.virtual_token_reserves + tokenAmount;
      newRealBtc = Math.max(token.real_btc_reserves - grossBtc, 0);
      newRealTokens = token.real_token_reserves + tokenAmount;

      const { data: userBtcBal } = await supabase.from("btc_trading_balances")
        .select("balance_btc").eq("wallet_address", walletAddress).maybeSingle();

      if (userBtcBal) {
        await supabase.from("btc_trading_balances").update({
          balance_btc: userBtcBal.balance_btc + btcAmount, updated_at: new Date().toISOString(),
        }).eq("wallet_address", walletAddress);
      } else {
        await supabase.from("btc_trading_balances").insert({ wallet_address: walletAddress, balance_btc: btcAmount });
      }

      await supabase.from("btc_meme_balances").update({
        balance: tokenBal.balance - tokenAmount, total_sold: tokenBal.total_sold + tokenAmount, updated_at: new Date().toISOString(),
      }).eq("id", tokenBal.id);
    }

    const newPrice = newVirtualTokens > 0 ? newVirtualBtc / newVirtualTokens : 0;
    const newMcap = newPrice * TOTAL_SUPPLY;
    const newProgress = Math.min((newRealBtc / token.graduation_threshold_btc) * 100, 100);
    const isGraduated = newProgress >= 100;

    const { count: holderCount } = await supabase.from("btc_meme_balances")
      .select("*", { count: "exact", head: true }).eq("token_id", tokenId).gt("balance", 0);

    await supabase.from("btc_meme_tokens").update({
      virtual_btc_reserves: newVirtualBtc, virtual_token_reserves: newVirtualTokens,
      real_btc_reserves: newRealBtc, real_token_reserves: newRealTokens,
      price_btc: newPrice, market_cap_btc: newMcap,
      bonding_progress: newProgress, holder_count: holderCount || 0,
      trade_count: token.trade_count + 1, volume_btc: token.volume_btc + btcAmount,
      status: isGraduated ? "graduated" : "active",
      graduated_at: isGraduated ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenId);

    await supabase.from("btc_meme_trades").insert({
      token_id: tokenId, wallet_address: walletAddress, trade_type: tradeType,
      btc_amount: btcAmount, token_amount: tokenAmount, price_btc: newPrice, fee_btc: feeAmount,
      pool_virtual_btc: newVirtualBtc, pool_virtual_tokens: newVirtualTokens,
      pool_real_btc: newRealBtc, bonding_progress: newProgress, market_cap_btc: newMcap,
    });

    // Get the inserted trade ID for proof linking
    const { data: latestTrade } = await supabase
      .from("btc_meme_trades")
      .select("id")
      .eq("token_id", tokenId)
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fire Solana memo proof asynchronously (don't block the trade response)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (latestTrade?.id) {
      // Fire-and-forget: post Solana proof
      fetch(`${supabaseUrl}/functions/v1/btc-solana-proof`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          tradeId: latestTrade.id,
          tokenTicker: token.ticker,
          tokenName: token.name,
          tradeType,
          btcAmount,
          tokenAmount,
          walletAddress,
          genesisTxid: token.genesis_txid || null,
          imageHash: token.image_hash || null,
        }),
      }).catch(err => console.warn("[btc-meme-swap] Solana proof fire-and-forget error:", err));
    }

    return new Response(JSON.stringify({
      success: true,
      trade: { type: tradeType, btcAmount, tokenAmount, feeBtc: feeAmount, priceBtc: newPrice, marketCapBtc: newMcap, bondingProgress: newProgress, isGraduated },
      proofPending: !!latestTrade?.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-swap] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});