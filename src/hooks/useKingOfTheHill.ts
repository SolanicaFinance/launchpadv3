import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { useEffect } from "react";
import { useBackgroundPoolRefresh } from "@/hooks/useBackgroundPoolRefresh";
import { useChain } from "@/contexts/ChainContext";

const DEFAULT_LIVE = {
  holder_count: 0,
  market_cap_sol: 30,
  bonding_progress: 0,
  price_sol: 0.00000003,
};

export interface KingToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  dbc_pool_address: string | null;
  status: string;
  bonding_progress?: number;
  market_cap_sol?: number;
  holder_count?: number;
  trading_fee_bps?: number;
  fee_mode?: string | null;
  agent_id?: string | null;
  launchpad_type?: string | null;
  trading_agent_id?: string | null;
  is_trading_agent_token?: boolean;
  creator_wallet?: string | null;
  twitter_url?: string | null;
  twitter_avatar_url?: string | null;
  twitter_verified?: boolean;
  twitter_verified_type?: string | null;
  telegram_url?: string | null;
  website_url?: string | null;
  discord_url?: string | null;
  created_at: string;
  // Live Codex data (USD-denominated)
  codex_market_cap_usd?: number;
  codex_holders?: number;
  codex_volume_24h_usd?: number;
  codex_change_24h?: number;
  codex_graduation_percent?: number;
}

interface UseKingOfTheHillResult {
  tokens: KingToken[];
  isLoading: boolean;
  error: string | null;
}

const selectFields = `
  id, name, ticker, image_url, mint_address, dbc_pool_address, status,
  bonding_progress, market_cap_sol, holder_count, trading_fee_bps, fee_mode,
  agent_id, launchpad_type, trading_agent_id, is_trading_agent_token, created_at,
  creator_wallet, twitter_url, twitter_avatar_url, twitter_verified, twitter_verified_type,
  telegram_url, website_url, discord_url
`;

function applyChainFilter(query: any, chainFilter: "solana" | "bnb") {
  if (chainFilter === "bnb") {
    return query.eq("chain", "bsc");
  }
  return query.or("chain.is.null,chain.eq.solana");
}

// Fetch top tokens by bonding progress + newest trading agent token
async function fetchKingOfTheHill(chainFilter: "solana" | "bnb"): Promise<KingToken[]> {
  // Fetch top 3 by bonding progress
  let topQuery = supabase
    .from("fun_tokens")
    .select(selectFields)
    .eq("status", "active")
    .neq("launchpad_type", "punch")
    .order("bonding_progress", { ascending: false })
    .limit(3);

  topQuery = applyChainFilter(topQuery, chainFilter);
  const { data: topTokens, error: topError } = await topQuery;

  if (topError) throw topError;

  // Fetch newest trading agent token (last 24 hours) for guaranteed visibility
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let agentQuery = supabase
    .from("fun_tokens")
    .select(selectFields)
    .eq("status", "active")
    .eq("is_trading_agent_token", true)
    .neq("launchpad_type", "punch")
    .gte("created_at", oneDayAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  agentQuery = applyChainFilter(agentQuery, chainFilter);
  const { data: newestTradingAgent } = await agentQuery;

  // Merge: top tokens + newest trading agent (deduplicated)
  const merged = [...(topTokens || [])];
  if (newestTradingAgent?.[0]) {
    const exists = merged.some((t) => t.id === newestTradingAgent[0].id);
    if (!exists) {
      merged.push(newestTradingAgent[0]);
    }
  }

  const mapped = merged.slice(0, 3).map((t) => ({
    ...t,
    holder_count: t.holder_count ?? DEFAULT_LIVE.holder_count,
    market_cap_sol: t.market_cap_sol ?? DEFAULT_LIVE.market_cap_sol,
    bonding_progress: t.bonding_progress ?? DEFAULT_LIVE.bonding_progress,
  })) as KingToken[];

  return filterHiddenTokens(mapped);
}

// Fetch live Codex data for the king tokens
async function fetchCodexLiveData(addresses: string[]): Promise<Record<string, any>> {
  if (addresses.length === 0) return {};

  try {
    const { data, error } = await supabase.functions.invoke("codex-king-data", {
      body: { addresses },
    });

    if (error) {
      console.error("[KingOfTheHill] Codex live data error:", error);
      return {};
    }

    return data?.tokens ?? {};
  } catch (err) {
    console.error("[KingOfTheHill] Codex fetch failed:", err);
    return {};
  }
}

export function useKingOfTheHill(): UseKingOfTheHillResult {
  const queryClient = useQueryClient();
  const { chain } = useChain();
  const chainFilter = chain === "bnb" ? "bnb" : "solana";

  const QUERY_KEY = ["king-of-the-hill", chainFilter];
  const CODEX_QUERY_KEY = ["king-of-the-hill-codex", chainFilter];

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchKingOfTheHill(chainFilter),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchInterval: 1000 * 30,
  });

  // Proactively refresh pool state for visible king tokens (Solana only)
  useBackgroundPoolRefresh(chainFilter === "solana" ? (data ?? []) : []);

  // Fetch live Codex data for the king tokens (separate query to avoid blocking)
  const mintAddresses = (data ?? [])
    .map(t => t.mint_address)
    .filter((a): a is string => !!a);

  const { data: codexData } = useQuery({
    queryKey: [...CODEX_QUERY_KEY, ...mintAddresses],
    queryFn: () => fetchCodexLiveData(mintAddresses),
    enabled: mintAddresses.length > 0 && chainFilter === "solana", // Codex only for Solana
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 20,
    refetchOnWindowFocus: false,
  });

  // Merge Codex live data into tokens
  const enrichedTokens: KingToken[] = (data ?? []).map(token => {
    const codex = codexData?.[token.mint_address ?? ""];
    if (!codex) return token;

    return {
      ...token,
      codex_market_cap_usd: codex.marketCap || undefined,
      codex_holders: codex.holders || undefined,
      codex_volume_24h_usd: codex.volume24h || undefined,
      codex_change_24h: codex.change24h || undefined,
      codex_graduation_percent: codex.graduationPercent ?? undefined,
      // Override DB values with Codex if available
      holder_count: codex.holders > 0 ? codex.holders : token.holder_count,
      bonding_progress: codex.graduationPercent != null ? codex.graduationPercent : token.bonding_progress,
    };
  });

  // Realtime subscription to invalidate on token changes
  useEffect(() => {
    const channel = supabase
      .channel(`king-of-hill-realtime-${chainFilter}`)
      .on(
        "postgres_changes",
        {
          event: "*",
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
    tokens: enrichedTokens,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch") : null,
  };
}
