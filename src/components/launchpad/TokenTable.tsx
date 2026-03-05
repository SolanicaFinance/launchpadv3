import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Flame,
  Crown,
  Gem,
  Bot,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { PhantomBadge } from "@/components/clawbook/PhantomBadge";

interface TokenTableProps {
  solPrice: number | null;
  promotedTokenIds?: Set<string>;
  onPromote?: (tokenId: string, name: string, ticker: string) => void;
}

export function TokenTable({ solPrice, promotedTokenIds, onPromote }: TokenTableProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 60;

  const { tokens, totalCount, isLoading } = useFunTokensPaginated(page, pageSize);
  const totalPages = Math.ceil(totalCount / pageSize);

  const formatUsd = (mcapSol: number | null | undefined) => {
    if (!mcapSol || !solPrice) return "$0";
    const usd = mcapSol * solPrice;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const formatAge = (createdAt: string | null) => {
    if (!createdAt) return "-";
    const dist = formatDistanceToNow(new Date(createdAt), { addSuffix: false });
    // Shorten: "about 24 hours" → "24h", "5 minutes" → "5m"
    return dist
      .replace("about ", "")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" months", "mo")
      .replace(" month", "mo");
  };

  // Segment tokens into 3 columns by bonding progress
  const newPairs = tokens.filter(t => (t.bonding_progress ?? 0) < 30);
  const almostBonded = tokens.filter(t => (t.bonding_progress ?? 0) >= 30 && (t.bonding_progress ?? 0) < 80);
  const bonded = tokens.filter(t => (t.bonding_progress ?? 0) >= 80);

  const TokenRow = ({ token, index }: { token: typeof tokens[number]; index: number }) => {
    const isNearGraduation = (token.bonding_progress ?? 0) >= 80;
    const isPromoted = promotedTokenIds?.has(token.id) || false;
    const isPumpFun = token.launchpad_type === 'pumpfun';
    const isBags = token.launchpad_type === 'bags';
    const isPhantom = token.launchpad_type === 'phantom';
    const isAgent = !!token.agent_id;

    const tradeUrl = (isPumpFun || isBags || isAgent)
      ? `/t/${token.ticker}`
      : `/trade/${token.mint_address}`;

    const priceChange = token.price_change_24h;
    const progress = token.bonding_progress ?? 0;
    const isEven = index % 2 === 0;

    return (
      <Link
        to={tradeUrl}
        className={`
          flex items-center gap-2 px-2.5 py-1.5 border-b border-border/30 last:border-b-0
          transition-colors group cursor-pointer relative
          ${isEven ? "bg-card" : "bg-background"}
          hover:bg-secondary/60
          ${isPromoted ? "border-l-2 border-l-warning" : ""}
        `}
      >
        {/* Token Image */}
        <div className={`
          relative w-7 h-7 rounded overflow-hidden flex-shrink-0 bg-secondary
          ${isNearGraduation ? "ring-1 ring-orange-500/60" : ""}
          ${isPromoted ? "ring-1 ring-warning/60" : ""}
        `}>
          {token.image_url ? (
            <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground bg-secondary">
              {token.ticker?.slice(0, 2)}
            </div>
          )}
          {/* Source badge overlay */}
          <div className="absolute -bottom-0.5 -right-0.5">
            {isPumpFun ? (
              <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />
            ) : isBags ? (
              <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />
            ) : isPhantom ? (
              <PhantomBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" />
            ) : null}
          </div>
        </div>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
              {token.name}
            </span>
            {isNearGraduation && <Flame className="h-2.5 w-2.5 text-orange-500 flex-shrink-0" />}
            {isPromoted && <Crown className="h-2.5 w-2.5 text-warning flex-shrink-0" />}
            {isAgent && <Bot className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1 mt-px">
            <span className="text-[9px] font-mono text-muted-foreground">${token.ticker}</span>
            <span className="text-[9px] text-muted-foreground/40">·</span>
            <span className="text-[9px] text-muted-foreground/50">{formatAge(token.created_at)}</span>
          </div>
          {/* Ultra-thin progress bar */}
          <div className="h-px w-full bg-border/50 mt-1 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: progress >= 80
                  ? 'hsl(25 95% 60%)'
                  : 'hsl(0 84% 60% / 0.7)',
              }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col items-end gap-px flex-shrink-0">
          <span className="text-[11px] font-bold font-mono text-foreground">{formatUsd(token.market_cap_sol)}</span>
          {priceChange != null ? (
            <span className={`text-[9px] font-mono font-semibold ${
              priceChange > 0 ? "text-emerald-400" : priceChange < 0 ? "text-red-400" : "text-muted-foreground"
            }`}>
              {priceChange === 0 ? "0%" : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}%`}
            </span>
          ) : (
            <span className="text-[9px] text-muted-foreground">0%</span>
          )}
          <span className="text-[9px] font-mono text-muted-foreground/50">×{token.holder_count ?? 0}</span>
        </div>

        {/* Quick Buy Button — appears on hover */}
        <div
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`https://raydium.io/swap/?inputMint=sol&outputMint=${token.mint_address}`, '_blank');
          }}
        >
          <div className="h-5 px-1.5 text-[9px] font-bold bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/40 rounded flex items-center gap-0.5 cursor-pointer transition-colors">
            <Zap className="h-2.5 w-2.5" />
            Buy
          </div>
        </div>
      </Link>
    );
  };

  const ColumnSkeleton = () => (
    <div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-border/30 ${i % 2 === 0 ? "bg-card" : "bg-background"}`}>
          <Skeleton className="h-7 w-7 rounded flex-shrink-0" />
          <div className="flex-1 space-y-0.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-px w-full" />
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-2 w-7" />
          </div>
        </div>
      ))}
    </div>
  );

  const ColumnHeader = ({ title, count, dotColor }: { title: string; count: number; dotColor: string }) => (
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-secondary/30 sticky top-0 z-10">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{title}</span>
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/50">{count}</span>
    </div>
  );

  return (
    <div className="w-full">
      {/* 3-Column Trading Terminal Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
        {/* Column 1: New Pairs */}
        <div className="border border-border rounded overflow-hidden bg-card">
          <ColumnHeader title="New Pairs" count={newPairs.length} dotColor="bg-primary" />
          <div className="overflow-y-auto max-h-[700px]">
            {isLoading ? (
              <ColumnSkeleton />
            ) : newPairs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-[10px]">No new pairs</div>
            ) : (
              newPairs.map((token, i) => <TokenRow key={token.id} token={token} index={i} />)
            )}
          </div>
        </div>

        {/* Column 2: Almost Bonded */}
        <div className="border border-border rounded overflow-hidden bg-card">
          <ColumnHeader title="Almost Bonded" count={almostBonded.length} dotColor="bg-amber-500" />
          <div className="overflow-y-auto max-h-[700px]">
            {isLoading ? (
              <ColumnSkeleton />
            ) : almostBonded.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-[10px]">No tokens almost bonded</div>
            ) : (
              almostBonded.map((token, i) => <TokenRow key={token.id} token={token} index={i} />)
            )}
          </div>
        </div>

        {/* Column 3: Bonded */}
        <div className="border border-border rounded overflow-hidden bg-card">
          <ColumnHeader title="Bonded" count={bonded.length} dotColor="bg-emerald-400" />
          <div className="overflow-y-auto max-h-[700px]">
            {isLoading ? (
              <ColumnSkeleton />
            ) : bonded.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-[10px]">No bonded tokens</div>
            ) : (
              bonded.map((token, i) => <TokenRow key={token.id} token={token} index={i} />)
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[10px] font-mono text-muted-foreground">{page}/{totalPages} · {totalCount} tokens</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-6 px-2 text-[10px] border-border"
            >
              <ChevronLeft className="h-3 w-3 mr-0.5" />Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-6 px-2 text-[10px] border-border"
            >
              Next<ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
