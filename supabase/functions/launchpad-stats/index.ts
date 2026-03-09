import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

let cachedData: any = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Return cache if fresh
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      return new Response(JSON.stringify(cachedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokens, error } = await supabase
      .from("fun_tokens")
      .select("launchpad_type, status, created_at")
      .not("launchpad_type", "is", null);

    if (error) throw error;

    const statsMap: Record<
      string,
      { type: string; total: number; active: number; lastLaunch: string | null }
    > = {};

    for (const t of tokens || []) {
      const lp = t.launchpad_type || "unknown";
      if (!statsMap[lp]) {
        statsMap[lp] = { type: lp, total: 0, active: 0, lastLaunch: null };
      }
      statsMap[lp].total++;
      if (t.status === "active") statsMap[lp].active++;
      if (
        !statsMap[lp].lastLaunch ||
        (t.created_at && t.created_at > statsMap[lp].lastLaunch!)
      ) {
        statsMap[lp].lastLaunch = t.created_at;
      }
    }

    const result = Object.values(statsMap).sort((a, b) => b.total - a.total);

    cachedData = result;
    cachedAt = Date.now();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
