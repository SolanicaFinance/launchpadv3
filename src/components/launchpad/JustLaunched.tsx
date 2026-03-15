import { Link } from "react-router-dom";
import { Rocket, Clock, Bot } from "lucide-react";
import { LiveAge } from "@/components/ui/LiveAge";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useJustLaunched, type JustLaunchedToken } from "@/hooks/useJustLaunched";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/forum/PumpBadge";
import { BagsBadge } from "@/components/forum/BagsBadge";
import { PhantomBadge } from "@/components/forum/PhantomBadge";

function formatUsdMarketCap(marketCapSol: number, solPrice: number): string {
  const usdValue = marketCapSol * solPrice;
  if (!Number.isFinite(usdValue) || usdValue <= 0) return "$0";
  if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
  if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
  return `$${usdValue.toFixed(0)}`;
}

function JustLaunchedCard({ token }: { token: JustLaunchedToken }) {
  const { solPrice } = useSolPrice();
  const isTradingAgent = !!(token.trading_agent_id || token.is_trading_agent_token);
  const isPumpFun = token.launchpad_type === 'pumpfun';
  const isBags = token.launchpad_type === 'bags';
  const isPhantom = token.launchpad_type === 'phantom';
  const linkPath = (token.agent_id || isTradingAgent || isPumpFun || isBags)
    ? `/t/${token.ticker}`
    : `/trade/${token.mint_address || token.id}`;

  return (
    <Link
      to={linkPath}
      className={cn(
        "flex-shrink-0 w-[120px] p-1.5 rounded border border-border",
        "bg-card hover:border-primary/50 hover:bg-secondary/40 transition-all duration-150 group"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {token.image_url ? (
          <img
            src={token.image_url}
            alt={token.name}
            className="w-7 h-7 rounded object-cover border border-border/50 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        ) : (
          <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
            {token.ticker?.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[10px] text-foreground truncate group-hover:text-primary transition-colors flex items-center gap-0.5 leading-tight">
            {token.name}
            {isPumpFun && <PumpBadge size="sm" showText={false} mintAddress={token.mint_address ?? undefined} />}
            {isBags && <BagsBadge showText={false} mintAddress={token.mint_address ?? undefined} />}
            {isPhantom && <PhantomBadge showText={false} size="sm" mintAddress={token.mint_address ?? undefined} />}
            {isTradingAgent && (
              <span className="flex items-center gap-0.5 bg-amber-500/15 text-amber-400 px-0.5 rounded flex-shrink-0">
                <Bot className="w-2 h-2" />
              </span>
            )}
          </h3>
          <span className="text-[9px] text-muted-foreground font-mono leading-none">${token.ticker}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold font-mono text-emerald-400">
          {formatUsdMarketCap(token.market_cap_sol ?? 0, solPrice)}
        </span>
        <div className="flex items-center gap-0.5 text-muted-foreground/50">
          <Clock className="w-2 h-2" />
          <LiveAge createdAt={token.created_at} className="text-[8px] font-mono text-muted-foreground/50" />
        </div>
      </div>
    </Link>
  );
}

export function JustLaunched() {
  const { tokens, isLoading } = useJustLaunched();

  return (
    <div className="w-full">
      {/* Section header - hidden on mobile since parent already shows it */}
      <div className="hidden sm:flex items-center gap-2 mb-2">
        <Rocket className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Just Launched
        </span>
        <span className="text-[10px] text-muted-foreground/50">— Last 24 Hours</span>
        <div className="flex-1 h-px bg-border ml-1" />
      </div>

      {isLoading ? (
        <div className="flex gap-2 pb-1 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-shrink-0 w-[130px] p-2 rounded border border-border bg-[hsl(240_10%_5%)]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Skeleton className="w-8 h-8 rounded flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-2.5 w-14" />
                  <Skeleton className="h-2 w-9" />
                </div>
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-2.5 w-8" />
              </div>
            </div>
          ))}
        </div>
      ) : tokens.length === 0 ? null : (
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {tokens.map((token) => (
              <JustLaunchedCard key={token.id} token={token} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
