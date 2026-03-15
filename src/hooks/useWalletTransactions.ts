import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WalletTransaction {
  signature: string;
  type: "send" | "receive" | "swap" | "fee_payout" | "unknown";
  timestamp: number;
  fee: number;
  status: "success" | "failed";
  description: string;
  amount?: number;
  token?: string;
  counterparty?: string;
  label?: string;
  tokenName?: string;
}

export function useWalletTransactions(walletAddress: string | null | undefined, limit = 20) {
  return useQuery<WalletTransaction[]>({
    queryKey: ["wallet-transactions", walletAddress, limit],
    enabled: !!walletAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-wallet-transactions", {
        body: { walletAddress, limit },
      });
      if (error) throw error;
      return (data?.transactions ?? []) as WalletTransaction[];
    },
  });
}
