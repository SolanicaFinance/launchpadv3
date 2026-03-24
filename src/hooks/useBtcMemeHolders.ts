import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BtcMemeHolder {
  wallet_address: string;
  balance: number;
  total_bought: number;
  total_sold: number;
  avg_buy_price_btc: number;
  percentage: number;
  is_creator?: boolean;
}

export function useBtcMemeHolders(tokenId: string | undefined, totalSupply: number = 1_000_000_000, creatorWallet?: string) {
  return useQuery<BtcMemeHolder[]>({
    queryKey: ["btc-meme-holders", tokenId, creatorWallet],
    queryFn: async () => {
      if (!tokenId) return [];
      const { data, error } = await supabase
        .from("btc_meme_balances")
        .select("wallet_address, balance, total_bought, total_sold, avg_buy_price_btc")
        .eq("token_id", tokenId)
        .gte("balance", 1)
        .order("balance", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((h: any) => ({
        ...h,
        total_bought: h.total_bought ?? 0,
        total_sold: h.total_sold ?? 0,
        avg_buy_price_btc: h.avg_buy_price_btc ?? 0,
        percentage: totalSupply > 0 ? (h.balance / totalSupply) * 100 : 0,
        is_creator: creatorWallet ? h.wallet_address === creatorWallet : false,
      }));
    },
    enabled: !!tokenId,
    refetchInterval: 10_000,
  });
}
