const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * btc-meme-deposit: Credits BTC trading balance for a wallet.
 * 
 * In production, this would verify an on-chain BTC deposit transaction.
 * For now, it accepts a deposit amount and credits the user's trading balance,
 * simulating a deposit from UniSat or any BTC wallet.
 */

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { walletAddress, amountBtc, txHash } = await req.json();

    if (!walletAddress || !amountBtc || amountBtc <= 0) {
      return new Response(JSON.stringify({ error: "walletAddress and positive amountBtc required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amountBtc > 10) {
      return new Response(JSON.stringify({ error: "Maximum deposit is 10 BTC per transaction" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Check existing balance
    const { data: existing } = await supabase
      .from("btc_trading_balances")
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      await supabase.from("btc_trading_balances").update({
        balance_btc: existing.balance_btc + amountBtc,
        total_deposited: (existing.total_deposited || 0) + amountBtc,
        updated_at: new Date().toISOString(),
      }).eq("wallet_address", walletAddress);
    } else {
      await supabase.from("btc_trading_balances").insert({
        wallet_address: walletAddress,
        balance_btc: amountBtc,
        total_deposited: amountBtc,
      });
    }

    const newBalance = (existing?.balance_btc || 0) + amountBtc;

    return new Response(JSON.stringify({
      success: true,
      balance: newBalance,
      deposited: amountBtc,
      txHash: txHash || null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-deposit] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
