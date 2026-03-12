import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { useEffect } from "react";
import { useBackgroundPoolRefresh } from "@/hooks/useBackgroundPoolRefresh";
import { useChain } from "@/contexts/ChainContext";

export interface JustLaunchedToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  market_cap_sol?: number | null;
  agent_id?: string | null;
  status?: string | null;
  launchpad_type?: string | null;
  trading_agent_id?: string | null;
  is_trading_agent_token?: boolean;
  creator_wallet?: string | null;
  created_at: string;
}

interface UseJustLaunchedResult {
  tokens: JustLaunchedToken[];
  isLoading: boolean;
  error: string | null;
}

// Fetch tokens from last 48 hours (with 24h as primary, fallback to 48h if empty)
async function fetchJustLaunched(chainFilter: "solana" | "bnb"): Promise<JustLaunchedToken[]> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const applyChainFilter = (query: any) => {
    if (chainFilter === "bnb") {
      return query.eq("chain", "bsc");
    }
    // Solana: chain is null or 'solana'
    return query.or("chain.is.null,chain.eq.solana");
  };

  // Try 24h first
  let query24 = supabase
    .from("fun_tokens")
    .select(`
      id, name, ticker, image_url, mint_address, market_cap_sol,
      agent_id, status, launchpad_type, trading_agent_id, is_trading_agent_token,
      creator_wallet, created_at
    `)
    .neq("launchpad_type", "punch")
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  query24 = applyChainFilter(query24);
  const { data: data24h, error } = await query24;

  if (error) throw error;

  const filtered24h = filterHiddenTokens(data24h || []) as JustLaunchedToken[];
  if (filtered24h.length > 0) return filtered24h;

  // Fallback to 48h if no 24h results
  let query48 = supabase
    .from("fun_tokens")
    .select(`
      id, name, ticker, image_url, mint_address, market_cap_sol,
      agent_id, status, launchpad_type, trading_agent_id, is_trading_agent_token,
      creator_wallet, created_at
    `)
    .neq("launchpad_type", "punch")
    .gte("created_at", fortyEightHoursAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  query48 = applyChainFilter(query48);
  const { data: data48h, error: error48h } = await query48;

  if (error48h) throw error48h;

  return filterHiddenTokens(data48h || []) as JustLaunchedToken[];
}

export function useJustLaunched(): UseJustLaunchedResult {
  const queryClient = useQueryClient();
  const { chain } = useChain();
  const chainFilter = chain === "bnb" ? "bnb" : "solana";
  const QUERY_KEY = ["just-launched", chainFilter];

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchJustLaunched(chainFilter),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 60,
  });

  // Proactively refresh pool state for visible tokens (Solana only)
  useBackgroundPoolRefresh(chainFilter === "solana" ? (data ?? []) : []);

  // Realtime subscription for new tokens
  useEffect(() => {
    const channel = supabase
      .channel(`just-launched-realtime-${chainFilter}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fun_tokens",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, chainFilter]);

  return {
    tokens: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch") : null,
  };
}
