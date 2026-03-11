import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useAsterMarkets, type AsterMarket } from "@/hooks/useAsterMarkets";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function LeverageCard({ market }: { market: AsterMarket }) {
  const change = parseFloat(market.priceChangePercent);
  const isPositive = change >= 0;
  const vol = parseFloat(market.quoteVolume);
  const formatVol = vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : `$${(vol / 1e3).toFixed(0)}K`;

  return (
    <Link
      to={`/leverage?symbol=${market.symbol}`}
      className="group relative flex flex-col gap-2.5 p-4 rounded-xl transition-all duration-300 overflow-hidden
                 bg-card/30 backdrop-blur-sm border border-border/20
                 hover:border-primary/30 hover:bg-card/50 hover:shadow-[0_0_24px_hsl(var(--primary)/0.08)] hover:scale-[1.02]"
    >
      <div className="absolute inset-0 z-0 opacity-25 pointer-events-none overflow-hidden rounded-xl">
        <SparklineCanvas data={[1, 1]} seed={market.symbol} />
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{market.baseAsset}/{market.quoteAsset}</span>
        <span className="text-[10px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded">{market.maxLeverage}x</span>
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-foreground">${parseFloat(market.lastPrice).toLocaleString()}</span>
        <span className={cn(
          "text-xs font-bold font-mono inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
          isPositive ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
      <div className="relative z-10 text-[10px] text-muted-foreground font-mono">Vol {formatVol}</div>
    </Link>
  );
}

export default function LeverageSection() {
  const { markets: leverageMarkets, loading: leverageLoading } = useAsterMarkets();

  const topLeverage = useMemo(() => {
    if (!leverageMarkets.length) return [];
    return [...leverageMarkets]
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 6);
  }, [leverageMarkets]);

  if (leverageLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!topLeverage.length) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No leverage markets available.</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {topLeverage.map((m) => (
        <LeverageCard key={m.symbol} market={m} />
      ))}
    </div>
  );
}
