import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pool_id } = await req.json();
    if (!pool_id) throw new Error("pool_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pool, error: poolErr } = await supabase
      .from("lab_pools")
      .select("*")
      .eq("id", pool_id)
      .single();
    if (poolErr || !pool) throw new Error("Pool not found");
    if (pool.status === "graduated") throw new Error("Already graduated");
    if (pool.real_sol_reserves < pool.graduation_threshold_sol) {
      throw new Error(`Need ${pool.graduation_threshold_sol} SOL, have ${pool.real_sol_reserves}`);
    }

    // Mark graduated + simulate LP lock
    const { error: updateErr } = await supabase.from("lab_pools").update({
      status: "graduated",
      graduated_at: new Date().toISOString(),
      damm_pool_address: `DAMM_${pool_id.slice(0, 8)}_SIMULATED`,
      lp_locked: true,
      lp_lock_tx: `LOCK_TX_${Date.now().toString(36).toUpperCase()}`,
    }).eq("id", pool_id);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      success: true,
      message: `${pool.name} graduated! LP locked.`,
      damm_pool: `DAMM_${pool_id.slice(0, 8)}_SIMULATED`,
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
