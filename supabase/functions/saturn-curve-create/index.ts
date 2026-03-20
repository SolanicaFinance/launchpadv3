import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, ticker, image_url, graduation_threshold_sol, fee_bps } = await req.json();

    if (!name || !ticker) {
      return new Response(JSON.stringify({ error: "Name and ticker required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const virtualSol = 30;
    const curveTokens = 800_000_000;
    const initialPrice = virtualSol / curveTokens;

    const { data, error } = await supabase.from("lab_pools").insert({
      name,
      ticker,
      image_url: image_url || null,
      creator_wallet: "LAB_ADMIN",
      virtual_sol_reserves: virtualSol,
      virtual_token_reserves: curveTokens,
      real_sol_reserves: 0,
      real_token_reserves: curveTokens,
      graduation_threshold_sol: graduation_threshold_sol ?? 1,
      bonding_progress: 0,
      price_sol: initialPrice,
      market_cap_sol: initialPrice * 1_000_000_000,
      volume_total_sol: 0,
      holder_count: 0,
      status: "active",
      fee_bps: fee_bps ?? 100,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ pool: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
