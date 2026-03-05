import { useNavigate } from "react-router-dom";
import { useDiscoverTokens, TrendingToken } from "@/hooks/useDiscoverTokens";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { TrendingUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function PriceChange({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={cn("font-mono text-sm font-semibold", positive ? "text-green-400" : "text-red-400")}>
      {positive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function TokenRow({ token }: { token: TrendingToken }) {
  const navigate = useNavigate();

  return (
    <tr
      onClick={() => navigate(`/trade/${token.address}`)}
      className="border-b border-border/30 hover:bg-surface-hover/50 cursor-pointer transition-colors group"
    >
      <td className="py-3 px-3 text-center">
        <span className="font-mono text-sm text-muted-foreground font-bold">#{token.rank}</span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <OptimizedTokenImage
            src={token.imageUrl}
            fallbackText={token.symbol}
            size={32}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {token.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">${token.symbol}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-right hidden sm:table-cell">
        <span className="font-mono text-sm text-foreground">{formatNumber(token.marketCap)}</span>
      </td>
      <td className="py-3 px-3 text-right hidden md:table-cell">
        <span className="font-mono text-sm text-foreground">{formatNumber(token.liquidity)}</span>
      </td>
      <td className="py-3 px-3 text-right hidden lg:table-cell">
        <span className="font-mono text-sm text-foreground">{formatNumber(token.volume24h)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <PriceChange value={token.priceChange6h} />
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className="border-b border-border/30">
          <td className="py-3 px-3"><Skeleton className="h-4 w-6 mx-auto" /></td>
          <td className="py-3 px-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </td>
          <td className="py-3 px-3 hidden sm:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="py-3 px-3 hidden md:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="py-3 px-3 hidden lg:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="py-3 px-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

export default function DiscoverPage() {
  const { data: tokens, isLoading, isFetching, dataUpdatedAt } = useDiscoverTokens();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="min-h-screen bg-background pl-0 md:pl-12">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Top Last 6 Hour Trending Coins</h1>
              <p className="text-xs text-muted-foreground">
                DexScreener top boosted · Solana · Updates every 2 min
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-primary")} />
            {lastUpdated && <span>Updated {lastUpdated}</span>}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">#</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Token</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Market Cap</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Liquidity</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Volume 24h</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">6h %</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows />
                ) : tokens && tokens.length > 0 ? (
                  tokens.map((token) => <TokenRow key={token.address} token={token} />)
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No trending tokens found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
