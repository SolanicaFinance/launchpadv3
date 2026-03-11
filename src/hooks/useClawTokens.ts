import { useQuery } from "@tanstack/react-query";

export type SaturnTokenSort = "new" | "hot" | "mcap" | "volume";

interface ClawToken {
  id: string;
  agentId: string;
  agentName: string;
  agentWallet: string;
  funTokenId: string;
  sourcePlatform: string;
  sourcePostUrl: string | null;
  createdAt: string;
  token: {
    id: string;
    name: string;
    ticker: string;
    mintAddress: string;
    description: string | null;
    imageUrl: string | null;
    marketCapSol: number;
    volume24hSol: number;
    priceChange24h: number;
    priceSol: number;
    holderCount: number;
    bondingProgress: number;
    createdAt: string;
    launchpadType: string | null;
  } | null;
}

interface UseClawTokensOptions {
  sort?: SaturnTokenSort;
  limit?: number;
}

export function useSaturnTokens(options: UseClawTokensOptions = {}) {
  const { sort = "new", limit = 50 } = options;

  return useQuery({
    queryKey: ["claw-tokens", sort, limit],
    queryFn: async (): Promise<ClawToken[]> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/claw-tokens?sort=${sort}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch claw tokens`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch claw tokens");
      }

      return result.tokens || [];
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
