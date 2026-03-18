import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TokenPriceData {
  prices: Record<string, number>;
  changes24h: Record<string, number>;
}

export function useTokenPrices(mints: string[]) {
  return useQuery<TokenPriceData>({
    queryKey: ["token-prices", mints.sort().join(",")],
    enabled: mints.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-token-prices", {
        body: { mints },
      });
      if (error) throw error;
      return {
        prices: (data?.prices ?? {}) as Record<string, number>,
        changes24h: (data?.changes24h ?? {}) as Record<string, number>,
      };
    },
  });
}
