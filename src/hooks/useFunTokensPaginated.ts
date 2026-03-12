import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { useEffect, useCallback } from "react";
import { useChain } from "@/contexts/ChainContext";

const DEFAULT_LIVE = {
  holder_count: 0,
  market_cap_sol: 30,
  bonding_progress: 0,
  price_sol: 0.00000003,
};

export interface FunToken {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  creator_wallet: string;
  twitter_url?: string | null;
  website_url?: string | null;
  twitter_avatar_url?: string | null;
  twitter_verified?: boolean;
  twitter_verified_type?: string | null;
  mint_address: string | null;
  dbc_pool_address: string | null;
  status: string;
  price_sol: number;
  price_change_24h?: number | null;
  volume_24h_sol: number;
  total_fees_earned: number;
  holder_count?: number;
  market_cap_sol?: number;
  bonding_progress?: number;
  trading_fee_bps?: number;
  fee_mode?: string | null;
  agent_id?: string | null;
  launchpad_type?: string | null;
  last_distribution_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseFunTokensPaginatedResult {
  tokens: FunToken[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Fetch a specific page of tokens with exact count
async function fetchTokensPage(page: number, pageSize: number, chainFilter: "solana" | "bnb"): Promise<{ tokens: FunToken[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("fun_tokens")
    .select(`
      id, name, ticker, description, image_url, creator_wallet, twitter_url, website_url,
      twitter_avatar_url, twitter_verified, twitter_verified_type,
      mint_address, dbc_pool_address, status, price_sol, price_change_24h, volume_24h_sol,
      total_fees_earned, holder_count, market_cap_sol, bonding_progress,
      trading_fee_bps, fee_mode, agent_id, launchpad_type, last_distribution_at, created_at, updated_at
    `, { count: "exact" })
    .neq("launchpad_type", "punch")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (chainFilter === "bnb") {
    query = query.eq("chain", "bsc");
  } else {
    query = query.or("chain.is.null,chain.eq.solana");
  }

  const { data, count, error } = await query;

  if (error) throw error;

  const mapped = (data || []).map((t) => ({
    ...t,
    holder_count: t.holder_count ?? DEFAULT_LIVE.holder_count,
    market_cap_sol: t.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
    bonding_progress: t.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
    price_sol: t.price_sol ?? DEFAULT_LIVE.price_sol,
  })) as FunToken[];

  return {
    tokens: filterHiddenTokens(mapped),
    count: count ?? 0,
  };
}

export function useFunTokensPaginated(page: number, pageSize: number = 15): UseFunTokensPaginatedResult {
  const queryClient = useQueryClient();
  const { chain } = useChain();
  const chainFilter = chain === "bnb" ? "bnb" : "solana";
  const queryKey = ["fun-tokens-page", page, pageSize, chainFilter];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchTokensPage(page, pageSize, chainFilter),
    staleTime: 1000 * 60 * 2, // 2 minutes fresh
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 60, // Refresh every 60s
  });

  // Realtime subscription to invalidate cache on changes
  useEffect(() => {
    const channel = supabase
      .channel(`fun-tokens-page-${page}-${chainFilter}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fun_tokens",
        },
        (payload) => {
          // For INSERT events, invalidate page 1 (new tokens appear first)
          if (payload.eventType === "INSERT") {
            queryClient.invalidateQueries({ queryKey: ["fun-tokens-page", 1, pageSize, chainFilter] });
          }
          // For UPDATE/DELETE, invalidate current page
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, pageSize, queryClient, queryKey, chainFilter]);

  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    tokens: data?.tokens ?? [],
    totalCount: data?.count ?? 0,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch tokens") : null,
    refetch: handleRefetch,
  };
}
