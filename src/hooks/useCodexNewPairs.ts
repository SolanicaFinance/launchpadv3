import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SOLANA_NETWORK_ID = 1399811149;
export const BSC_NETWORK_ID = 56;

const NEW_PAIRS_MAX_AGE_HOURS = 24;
const NEW_PAIRS_MAX_AGE_MS = NEW_PAIRS_MAX_AGE_HOURS * 60 * 60 * 1000;

export interface CodexPairToken {
  address: string | null;
  name: string;
  symbol: string;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
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

function toTimestampMs(raw: string | number | null): number | null {
  if (raw == null) return null;

  if (typeof raw === "number") {
    return raw < 1e12 ? raw * 1000 : raw;
  }

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) {
    return asNumber < 1e12 ? asNumber * 1000 : asNumber;
  }

  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

async function fetchCodexTokens(column: "new" | "completing" | "completed", limit = 50, networkId = SOLANA_NETWORK_ID): Promise<CodexPairToken[]> {
  const { data, error } = await supabase.functions.invoke("codex-filter-tokens", {
    body: { column, limit, networkId },
  });
  if (error) throw error;
  return data?.tokens ?? [];
}

export function useCodexNewPairs(networkId: number = SOLANA_NETWORK_ID) {
  const isBsc = networkId === BSC_NETWORK_ID;
  const newLimit = isBsc ? 100 : 50;
  const completingLimit = isBsc ? 50 : 30;
  const completedLimit = isBsc ? 50 : 30;

  const newPairsQuery = useQuery({
    queryKey: ["codex-filter-tokens", "new", networkId, newLimit],
    queryFn: () => fetchCodexTokens("new", newLimit, networkId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const completingQuery = useQuery({
    queryKey: ["codex-filter-tokens", "completing", networkId, completingLimit],
    queryFn: () => fetchCodexTokens("completing", completingLimit, networkId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const completedQuery = useQuery({
    queryKey: ["codex-filter-tokens", "completed", networkId, completedLimit],
    queryFn: () => fetchCodexTokens("completed", completedLimit, networkId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const recentNewPairs = useMemo(() => {
    const now = Date.now();

    return (newPairsQuery.data ?? [])
      .filter((token) => {
        const createdMs = toTimestampMs(token.createdAt);
        if (createdMs == null) return false;
        const ageMs = now - createdMs;
        return ageMs >= 0 && ageMs <= NEW_PAIRS_MAX_AGE_MS;
      })
      .sort((a, b) => (toTimestampMs(b.createdAt) ?? 0) - (toTimestampMs(a.createdAt) ?? 0));
  }, [newPairsQuery.data]);

  return {
    newPairs: recentNewPairs,
    completing: completingQuery.data ?? [],
    graduated: completedQuery.data ?? [],
    isLoading: newPairsQuery.isLoading || completingQuery.isLoading || completedQuery.isLoading,
    error: newPairsQuery.error || completingQuery.error || completedQuery.error,
  };
}

