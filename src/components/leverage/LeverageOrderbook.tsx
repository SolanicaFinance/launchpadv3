import { cn } from "@/lib/utils";
import type { OrderbookData } from "@/hooks/useAsterOrderbook";

interface Props {
  orderbook: OrderbookData;
}

function formatPrice(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function formatQty(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(4);
}

export function LeverageOrderbook({ orderbook }: Props) {
  const { asks, bids, spread, spreadPercent, midPrice } = orderbook;
  const displayAsks = asks.slice(0, 10).reverse();
  const displayBids = bids.slice(0, 10);

  const maxAskTotal = asks[asks.length - 1]?.total || 1;
  const maxBidTotal = bids[bids.length - 1]?.total || 1;

  return (
    <div className="flex flex-col h-full text-[11px] font-mono">
      {/* Header */}
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {displayAsks.map((level, i) => (
          <div key={`a-${i}`} className="relative grid grid-cols-3 gap-1 px-2 py-[2px]">
            <div
              className="absolute right-0 top-0 bottom-0 bg-red-500/10"
              style={{ width: `${(level.total / maxAskTotal) * 100}%` }}
            />
            <span className="text-red-400 relative z-10">{formatPrice(level.price)}</span>
            <span className="text-right text-foreground/70 relative z-10">{formatQty(level.quantity)}</span>
            <span className="text-right text-foreground/50 relative z-10">{formatQty(level.total)}</span>
          </div>
        ))}
      </div>

      {/* Spread / Mid price */}
      <div className="flex items-center justify-between px-2 py-1.5 border-y border-border bg-secondary/50">
        <span className="text-primary font-bold text-xs">{formatPrice(midPrice)}</span>
        <span className="text-muted-foreground text-[10px]">
          Spread: {formatPrice(spread)} ({spreadPercent.toFixed(3)}%)
        </span>
      </div>

      {/* Bids (buys) */}
      <div className="flex-1 overflow-hidden">
        {displayBids.map((level, i) => (
          <div key={`b-${i}`} className="relative grid grid-cols-3 gap-1 px-2 py-[2px]">
            <div
              className="absolute right-0 top-0 bottom-0 bg-green-500/10"
              style={{ width: `${(level.total / maxBidTotal) * 100}%` }}
            />
            <span className="text-green-400 relative z-10">{formatPrice(level.price)}</span>
            <span className="text-right text-foreground/70 relative z-10">{formatQty(level.quantity)}</span>
            <span className="text-right text-foreground/50 relative z-10">{formatQty(level.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
