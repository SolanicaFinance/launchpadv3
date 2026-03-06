import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SOLANA_NETWORK_ID = 1399811149;
export const BSC_NETWORK_ID = 56;

export interface CodexPairToken {
  address: string | null;
  name: string;
  symbol: string;
  imageUrl: string | null;
  marketCap: number;
  volume24h: number;
  change24h: number;
  holders: number;
  liquidity: number;
  graduationPercent: number;
  poolAddress: string | null;
  launchpadName: string;
  completed: boolean;
  migrated: boolean;
  completedAt: number | null;
  migratedAt: number | null;
  createdAt: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  telegramUrl: string | null;
  discordUrl: string | null;
  launchpadIconUrl: string | null;
}

async function fetchCodexTokens(column: "new" | "completing" | "completed", limit = 50, networkId = SOLANA_NETWORK_ID): Promise<CodexPairToken[]> {
  const { data, error } = await supabase.functions.invoke("codex-filter-tokens", {
    body: { column, limit, networkId },
  });
  if (error) throw error;
  return data?.tokens ?? [];
}

export function useCodexNewPairs(networkId: number = SOLANA_NETWORK_ID) {
  const newPairsQuery = useQuery({
    queryKey: ["codex-filter-tokens", "new", networkId],
    queryFn: () => fetchCodexTokens("new", 50, networkId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const completingQuery = useQuery({
    queryKey: ["codex-filter-tokens", "completing", networkId],
    queryFn: () => fetchCodexTokens("completing", 30, networkId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const completedQuery = useQuery({
    queryKey: ["codex-filter-tokens", "completed", networkId],
    queryFn: () => fetchCodexTokens("completed", 30, networkId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return {
    newPairs: newPairsQuery.data ?? [],
    completing: completingQuery.data ?? [],
    graduated: completedQuery.data ?? [],
    isLoading: newPairsQuery.isLoading || completingQuery.isLoading || completedQuery.isLoading,
    error: newPairsQuery.error || completingQuery.error || completedQuery.error,
  };
}
