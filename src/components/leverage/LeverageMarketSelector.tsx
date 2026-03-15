import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HyperliquidMarket } from "@/hooks/useHyperliquidMarkets";

interface Props {
  markets: HyperliquidMarket[];
  selected: string;
  onSelect: (symbol: string) => void;
  search: string;
  onSearch: (s: string) => void;
}

export function LeverageMarketSelector({ markets, selected, onSelect, search, onSearch }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedMarket = markets.find((m) => m.symbol === selected);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const priceChange = parseFloat(selectedMarket?.priceChangePercent || "0");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-secondary hover:bg-surface-hover transition-colors border border-border"
      >
        <span className="text-sm font-bold text-foreground">{selected}/USDC</span>
        <span className={cn("text-xs font-medium", priceChange >= 0 ? "text-green-400" : "text-red-400")}>
          {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[320px] bg-popover border border-border rounded-sm shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search markets..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/50">
              <span>Pair</span>
              <span>Price</span>
              <span>24h %</span>
            </div>
            {markets.slice(0, 50).map((m) => {
              const change = parseFloat(m.priceChangePercent);
              return (
                <button
                  key={m.symbol}
                  onClick={() => { onSelect(m.symbol); setOpen(false); onSearch(""); }}
                  className={cn(
                    "w-full grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 text-xs hover:bg-surface-hover transition-colors",
                    m.symbol === selected && "bg-primary/10"
                  )}
                >
                  <span className="text-left font-medium text-foreground">{m.baseAsset}<span className="text-muted-foreground">/USDC</span></span>
                  <span className="text-right text-foreground tabular-nums">${parseFloat(m.lastPrice).toLocaleString()}</span>
                  <span className={cn("text-right tabular-nums", change >= 0 ? "text-green-400" : "text-red-400")}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
