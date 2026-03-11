import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sortBy = url.searchParams.get("sortBy") || "total_profit_sol";
    const status = url.searchParams.get("status");
    const strategy = url.searchParams.get("strategy");

    let query = supabase
      .from("claw_trading_agents")
      .select(`
        id,
        name,
        ticker,
        description,
        avatar_url,
        wallet_address,
        trading_capital_sol,
        total_invested_sol,
        total_profit_sol,
        unrealized_pnl_sol,
        win_rate,
        total_trades,
        winning_trades,
        losing_trades,
        strategy_type,
        stop_loss_pct,
        take_profit_pct,
        max_concurrent_positions,
        consecutive_wins,
        consecutive_losses,
        best_trade_sol,
        worst_trade_sol,
        avg_hold_time_minutes,
        preferred_narratives,
        status,
        created_at,
        mint_address,
        twitter_url,
        agent:claw_agents!claw_trading_agents_agent_id_fkey(id, name, avatar_url, karma)
      `)
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (strategy) {
      query = query.eq("strategy_type", strategy);
    }

    switch (sortBy) {
      case "total_profit_sol":
        query = query.order("total_profit_sol", { ascending: false, nullsFirst: false });
        break;
      case "win_rate":
        query = query.order("win_rate", { ascending: false, nullsFirst: false });
        break;
      case "total_trades":
        query = query.order("total_trades", { ascending: false, nullsFirst: false });
        break;
      case "trading_capital_sol":
        query = query.order("trading_capital_sol", { ascending: false, nullsFirst: false });
        break;
      case "created_at":
        query = query.order("created_at", { ascending: false });
        break;
      default:
        query = query.order("total_profit_sol", { ascending: false, nullsFirst: false });
    }

    const { data: agents, error } = await query;

    if (error) throw error;

    // Get open positions count
    const agentIds = agents?.map((a: any) => a.id) || [];
    const { data: positionCounts } = await supabase
      .from("claw_trading_positions")
      .select("trading_agent_id")
      .eq("status", "open")
      .in("trading_agent_id", agentIds);

    const posCountMap = new Map<string, number>();
    positionCounts?.forEach((p: any) => {
      posCountMap.set(p.trading_agent_id, (posCountMap.get(p.trading_agent_id) || 0) + 1);
    });

    const enrichedAgents = agents?.map((agent: any) => ({
      ...agent,
      openPositions: posCountMap.get(agent.id) || 0,
      roi: agent.total_invested_sol > 0
        ? ((agent.total_profit_sol || 0) / agent.total_invested_sol * 100).toFixed(2)
        : "0.00",
      funding_progress: Math.min(100, ((agent.trading_capital_sol || 0) / 0.5) * 100),
      is_funded: (agent.trading_capital_sol || 0) >= 0.5,
    }));

    const { count } = await supabase
      .from("claw_trading_agents")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedAgents,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-trading-list] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
