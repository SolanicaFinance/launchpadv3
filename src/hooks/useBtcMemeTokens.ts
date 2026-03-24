import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BtcMemeToken {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  creator_wallet: string;
  price_btc: number;
  market_cap_btc: number;
  bonding_progress: number;
  holder_count: number;
  trade_count: number;
  volume_btc: number;
  status: string;
  created_at: string;
  real_btc_reserves: number;
  real_token_reserves: number;
  virtual_btc_reserves: number;
  virtual_token_reserves: number;
  graduation_threshold_btc: number;
  total_supply: number;
  genesis_txid: string | null;
  graduated_at: string | null;
}

export function useBtcMemeTokens() {
  return useQuery<BtcMemeToken[]>({
    queryKey: ["btc-meme-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("btc_meme_tokens")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as BtcMemeToken[];
    },
    refetchInterval: 15_000,
  });
}

export function useBtcMemeTokensAll() {
  return useQuery<BtcMemeToken[]>({
    queryKey: ["btc-meme-tokens-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("btc_meme_tokens")
        .select("*")
        .in("status", ["active", "graduated"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as BtcMemeToken[];
    },
    refetchInterval: 15_000,
  });
}

export function useBtcMemeToken(id: string | undefined) {
  return useQuery<BtcMemeToken | null>({
    queryKey: ["btc-meme-token", id],
    queryFn: async () => {
      if (!id) return null;
      // Try by UUID first
      const { data, error } = await supabase
        .from("btc_meme_tokens")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (data) return data as unknown as BtcMemeToken | null;
      // Fallback: try by genesis_txid
      const { data: byTx, error: txErr } = await supabase
        .from("btc_meme_tokens")
        .select("*")
        .eq("genesis_txid", id)
        .maybeSingle();
      if (txErr) throw txErr;
      return byTx as unknown as BtcMemeToken | null;
    },
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

export function useBtcMemeTrades(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["btc-meme-trades", tokenId],
    queryFn: async () => {
      if (!tokenId) return [];
      const { data, error } = await supabase
        .from("btc_meme_trades")
        .select("*")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tokenId,
    refetchInterval: 5_000,
  });
}

export function useBtcMemeBalance(tokenId: string | undefined, wallet: string | null) {
  return useQuery({
    queryKey: ["btc-meme-balance", tokenId, wallet],
    queryFn: async () => {
      if (!tokenId || !wallet) return null;
      const { data } = await supabase
        .from("btc_meme_balances")
        .select("*")
        .eq("token_id", tokenId)
        .eq("wallet_address", wallet)
        .maybeSingle();
      return data;
    },
    enabled: !!tokenId && !!wallet,
    refetchInterval: 5_000,
  });
}

export function useBtcTradingBalance(wallet: string | null) {
  return useQuery({
    queryKey: ["btc-trading-balance", wallet],
    queryFn: async () => {
      if (!wallet) return null;
      const { data } = await supabase
        .from("btc_trading_balances")
        .select("*")
        .eq("wallet_address", wallet)
        .maybeSingle();
      return data;
    },
    enabled: !!wallet,
    refetchInterval: 5_000,
  });
}

export function useBtcOnChainBalance(wallet: string | null) {
  return useQuery({
    queryKey: ["btc-onchain-balance", wallet],
    queryFn: async () => {
      if (!wallet) return 0;
      try {
        const res = await fetch(`https://mempool.space/api/address/${wallet}`);
        if (!res.ok) return 0;
        const data = await res.json();
        const confirmedSats = data.chain_stats?.funded_txo_sum - data.chain_stats?.spent_txo_sum || 0;
        const unconfirmedSats = data.mempool_stats?.funded_txo_sum - data.mempool_stats?.spent_txo_sum || 0;
        return (confirmedSats + unconfirmedSats) / 1e8;
      } catch {
        return 0;
      }
    },
    enabled: !!wallet,
    refetchInterval: 15_000,
  });
}