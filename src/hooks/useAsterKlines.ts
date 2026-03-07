import { useState, useEffect, useRef, useCallback } from "react";

export interface KlineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const ASTER_BASE = "https://fapi.asterdex.com";
const WS_BASE = "wss://fstream.asterdex.com/ws";

export type KlineInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "1d" | "1w";

export function useAsterKlines(symbol: string, interval: KlineInterval = "5m") {
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const barsRef = useRef<KlineBar[]>([]);

  const parseKline = useCallback((k: any[]): KlineBar => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }), []);

  // Fetch initial klines
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);

    fetch(`${ASTER_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=500`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const parsed = data.map(parseKline);
          barsRef.current = parsed;
          setBars(parsed);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [symbol, interval, parseKline]);

  // WebSocket for live updates
  useEffect(() => {
    if (!symbol) return;

    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    const ws = new WebSocket(`${WS_BASE}/${stream}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.k) {
          const k = msg.k;
          const bar: KlineBar = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };

          const existing = barsRef.current;
          const lastIdx = existing.findIndex((b) => b.time === bar.time);
          if (lastIdx >= 0) {
            existing[lastIdx] = bar;
          } else {
            existing.push(bar);
          }
          barsRef.current = [...existing];
          setBars(barsRef.current);
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol, interval]);

  return { bars, loading };
}
