import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SOLANA_NETWORK_ID } from "./useCodexNewPairs";

export interface ExternalToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  imageUrl: string | null;
  twitterUrl: string | null;
  websiteUrl: string | null;
  telegramUrl: string | null;
  discordUrl: string | null;
  graduationPercent: number | null;
  completed: boolean;
  migrated: boolean;
  holders: number;
  marketCapUsd: number;
  volume24hUsd: number;
  liquidity: number;
  change24h: number;
  priceUsd: number;
}

/**
 * Fetch token info from Codex for any Solana or BSC token address.
 * Used as fallback when a token is not in the platform's database.
 */
export function useExternalToken(mintAddress: string, enabled: boolean, networkId: number = SOLANA_NETWORK_ID) {
  return useQuery({
    queryKey: ["external-token", mintAddress, networkId],
    queryFn: async (): Promise<ExternalToken | null> => {
      const { data, error } = await supabase.functions.invoke("codex-token-info", {
        body: { address: mintAddress, networkId },
      });
      if (error) throw error;
      return data?.token ?? null;
    },
    enabled: enabled && !!mintAddress && mintAddress.length > 20,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
