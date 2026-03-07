import { useState, useEffect, useRef } from "react";

export interface OrderbookLevel {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderbookData {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  spreadPercent: number;
  midPrice: number;
}

const ASTER_BASE = "https://fapi.asterdex.com";
const WS_BASE = "wss://fstream.asterdex.com/ws";

function parseLevels(levels: [string, string][], ascending = true): OrderbookLevel[] {
  let total = 0;
  const sorted = levels
    .map(([p, q]) => ({ price: parseFloat(p), quantity: parseFloat(q) }))
    .filter((l) => l.quantity > 0)
    .sort((a, b) => ascending ? a.price - b.price : b.price - a.price);

  return sorted.map((l) => {
    total += l.quantity;
    return { ...l, total };
  });
}

export function useAsterOrderbook(symbol: string, depth = 20) {
  const [orderbook, setOrderbook] = useState<OrderbookData>({
    bids: [], asks: [], spread: 0, spreadPercent: 0, midPrice: 0,
  });
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial snapshot
  useEffect(() => {
    if (!symbol) return;

    fetch(`${ASTER_BASE}/fapi/v1/depth?symbol=${symbol}&limit=${depth}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.bids && data.asks) {
          const bids = parseLevels(data.bids, false);
          const asks = parseLevels(data.asks, true);
          const bestBid = bids[0]?.price || 0;
          const bestAsk = asks[0]?.price || 0;
          const mid = (bestBid + bestAsk) / 2;
          setOrderbook({
            bids, asks,
            spread: bestAsk - bestBid,
            spreadPercent: mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 0,
            midPrice: mid,
          });
        }
      })
      .catch(console.error);
  }, [symbol, depth]);

  // WebSocket for live depth
  useEffect(() => {
    if (!symbol) return;

    const stream = `${symbol.toLowerCase()}@depth10@100ms`;
    const ws = new WebSocket(`${WS_BASE}/${stream}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.b && data.a) {
          const bids = parseLevels(data.b, false);
          const asks = parseLevels(data.a, true);
          const bestBid = bids[0]?.price || 0;
          const bestAsk = asks[0]?.price || 0;
          const mid = (bestBid + bestAsk) / 2;
          setOrderbook({
            bids, asks,
            spread: bestAsk - bestBid,
            spreadPercent: mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 0,
            midPrice: mid,
          });
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol]);

  return orderbook;
}
