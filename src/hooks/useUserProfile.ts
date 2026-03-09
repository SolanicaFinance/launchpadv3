import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { computePositions, PositionSummary } from "@/lib/tradeUtils";

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
  verified_type: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
  solana_wallet_address: string | null;
}

export interface CreatedToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  market_cap_sol: number | null;
  status: string | null;
  created_at: string;
}

export interface UserTrade {
  id: string;
  transaction_type: string;
  sol_amount: number;
  token_amount: number;
  price_per_token: number | null;
  created_at: string;
  token_id: string;
  signature: string | null;
}

export interface AlphaTradeRecord {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: string;
  amount_sol: number;
  amount_tokens: number;
  price_usd: number | null;
  price_sol: number | null;
  tx_hash: string;
  created_at: string;
  trader_display_name: string | null;
  trader_avatar_url: string | null;
  token_image_url?: string | null;
}

export interface TradingStats {
  totalPnl: number;
  realizedPnl: number;
  totalBuys: number;
  totalSells: number;
  totalBuySol: number;
  totalSellSol: number;
  positions: Map<string, PositionSummary>;
  pnlDistribution: { label: string; count: number; color: string }[];
}

function isWalletAddress(identifier: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier);
}

function computeTradingStats(trades: AlphaTradeRecord[], positions: Map<string, PositionSummary>): TradingStats {
  let totalBuys = 0, totalSells = 0, totalBuySol = 0, totalSellSol = 0;
  
  for (const t of trades) {
    if (t.trade_type === "buy") {
      totalBuys++;
      totalBuySol += t.amount_sol;
    } else {
      totalSells++;
      totalSellSol += t.amount_sol;
    }
  }

  let realizedPnl = 0;
  const pnlBuckets = { gt500: 0, gt200: 0, gt0: 0, gtNeg50: 0, ltNeg50: 0 };
  
  for (const pos of positions.values()) {
    realizedPnl += pos.realized_pnl_sol;
    if (pos.total_bought_sol > 0 && pos.total_sold_sol > 0) {
      const pctReturn = ((pos.total_sold_sol - (pos.avg_buy_price_sol * pos.total_sold_tokens)) / (pos.avg_buy_price_sol * pos.total_sold_tokens)) * 100;
      if (pctReturn > 500) pnlBuckets.gt500++;
      else if (pctReturn > 200) pnlBuckets.gt200++;
      else if (pctReturn >= 0) pnlBuckets.gt0++;
      else if (pctReturn >= -50) pnlBuckets.gtNeg50++;
      else pnlBuckets.ltNeg50++;
    }
  }

  return {
    totalPnl: realizedPnl,
    realizedPnl,
    totalBuys,
    totalSells,
    totalBuySol,
    totalSellSol,
    positions,
    pnlDistribution: [
      { label: ">500%", count: pnlBuckets.gt500, color: "bg-green-500" },
      { label: "200-500%", count: pnlBuckets.gt200, color: "bg-green-400" },
      { label: "0-200%", count: pnlBuckets.gt0, color: "bg-emerald-400" },
      { label: "0 to -50%", count: pnlBuckets.gtNeg50, color: "bg-orange-400" },
      { label: "< -50%", count: pnlBuckets.ltNeg50, color: "bg-red-500" },
    ],
  };
}

export function useUserProfile(identifier: string | undefined) {
  const profileQuery = useQuery({
    queryKey: ["user-profile", identifier],
    queryFn: async () => {
      if (!identifier) throw new Error("No identifier");

      let query = supabase.from("profiles").select("*");

      if (isWalletAddress(identifier)) {
        query = query.eq("solana_wallet_address", identifier);
      } else {
        query = query.eq("username", identifier);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Profile not found");
      return data as UserProfile;
    },
    enabled: !!identifier,
  });

  const wallet = profileQuery.data?.solana_wallet_address;
  const profileId = profileQuery.data?.id;

  const tokensQuery = useQuery({
    queryKey: ["user-profile-tokens", wallet],
    queryFn: async () => {
      if (!wallet) return [];
      const { data, error } = await supabase
        .from("fun_tokens")
        .select("id, name, ticker, image_url, mint_address, market_cap_sol, status, created_at")
        .eq("creator_wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CreatedToken[];
    },
    enabled: !!wallet,
  });

  const tradesQuery = useQuery({
    queryKey: ["user-profile-trades", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("launchpad_transactions")
        .select("id, transaction_type, sol_amount, token_amount, price_per_token, created_at, token_id, signature")
        .eq("user_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as UserTrade[];
    },
    enabled: !!profileId,
  });

  // Alpha trades for this wallet
  const alphaTradesQuery = useQuery({
    queryKey: ["user-alpha-trades", wallet],
    queryFn: async () => {
      if (!wallet) return [];
      const { data, error } = await (supabase as any)
        .from("alpha_trades")
        .select("*")
        .eq("wallet_address", wallet)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const tradesData = (data ?? []) as AlphaTradeRecord[];

      // Fetch token images
      const mints = [...new Set(tradesData.map((t) => t.token_mint).filter(Boolean))];
      if (mints.length > 0) {
        const { data: tokens } = await supabase
          .from("tokens")
          .select("mint_address, image_url")
          .in("mint_address", mints);
        if (tokens) {
          const imgMap = new Map<string, string>();
          for (const t of tokens) {
            if (t.image_url) imgMap.set(t.mint_address, t.image_url);
          }
          return tradesData.map((t) => ({
            ...t,
            token_image_url: imgMap.get(t.token_mint) || null,
          }));
        }
      }
      return tradesData;
    },
    enabled: !!wallet,
  });

  const alphaTrades = alphaTradesQuery.data ?? [];
  const alphaPositions = useMemo(() => computePositions(alphaTrades), [alphaTrades]);
  const tradingStats = useMemo(() => computeTradingStats(alphaTrades, alphaPositions), [alphaTrades, alphaPositions]);

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    tokens: tokensQuery.data ?? [],
    tokensLoading: tokensQuery.isLoading,
    trades: tradesQuery.data ?? [],
    tradesLoading: tradesQuery.isLoading,
    alphaTrades,
    alphaTradesLoading: alphaTradesQuery.isLoading,
    alphaPositions,
    tradingStats,
  };
}
