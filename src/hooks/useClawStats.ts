import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout, getCachedData, setCachedData, TimeoutError } from "@/lib/fetchWithTimeout";

interface ClawStats {
  totalMarketCap: number;
  totalAgentFeesEarned: number;
  totalTokensLaunched: number;
  totalVolume: number;
  totalAgents: number;
  totalAgentPosts: number;
  totalAgentPayouts: number;
}

const DEFAULT_STATS: ClawStats = {
  totalMarketCap: 0,
  totalAgentFeesEarned: 0,
  totalTokensLaunched: 0,
  totalVolume: 0,
  totalAgents: 0,
  totalAgentPosts: 0,
  totalAgentPayouts: 0,
};

const CACHE_KEY = "claw_stats";

export function useSaturnStats() {
  return useQuery({
    queryKey: ["claw-stats"],
    queryFn: async (): Promise<ClawStats> => {
      try {
        const result = await withTimeout(
          supabase.functions.invoke("claw-stats"),
          15000
        );

        const { data, error } = result;

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.success) {
          throw new Error(data?.error || "Failed to fetch claw stats");
        }

        setCachedData(CACHE_KEY, data.stats);
        return data.stats;
      } catch (err) {
        const cached = getCachedData<ClawStats>(CACHE_KEY);
        if (cached) {
          console.log("[useSaturnStats] Returning cached stats due to error");
          return cached;
        }

        if (err instanceof TimeoutError) {
          console.log("[useSaturnStats] Timeout, returning defaults");
          return DEFAULT_STATS;
        }

        throw err;
      }
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    retry: 1,
    retryDelay: 2000,
    placeholderData: () => getCachedData<ClawStats>(CACHE_KEY) || DEFAULT_STATS,
  });
}
