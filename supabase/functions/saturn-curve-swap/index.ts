import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pool_id, is_buy, amount, wallet_address } = await req.json();

    if (!pool_id || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch pool
    const { data: pool, error: poolErr } = await supabase
      .from("lab_pools")
      .select("*")
      .eq("id", pool_id)
      .single();
    if (poolErr || !pool) throw new Error("Pool not found");
    if (pool.status === "graduated") throw new Error("Pool already graduated");

    const totalFeeBps = pool.fee_bps;
    const vsr = pool.virtual_sol_reserves + pool.real_sol_reserves;
    const vtr = pool.virtual_token_reserves;

    let solAmount: number;
    let tokenAmount: number;
    let newRealSol: number;
    let newRealTokens: number;
    let newVirtualTokens: number;

    if (is_buy) {
      const fee = (amount * totalFeeBps) / 10_000;
      const solAfterFee = amount - fee;
      tokenAmount = (vtr * solAfterFee) / (vsr + solAfterFee);
      solAmount = amount;
      newRealSol = pool.real_sol_reserves + solAfterFee;
      newRealTokens = pool.real_token_reserves - tokenAmount;
      newVirtualTokens = pool.virtual_token_reserves - tokenAmount;
    } else {
      const solOutGross = (vsr * amount) / (vtr + amount);
      const fee = (solOutGross * totalFeeBps) / 10_000;
      solAmount = solOutGross - fee;
      tokenAmount = amount;
      newRealSol = pool.real_sol_reserves - solOutGross;
      newRealTokens = pool.real_token_reserves + amount;
      newVirtualTokens = pool.virtual_token_reserves + amount;
    }

    // Calculate metrics
    const newVsr = pool.virtual_sol_reserves + newRealSol;
    const newPrice = newVsr / newVirtualTokens;
    const newMcap = newPrice * 1_000_000_000;
    const newProgress = Math.min((newRealSol / pool.graduation_threshold_sol) * 100, 100);
    const newVolume = pool.volume_total_sol + (is_buy ? amount : solAmount);

    // Count unique holders
    const { count } = await supabase
      .from("lab_trades")
      .select("wallet_address", { count: "exact", head: true })
      .eq("pool_id", pool_id);

    // Update pool
    const { error: updateErr } = await supabase.from("lab_pools").update({
      real_sol_reserves: newRealSol,
      real_token_reserves: newRealTokens,
      virtual_token_reserves: newVirtualTokens,
      price_sol: newPrice,
      market_cap_sol: newMcap,
      bonding_progress: newProgress,
      volume_total_sol: newVolume,
      holder_count: (count || 0) + 1,
    }).eq("id", pool_id);
    if (updateErr) throw updateErr;

    // Record trade
    const { error: tradeErr } = await supabase.from("lab_trades").insert({
      pool_id,
      wallet_address: wallet_address || "LAB_TEST",
      is_buy,
      sol_amount: is_buy ? amount : solAmount,
      token_amount: tokenAmount,
      price_at_trade: newPrice,
    });
    if (tradeErr) throw tradeErr;

    return new Response(JSON.stringify({
      sol_amount: solAmount,
      token_amount: tokenAmount,
      new_price: newPrice,
      progress: newProgress,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
