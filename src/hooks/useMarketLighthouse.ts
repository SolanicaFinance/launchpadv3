import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChain } from "@/contexts/ChainContext";

export type LighthouseTimeframe = "5m" | "1h" | "6h" | "24h";

export interface MarketLighthouseData {
  timeframe?: string;
  chain?: string;
  totalVol24hUsd: number;
  volChange24h: number;
  solPrice: number;

  totalTrades: number;
  tradesChange: number;
  uniqueTraders: number;
  tradersChange: number;

  buyCount: number;
  buyVolUsd: number;
  buyVolSol: number;
  sellCount: number;
  sellVolUsd: number;
  sellVolSol: number;
  ownVolUsd: number;

  tokensCreated: number;
  created24h: number;
  createdChange: number;
  migrations: number;
  graduated24h: number;
  graduatedChange: number;

  topProtocols: Array<{ name: string; vol24hUsd: number; change: number }>;
  topLaunchpads: Array<{ type: string; vol24hUsd: number; vol24hSol: number }>;

  updatedAt: string;
}

export function useMarketLighthouse(timeframe: LighthouseTimeframe = "24h") {
  const { chain } = useChain();
  const apiChain = chain === "bnb" ? "bnb" : "solana";

  return useQuery<MarketLighthouseData>({
    queryKey: ["market-lighthouse", timeframe, apiChain],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("market-lighthouse", {
        body: { timeframe, chain: apiChain },
      });
      if (error) throw error;
      return data as MarketLighthouseData;
    },
    refetchInterval: 3 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}
