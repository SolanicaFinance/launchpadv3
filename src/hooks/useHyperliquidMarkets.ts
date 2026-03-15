import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { hlMetaAndAssetCtxs } from "@/lib/hyperliquid";

export interface HyperliquidMarket {
  symbol: string;       // e.g. "BTC" (coin name used in HL API)
  pair: string;         // e.g. "BTC/USDC"
  baseAsset: string;    // e.g. "BTC"
  quoteAsset: string;   // "USDC"
  pricePrecision: number;
  quantityPrecision: number;
  maxLeverage: number;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  markPrice: string;
  fundingRate: string;
  openInterest: string;
  assetIndex: number;
  szDecimals: number;
}

export function useHyperliquidMarkets() {
  const [markets, setMarkets] = useState<HyperliquidMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchMarkets = useCallback(async () => {
    try {
      const result = await hlMetaAndAssetCtxs();
      // result is [meta, assetCtxs[]]
      const [meta, assetCtxs] = result;
      
      if (!meta?.universe || !Array.isArray(assetCtxs)) {
        throw new Error("Invalid meta response");
      }

      const parsed: HyperliquidMarket[] = meta.universe.map((asset: any, idx: number) => {
        const ctx = assetCtxs[idx] || {};
        const markPx = parseFloat(ctx.markPx || "0");
        const prevDayPx = parseFloat(ctx.prevDayPx || "0");
        const dayNtlVlm = parseFloat(ctx.dayNtlVlm || "0");
        const change = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

        return {
          symbol: asset.name,
          pair: `${asset.name}/USDC`,
          baseAsset: asset.name,
          quoteAsset: "USDC",
          pricePrecision: 8,
          quantityPrecision: asset.szDecimals || 3,
          maxLeverage: asset.maxLeverage || 50,
          lastPrice: ctx.markPx || "0",
          priceChangePercent: change.toFixed(2),
          volume: (dayNtlVlm / Math.max(markPx, 1)).toFixed(2),
          quoteVolume: dayNtlVlm.toFixed(2),
          highPrice: ctx.markPx || "0", // HL doesn't provide 24h high/low directly
          lowPrice: ctx.markPx || "0",
          markPrice: ctx.markPx || "0",
          fundingRate: ctx.funding || "0",
          openInterest: ctx.openInterest || "0",
          assetIndex: idx,
          szDecimals: asset.szDecimals || 3,
        };
      });

      setMarkets(parsed);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    intervalRef.current = setInterval(fetchMarkets, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchMarkets]);

  const filtered = useMemo(() => {
    if (!search) return markets;
    const q = search.toLowerCase();
    return markets.filter((m) => m.symbol.toLowerCase().includes(q) || m.baseAsset.toLowerCase().includes(q));
  }, [markets, search]);

  return { markets: filtered, allMarkets: markets, loading, error, search, setSearch, refetch: fetchMarkets };
}
