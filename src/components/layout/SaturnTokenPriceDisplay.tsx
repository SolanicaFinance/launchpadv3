import { TrendingUp, TrendingDown, Copy, Check } from "lucide-react";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useState, useEffect, useRef, useCallback } from "react";

const SATURN_MINT = "36gRjqLAaVcfd7hRzWAYyfZsED6ChxmF5hfZYv9zpump";

export function SaturnTokenPriceDisplay() {
  const { data: prices } = useTokenPrices([SATURN_MINT]);
  const currentPrice = prices?.[SATURN_MINT] ?? 0;

  const prevPriceRef = useRef(currentPrice);
  const [change, setChange] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentPrice > 0 && prevPriceRef.current > 0 && currentPrice !== prevPriceRef.current) {
      const pct = ((currentPrice - prevPriceRef.current) / prevPriceRef.current) * 100;
      setChange(pct);
    }
    if (currentPrice > 0) prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(SATURN_MINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

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

      <button
        onClick={handleCopy}
        title="Copy CA"
        className="ml-0.5 p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}