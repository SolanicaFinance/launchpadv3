import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useAsterMarkets, type AsterMarket } from "@/hooks/useAsterMarkets";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function LeverageCard({ market }: { market: AsterMarket }) {
  const change = parseFloat(market.priceChangePercent);
  const isPositive = change >= 0;
  const vol = parseFloat(market.quoteVolume);
  const formatVol = vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : `$${(vol / 1e3).toFixed(0)}K`;

  return (
    <Link
      to={`/leverage?symbol=${market.symbol}`}
      className="relative flex flex-col gap-2 p-3.5 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 transition-all group overflow-hidden"
    >
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden rounded-xl">
        <SparklineCanvas data={[1, 1]} seed={market.symbol} />
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{market.baseAsset}/{market.quoteAsset}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{market.maxLeverage}x</span>
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-mono text-foreground">${parseFloat(market.lastPrice).toLocaleString()}</span>
        <span className={cn(
          "text-xs font-bold",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
      <div className="relative z-10 text-[10px] text-muted-foreground">Vol {formatVol}</div>
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
          <Skeleton key={i} className="h-24 rounded-xl" />
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
