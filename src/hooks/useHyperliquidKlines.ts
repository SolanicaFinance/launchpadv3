import { useState, useEffect, useRef, useCallback } from "react";
import { hlCandles, HL_INTERVALS } from "@/lib/hyperliquid";

export interface KlineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type KlineInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "1d" | "1w";

export function useHyperliquidKlines(coin: string, interval: KlineInterval = "5m") {
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalTimerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchCandles = useCallback(async () => {
    if (!coin) return;
    try {
      // Fetch last ~500 candles
      const intervalMs: Record<string, number> = {
        "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
        "30m": 1_800_000, "1h": 3_600_000, "2h": 7_200_000,
        "4h": 14_400_000, "1d": 86_400_000, "1w": 604_800_000,
      };
      const candleMs = intervalMs[interval] || 300_000;
      const startTime = Date.now() - candleMs * 500;

      const hlInterval = HL_INTERVALS[interval] || interval;
      const data = await hlCandles(coin, hlInterval, startTime);

      if (Array.isArray(data)) {
        const parsed: KlineBar[] = data.map((c: any) => ({
          time: Math.floor(c.t / 1000), // epoch seconds for lightweight-charts
          open: parseFloat(c.o),
          high: parseFloat(c.h),
          low: parseFloat(c.l),
          close: parseFloat(c.c),
          volume: parseFloat(c.v),
        }));
        setBars(parsed);
      }
    } catch (err) {
      console.error("[useHyperliquidKlines] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [coin, interval]);

  useEffect(() => {
    setLoading(true);
    fetchCandles();
    // Poll every 5 seconds for live updates (HL doesn't have public WS for candles)
    intervalTimerRef.current = setInterval(fetchCandles, 5000);
    return () => clearInterval(intervalTimerRef.current);
  }, [fetchCandles]);

  return { bars, loading };
}
