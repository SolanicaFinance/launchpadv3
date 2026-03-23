import { TrendingUp, TrendingDown, Copy, Check } from "lucide-react";
import { useSaturnTokenPrice } from "@/hooks/useSaturnTokenPrice";
import { useState, useCallback } from "react";

const SATURN_CA = "0x27a51c96b84c6d9f24d5d054c396ae0e1c96ffff";

export function SaturnTokenPriceDisplay() {
  const { priceData, isLoading } = useSaturnTokenPrice();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(SATURN_CA);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const currentPrice = priceData?.price ?? 0;
  const change24h = priceData?.change24h ?? 0;
  const isUp = change24h >= 0;

  const formatPrice = (p: number) => {
    if (p === 0) return "$0.00";
    if (p < 0.0001) return `$${p.toFixed(8).replace(/0+$/, "")}`;
    if (p < 0.01) return `$${p.toFixed(6).replace(/0+$/, "")}`;
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
        {currentPrice > 0 ? formatPrice(currentPrice) : "loading…"}
      </span>

      <div className={`flex items-center gap-0.5 text-[10px] font-bold font-mono px-1 py-0.5 rounded-md ${
        isUp ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
      }`}>
        {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        <span className="tabular-nums">{isUp ? "+" : ""}{change24h.toFixed(2)}%</span>
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
