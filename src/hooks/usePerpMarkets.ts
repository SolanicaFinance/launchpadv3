import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PerpMarket {
  id: string;
  token_address: string;
  token_name: string;
  token_symbol: string;
  token_image_url: string | null;
  chain: string;
  dex_pair_address: string | null;
  dex_quote_token: string | null;
  max_leverage: number;
  max_position_usd: number;
  max_open_interest_usd: number;
  spread_pct: number;
  fee_pct: number;
  min_fee_usd: number;
  min_collateral_usd: number;
  vault_balance_usd: number;
  insurance_balance_usd: number;
  creator_wallet: string;
  creator_fee_share_pct: number;
  total_fees_earned_usd: number;
  total_volume_usd: number;
  total_trades: number;
  total_long_oi_usd: number;
  total_short_oi_usd: number;
  last_price_usd: number | null;
  last_price_updated_at: string | null;
  market_cap_usd: number | null;
  liquidity_usd: number | null;
  status: string;
  is_featured: boolean;
  created_by_admin: boolean;
  created_at: string;
}

export function usePerpMarkets() {
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    const { data, error } = await supabase
      .from("perp_markets")
      .select("*")
      .eq("status", "active")
      .order("total_volume_usd", { ascending: false });

    if (!error && data) {
      setMarkets(data as unknown as PerpMarket[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMarkets();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("perp_markets_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "perp_markets" },
        () => fetchMarkets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMarkets]);

  return { markets, loading, refetch: fetchMarkets };
}

export interface TokenLookupResult {
  address: string;
  name: string;
  symbol: string;
  pairAddress: string;
  quoteToken: string;
  priceUsd: string;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
}

export interface EligibilityCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export function usePerpTokenLookup() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<TokenLookupResult | null>(null);
  const [eligible, setEligible] = useState(false);
  const [checks, setChecks] = useState<EligibilityCheck[]>([]);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setToken(null);
    setEligible(false);
    setChecks([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("perp-oracle", {
        body: { action: "lookup", tokenAddress: address },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Lookup failed");

      setToken(data.token);
      setEligible(data.eligible);
      setChecks(data.eligibilityChecks);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setEligible(false);
    setChecks([]);
    setError(null);
  }, []);

  return { lookup, loading, token, eligible, checks, error, reset };
}
