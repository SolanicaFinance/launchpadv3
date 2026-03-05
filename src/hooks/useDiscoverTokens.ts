import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingToken {
  rank: number;
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  marketCap: number | null;
  volume24h: number | null;
  priceChange6h: number | null;
  priceUsd: string | null;
  liquidity: number | null;
  boostAmount: number;
  pairAddress: string | null;
  socialLinks: { type: string; url: string }[];
}

async function fetchTrendingTokens(): Promise<TrendingToken[]> {
  const { data, error } = await supabase.functions.invoke("dexscreener-trending");
  if (error) throw error;
  return data as TrendingToken[];
}

export function useDiscoverTokens() {
  return useQuery({
    queryKey: ["discover-trending"],
    queryFn: fetchTrendingTokens,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}
