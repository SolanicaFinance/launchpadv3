import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache (5 minute TTL)
let cachedStats: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ success: true, stats: cachedStats.data, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use RPC for accurate aggregation (bypasses 1000-row limit)
    const { data: platformStats, error: statsError } = await supabase.rpc("get_platform_stats");
    
    if (statsError) throw statsError;

    const ps = platformStats?.[0] || { total_mcap_sol: 0, total_fees_earned: 0, token_count: 0, total_fee_claims: 0, total_agent_payouts: 0 };

    // Agent posts count
    const { count: agentPostsCount } = await supabase
      .from("agent_post_history")
      .select("id", { count: "exact", head: true });

    // Active agents count
    const { count: totalAgents } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const stats = {
      totalMarketCap: Number(ps.total_mcap_sol) || 0,
      totalAgentFeesEarned: Number(ps.total_fees_earned) || 0,
      totalTokensLaunched: Number(ps.token_count) || 0,
      totalVolume: Number(ps.total_fee_claims) || 0,
      totalAgents: totalAgents || 0,
      totalAgentPosts: agentPostsCount || 0,
      totalAgentPayouts: Number(ps.total_agent_payouts) || 0,
    };

    cachedStats = { data: stats, timestamp: Date.now() };

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-stats] Error:", error);

    if (cachedStats) {
      return new Response(
        JSON.stringify({ success: true, stats: cachedStats.data, stale: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
