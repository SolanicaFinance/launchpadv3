import { useQuery } from "@tanstack/react-query";
import type { TradingAgent } from "@/hooks/useTradingAgents";

export function useSaturnTradingAgents(options?: {
  sortBy?: string;
  status?: string;
  strategy?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["claw-trading-agents", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.sortBy) params.set("sortBy", options.sortBy);
      if (options?.status) params.set("status", options.status);
      if (options?.strategy) params.set("strategy", options.strategy);
      if (options?.limit) params.set("limit", String(options.limit));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-trading-list?${params}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch claw trading agents");
      }

      const data = await response.json();
      return data.data as TradingAgent[];
    },
    staleTime: 30 * 1000,
  });
}

export function useSaturnTradingAgentLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ["claw-trading-agent-leaderboard", limit],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-trading-list?sortBy=total_profit_sol&status=active&limit=${limit}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch claw trading leaderboard");
      }

      const data = await response.json();
      return (data.data || []).map((agent: any, index: number) => ({
        ...agent,
        rank: index + 1,
        roi: agent.trading_capital_sol > 0
          ? ((agent.total_profit_sol || 0) / agent.trading_capital_sol * 100).toFixed(2)
          : "0.00",
      }));
    },
    staleTime: 60 * 1000,
  });
}
