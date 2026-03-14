import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computePositions, PositionSummary } from "@/lib/tradeUtils";

export type { PositionSummary } from "@/lib/tradeUtils";

export interface AlphaTrade {
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
  chain?: string | null;
  token_image_url?: string | null;
}

export function useAlphaTrades(limit = 50) {
  const [trades, setTrades] = useState<AlphaTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenImages, setTokenImages] = useState<Map<string, string>>(new Map());

  const fetchTrades = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("alpha_trades")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[useAlphaTrades] Query failed:", error.message);
      setLoading(false);
      return;
    }
    if (data) {
      const tradesData = data as AlphaTrade[];
      setTrades(tradesData);

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
          setTokenImages(imgMap);
        }
      }
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchTrades();

    const channel = supabase
      .channel("alpha-trades-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          const newTrade = payload.new as AlphaTrade;
          setTrades((prev) => [newTrade, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void fetchTrades();
    }, 5000);

    const onFocus = () => {
      void fetchTrades();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchTrades, limit]);

  const positions = useMemo(() => computePositions(trades), [trades]);

  const enrichedTrades = useMemo(() => {
    return trades.map((t) => {
      const dbImage = tokenImages.get(t.token_mint);
      const chain = t.chain === 'bnb' ? 'bsc' : 'solana';
      const dexScreenerFallback = `https://dd.dexscreener.com/ds-data/tokens/${chain}/${t.token_mint}.png`;
      return {
        ...t,
        token_image_url: dbImage || dexScreenerFallback,
      };
    });
  }, [trades, tokenImages]);

  return { trades: enrichedTrades, loading, positions };
}
