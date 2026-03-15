import { useState, useEffect, useRef } from "react";
import { hlL2Book } from "@/lib/hyperliquid";

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

function parseLevels(levels: { px: string; sz: string; n: number }[], ascending = true): OrderbookLevel[] {
  let total = 0;
  const sorted = levels
    .map((l) => ({ price: parseFloat(l.px), quantity: parseFloat(l.sz) }))
    .filter((l) => l.quantity > 0)
    .sort((a, b) => ascending ? a.price - b.price : b.price - a.price);

  return sorted.map((l) => {
    total += l.quantity;
    return { ...l, total };
  });
}

export function useHyperliquidOrderbook(coin: string, depth = 20) {
  const [orderbook, setOrderbook] = useState<OrderbookData>({
    bids: [], asks: [], spread: 0, spreadPercent: 0, midPrice: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!coin) return;

    const fetchBook = async () => {
      try {
        const data = await hlL2Book(coin);
        if (data?.levels) {
          const [rawBids, rawAsks] = data.levels;
          const bids = parseLevels(rawBids || [], false).slice(0, depth);
          const asks = parseLevels(rawAsks || [], true).slice(0, depth);
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
      } catch (err) {
        console.error("[useHyperliquidOrderbook] Error:", err);
      }
    };

    fetchBook();
    intervalRef.current = setInterval(fetchBook, 1000); // 1s refresh for orderbook
    return () => clearInterval(intervalRef.current);
  }, [coin, depth]);

  return orderbook;
}
