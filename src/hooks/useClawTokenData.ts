import { useQuery } from "@tanstack/react-query";

// Official CLAW token CA on Solana
export const SATURN_TOKEN_CA = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";

export interface SaturnTokenData {
  price: number;
  change24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  timestamp: number;
}

interface UseSaturnTokenDataOptions {
  enabled?: boolean;
}

export function useSaturnTokenData(options: UseSaturnTokenDataOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["claw-token-data", SATURN_TOKEN_CA],
    queryFn: async (): Promise<SaturnTokenData> => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dexscreener-proxy?token=${SATURN_TOKEN_CA}`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch CLAW token data");
      }

      const data = await response.json();
      
      return {
        price: data.price || 0,
        change24h: data.change24h || 0,
        marketCap: data.marketCap || 0,
        liquidity: data.liquidity || 0,
        volume24h: data.volume24h || 0,
        timestamp: data.timestamp || Date.now(),
      };
    },
    enabled,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}