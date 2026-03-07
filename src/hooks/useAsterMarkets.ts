import { useState, useEffect, useCallback, useRef } from "react";

export interface AsterMarket {
  symbol: string;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
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
}

const ASTER_BASE = "https://fapi.asterdex.com";

export function useAsterMarkets() {
  const [markets, setMarkets] = useState<AsterMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchMarkets = useCallback(async () => {
    try {
      const [exchangeRes, tickerRes, premiumRes] = await Promise.all([
        fetch(`${ASTER_BASE}/fapi/v1/exchangeInfo`),
        fetch(`${ASTER_BASE}/fapi/v1/ticker/24hr`),
        fetch(`${ASTER_BASE}/fapi/v1/premiumIndex`),
      ]);

      if (!exchangeRes.ok || !tickerRes.ok) throw new Error("Failed to fetch market data");

      const exchangeInfo = await exchangeRes.json();
      const tickers = await tickerRes.json();
      const premiums = premiumRes.ok ? await premiumRes.json() : [];

      const tickerMap = new Map<string, any>();
      (Array.isArray(tickers) ? tickers : []).forEach((t: any) => tickerMap.set(t.symbol, t));

      const premiumMap = new Map<string, any>();
      (Array.isArray(premiums) ? premiums : []).forEach((p: any) => premiumMap.set(p.symbol, p));

      const symbols = (exchangeInfo.symbols || [])
        .filter((s: any) => s.status === "TRADING" && s.contractType === "PERPETUAL")
        .map((s: any) => {
          const ticker = tickerMap.get(s.symbol) || {};
          const premium = premiumMap.get(s.symbol) || {};
          const leverageFilter = (s.filters || []).find((f: any) => f.filterType === "MAX_LEVERAGE");
          return {
            symbol: s.symbol,
            pair: s.pair || s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            pricePrecision: s.pricePrecision || 2,
            quantityPrecision: s.quantityPrecision || 3,
            maxLeverage: leverageFilter?.maxLeverage || 125,
            lastPrice: ticker.lastPrice || "0",
            priceChangePercent: ticker.priceChangePercent || "0",
            volume: ticker.volume || "0",
            quoteVolume: ticker.quoteVolume || "0",
            highPrice: ticker.highPrice || "0",
            lowPrice: ticker.lowPrice || "0",
            markPrice: premium.markPrice || ticker.lastPrice || "0",
            fundingRate: premium.lastFundingRate || "0",
            openInterest: premium.openInterest || "0",
          } as AsterMarket;
        });

      setMarkets(symbols);
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

  const filtered = search
    ? markets.filter((m) => m.symbol.toLowerCase().includes(search.toLowerCase()) || m.baseAsset.toLowerCase().includes(search.toLowerCase()))
    : markets;

  return { markets: filtered, allMarkets: markets, loading, error, search, setSearch, refetch: fetchMarkets };
}
