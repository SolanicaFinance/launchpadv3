import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface TokenHolding {
  mint: string;
  balance: number;
  decimals: number;
}

/**
 * Fetches and merges token holdings across multiple wallet addresses.
 * Aggregates balances for the same mint across wallets.
 */
export function useMultiWalletHoldings(addresses: string[]) {
  const validAddresses = useMemo(() => addresses.filter(Boolean), [addresses]);

  const queries = useQueries({
    queries: validAddresses.map((addr) => ({
      queryKey: ["wallet-holdings", addr],
      enabled: !!addr,
      refetchInterval: 30_000,
      staleTime: 15_000,
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke(
          "fetch-wallet-holdings",
          { body: { walletAddress: addr } }
        );
        if (error) throw error;
        return (data?.holdings ?? []) as TokenHolding[];
      },
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  const merged = useMemo(() => {
    const map = new Map<string, TokenHolding>();
    for (const q of queries) {
      if (!q.data) continue;
      for (const h of q.data) {
        const existing = map.get(h.mint);
        if (existing) {
          existing.balance += h.balance;
        } else {
          map.set(h.mint, { ...h });
        }
      }
    }
    return Array.from(map.values());
  }, [queries.map((q) => q.dataUpdatedAt).join(",")]);

  return { data: merged, isLoading };
}
