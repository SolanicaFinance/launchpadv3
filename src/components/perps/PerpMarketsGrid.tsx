import { usePerpMarkets, type PerpMarket } from "@/hooks/usePerpMarkets";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Shield, Users, Vault } from "lucide-react";

function MarketCard({ market }: { market: PerpMarket }) {
  const price = market.last_price_usd || 0;
  const vol = market.total_volume_usd || 0;
  const formatVol = vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : vol >= 1e3 ? `$${(vol / 1e3).toFixed(0)}K` : `$${vol.toFixed(0)}`;
  const vaultStr = market.vault_balance_usd >= 1e3 ? `$${(market.vault_balance_usd / 1e3).toFixed(1)}K` : `$${market.vault_balance_usd.toFixed(0)}`;

  return (
    <Link
      to={`/perps/trade/${market.token_address}`}
      className="group relative flex flex-col gap-3 p-4 rounded-xl transition-all duration-300 overflow-hidden
                 bg-card/40 backdrop-blur-sm border border-border/30
                 hover:border-primary/40 hover:bg-card/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.1)] hover:scale-[1.02]"
    >
      {/* Featured badge */}
      {market.is_featured && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary border border-primary/30">
          FEATURED
        </div>
      )}

      {/* Token header */}
      <div className="flex items-center gap-2.5">
        {market.token_image_url ? (
          <img src={market.token_image_url} alt={market.token_symbol} className="w-8 h-8 rounded-full bg-muted" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {market.token_symbol.slice(0, 2)}
          </div>
        )}
        <div>
          <span className="text-sm font-bold text-foreground">{market.token_symbol}/USDT</span>
          <span className="text-[10px] text-muted-foreground ml-1.5 font-mono bg-muted/40 px-1 py-0.5 rounded">
            {market.max_leverage}x
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center justify-between">
        <span className="text-base font-mono font-bold text-foreground">
          ${price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-0.5"><Vault className="h-2.5 w-2.5" /> Vault</span>
          <span className="text-foreground font-medium">{vaultStr}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Volume</span>
          <span className="text-foreground font-medium">{formatVol}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Trades</span>
          <span className="text-foreground font-medium">{market.total_trades}</span>
        </div>
      </div>

      {/* Fee info */}
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/30">
        <span className="text-muted-foreground">Fee: {market.fee_pct}%</span>
        <span className="text-muted-foreground">Spread: {market.spread_pct}%</span>
      </div>
    </Link>
  );
}

export function PerpMarketsGrid() {
  const { markets, loading } = usePerpMarkets();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!markets.length) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">No Markets Yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Be the first to create a perpetual market! Deploy your own on-chain perps for any BNB token.
        </p>
      </div>
    );
  }

  const featured = markets.filter((m) => m.is_featured);
  const community = markets.filter((m) => !m.is_featured);

  return (
    <div className="space-y-6">
      {featured.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Featured Markets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((m) => <MarketCard key={m.id} market={m} />)}
          </div>
        </div>
      )}
      {community.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Community Markets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {community.map((m) => <MarketCard key={m.id} market={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}
