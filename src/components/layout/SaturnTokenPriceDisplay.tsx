import { TrendingUp, TrendingDown } from "lucide-react";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useState, useEffect, useRef } from "react";

const SATURN_MINT = "789zCXMYNn8BPPecX1qvX3AUkBALtmuodCHKMFSATURN";

export function SaturnTokenPriceDisplay() {
  const { data: prices } = useTokenPrices([SATURN_MINT]);
  const currentPrice = prices?.[SATURN_MINT] ?? 0;

  // Track previous price for change indication
  const prevPriceRef = useRef(currentPrice);
  const [change, setChange] = useState(0);

  useEffect(() => {
    if (currentPrice > 0 && prevPriceRef.current > 0 && currentPrice !== prevPriceRef.current) {
      const pct = ((currentPrice - prevPriceRef.current) / prevPriceRef.current) * 100;
      setChange(pct);
    }
    if (currentPrice > 0) prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  const isUp = change >= 0;
  const formatPrice = (p: number) => {
    if (p === 0) return "$0.00";
    if (p < 0.0001) return `$${p.toExponential(2)}`;
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(2)}`;
  };

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/20 backdrop-blur-sm border border-border/20 hover:border-primary/30 transition-all duration-300 cursor-default group">
      <img
        src="/saturn-logo.png"
        alt="Saturn"
        className="h-4 w-4 rounded-full flex-shrink-0"
      />

      <span className="text-xs font-bold text-foreground/70 font-mono tracking-tight tabular-nums group-hover:text-foreground transition-colors">
        {currentPrice > 0 ? formatPrice(currentPrice) : "$—"}
      </span>

      <div className={`flex items-center gap-0.5 text-[10px] font-bold font-mono px-1 py-0.5 rounded-md ${
        isUp ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
      }`}>
        {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        <span className="tabular-nums">{isUp ? "+" : ""}{change.toFixed(2)}%</span>
      </div>
    </div>
  );
}
