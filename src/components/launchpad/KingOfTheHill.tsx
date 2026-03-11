import { Link, useNavigate } from "react-router-dom";
import { Users, Bot, BadgeCheck, TrendingUp, BarChart3, ArrowUpRight, Globe, MessageCircle, Copy, Check, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { copyToClipboard } from "@/lib/clipboard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PulseQuickBuyButton } from "@/components/launchpad/PulseQuickBuyButton";
import { useSparklineBatch } from "@/hooks/useSparklineBatch";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import type { FunToken } from "@/hooks/useFunTokensPaginated";

/* ── rank config ── */
const RANKS = [
  {
    border: "border-amber-500/30",
    hoverBorder: "hover:border-amber-400/60",
    glow: "hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]",
    badgeBg: "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600",
    badgeRing: "ring-2 ring-amber-400/30",
    king: true,
    label: "#1",
  },
  {
    border: "border-cyan-500/20",
    hoverBorder: "hover:border-cyan-400/50",
    glow: "hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]",
    badgeBg: "bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-600",
    badgeRing: "ring-1 ring-cyan-400/20",
    king: false,
    label: "#2",
  },
  {
    border: "border-slate-500/15",
    hoverBorder: "hover:border-slate-400/40",
    glow: "hover:shadow-[0_0_16px_rgba(148,163,184,0.1)]",
    badgeBg: "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600",
    badgeRing: "ring-1 ring-slate-400/15",
    king: false,
    label: "#3",
  },
];

function extractXUsername(url?: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] || null; } catch { return null; }
}

/* ── premium progress bar ── */
function ProgressBar({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(Math.min(value, 100)), 150); return () => clearTimeout(t); }, [value]);

  const gradient = value >= 80
    ? "from-orange-500 via-amber-400 to-yellow-300"
    : value >= 50
      ? "from-emerald-500 via-lime-400 to-yellow-400"
      : "from-emerald-600 via-emerald-400 to-teal-300";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold font-mono">Bonding Progress</span>
        <span className="text-[13px] font-bold font-mono tabular-nums text-foreground">{value.toFixed(0)}%</span>
      </div>
      <div className="h-[10px] w-full rounded-full overflow-hidden bg-muted/30">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-[1.2s] ease-out relative",
            gradient,
          )}
          style={{ width: `${Math.max(w, 2)}%` }}
        >
          {/* shimmer */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute -left-full top-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

function kingToFunToken(t: KingToken): FunToken {
  return {
    id: t.id,
    name: t.name,
    ticker: t.ticker,
    image_url: t.image_url,
    mint_address: t.mint_address,
    dbc_pool_address: t.dbc_pool_address,
    status: t.status as any,
    bonding_progress: t.bonding_progress ?? 0,
    market_cap_sol: t.market_cap_sol ?? 0,
    holder_count: t.holder_count ?? 0,
    trading_fee_bps: t.trading_fee_bps ?? 0,
    fee_mode: t.fee_mode ?? null,
    agent_id: t.agent_id ?? null,
    launchpad_type: t.launchpad_type ?? null,
    trading_agent_id: t.trading_agent_id ?? null,
    is_trading_agent_token: t.is_trading_agent_token ?? false,
    creator_wallet: t.creator_wallet ?? null,
    twitter_url: t.twitter_url ?? null,
    twitter_avatar_url: t.twitter_avatar_url ?? null,
    twitter_verified: t.twitter_verified ?? false,
    twitter_verified_type: t.twitter_verified_type ?? null,
    telegram_url: t.telegram_url ?? null,
    website_url: t.website_url ?? null,
    discord_url: t.discord_url ?? null,
    created_at: t.created_at,
    price_sol: 0,
    volume_24h_sol: 0,
    description: null,
    total_fees_earned: 0,
    last_distribution_at: null,
    updated_at: t.created_at,
  } as unknown as FunToken;
}

/* ── premium card ── */
function KingCard({ token, rank, quickBuyAmount, sparklineData }: { token: KingToken; rank: number; quickBuyAmount: number; sparklineData?: number[] }) {
  const navigate = useNavigate();
  const funToken = useMemo(() => kingToFunToken(token), [token]);
  const [blink, setBlink] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const schedule = () => {
      const delay = 2000 + Math.random() * 4000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 300);
        timerId = schedule();
      }, delay);
    };
    let timerId = schedule();
    return () => clearTimeout(timerId);
  }, []);

  const { solPrice } = useSolPrice();
  const progress = token.codex_graduation_percent ?? token.bonding_progress ?? 0;
  // Prefer live Codex USD mcap, fallback to SOL-based calculation
  const mcapUsd = token.codex_market_cap_usd || (token.market_cap_sol ?? 0) * (solPrice || 0);
  const change24h = token.codex_change_24h ?? 0;
  const isPump = token.launchpad_type === "pumpfun";
  const isBags = token.launchpad_type === "bags";
  const isTrader = !!(token.trading_agent_id || token.is_trading_agent_token);
  const r = RANKS[rank - 1] || RANKS[2];
  const xUser = extractXUsername(token.twitter_url);
  const xAvatar = token.twitter_avatar_url;
  const verified = token.twitter_verified;
  const vType = token.twitter_verified_type;
  const checkClr = vType === "business" || vType === "government" ? "hsl(45 93% 47%)" : "hsl(204 88% 53%)";
  const holders = token.holder_count ?? 0;

  const url = `/trade/${token.mint_address || token.dbc_pool_address || token.id}`;
  const codexChartUrl = token.mint_address ? `https://www.defined.fi/sol/${token.mint_address}` : null;

  const handleTradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleChartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (codexChartUrl) window.open(codexChartUrl, "_blank");
  };

  const handleCopyCA = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token.mint_address) return;
    const ok = await copyToClipboard(token.mint_address);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  const handleSocialClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank");
  };

  return (
    <div
      onClick={() => navigate(url)}
      className={cn(
        "group relative flex flex-col",
        "rounded-2xl border transition-all duration-300 ease-out",
        "cursor-pointer",
        r.border, r.hoverBorder, r.glow,
        "hover:scale-[1.02] active:scale-[0.98]",
        r.king ? "md:flex-[1.15]" : "md:flex-1",
        blink && "animate-[king-blink_0.3s_ease-in-out]",
      )}
      style={{
        background: "linear-gradient(135deg, hsl(0 0% 7%) 0%, hsl(0 0% 5%) 100%)",
        padding: "14px",
        margin: "0 6px",
      }}
    >
      {/* King crown glow for #1 */}
      {r.king && (
        <div className="absolute -top-px -left-px -right-px h-[2px] rounded-t-2xl bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      )}

      {/* Top: Rank badge + Avatar + Info */}
      <div className="relative z-10 flex items-center gap-3 mb-4">
        {/* Rank Badge */}
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center rounded-xl font-black text-white shadow-lg",
          r.badgeBg, r.badgeRing,
          r.king ? "w-11 h-11 text-base" : "w-9 h-9 text-sm",
        )}>
          {r.label}
        </div>

        {/* Token Avatar */}
        <div className={cn(
          "flex-shrink-0 rounded-2xl overflow-hidden border border-border/30",
          r.king ? "w-14 h-14" : "w-12 h-12",
        )}>
          <OptimizedTokenImage
            src={token.image_url}
            alt={token.name}
            fallbackText={token.ticker}
            size={112}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Name + Creator */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "font-bold text-foreground truncate leading-tight",
              r.king ? "text-[16px]" : "text-[14px]",
            )}>
              {token.name}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground/50 truncate">${token.ticker}</span>
            {isTrader && (
              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0 bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">
                <Bot className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />Trader
              </span>
            )}
            {isPump && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
            {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} />}
          </div>
          <div className="flex items-center gap-1 mt-0.5 min-h-[18px]">
            <svg className="w-3 h-3 flex-shrink-0 text-muted-foreground/40" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            {xUser ? (
              <>
                {xAvatar && (
                  <img src={xAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0 border border-border/20" />
                )}
                <span className="text-[11px] text-muted-foreground/45 truncate">@{xUser}</span>
                {verified && <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: checkClr }} />}
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground/25 italic">— None</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle section with sparkline background — between header and progress bar */}
      <div className="relative mb-3">
        {/* Sparkline background - only in this middle section */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden rounded-lg">
          <SparklineCanvas data={sparklineData && sparklineData.length >= 2 ? sparklineData : [1, 1]} seed={token.mint_address || token.id} />
        </div>

        {/* Middle: MCAP + Holders grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 mb-3">
          <div>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 block mb-1">MCap</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-black font-mono tabular-nums text-emerald-400 leading-none">
                ${mcapUsd >= 1_000_000 ? `${(mcapUsd / 1_000_000).toFixed(2)}M` : mcapUsd >= 1_000 ? `${(mcapUsd / 1_000).toFixed(1)}K` : mcapUsd.toFixed(0)}
              </span>
              {change24h !== 0 && (
                <span className={cn(
                  "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                  change24h > 0 ? "text-emerald-300 bg-emerald-500/15" : "text-red-400 bg-red-500/15"
                )}>
                  {change24h > 0 ? "+" : ""}{change24h.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 block mb-1">Holders</span>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-sm font-mono font-bold text-foreground/80">{holders >= 1000 ? `${(holders / 1000).toFixed(1)}K` : holders}</span>
            </div>
          </div>
        </div>
        <div className="relative z-10">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 block mb-1">Vol 24h</span>
          <span className="text-sm font-mono font-bold text-foreground/80">
            ${token.codex_volume_24h_usd != null && token.codex_volume_24h_usd > 0 ? (token.codex_volume_24h_usd >= 1_000_000 ? `${(token.codex_volume_24h_usd / 1_000_000).toFixed(1)}M` : token.codex_volume_24h_usd >= 1_000 ? `${(token.codex_volume_24h_usd / 1_000).toFixed(1)}K` : token.codex_volume_24h_usd.toFixed(0)) : "0"}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative z-10 mb-3">
        <ProgressBar value={progress} />
      </div>

      {/* Bottom Tools Row */}
      <div className="relative z-10 pt-3 border-t border-border/10 space-y-2">
        {/* Social icons row */}
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={200}>
            {token.twitter_url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={(e) => handleSocialClick(e, token.twitter_url!)} className="p-1 rounded text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/30 transition-colors">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Twitter</TooltipContent>
              </Tooltip>
            )}
            {token.telegram_url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={(e) => handleSocialClick(e, token.telegram_url!)} className="p-1 rounded text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/30 transition-colors">
                    <MessageCircle className="w-2.5 h-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Telegram</TooltipContent>
              </Tooltip>
            )}
            {token.website_url && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={(e) => handleSocialClick(e, token.website_url!)} className="p-1 rounded text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/30 transition-colors">
                    <Globe className="w-2.5 h-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Website</TooltipContent>
              </Tooltip>
            )}
            {token.mint_address && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleCopyCA} className={cn(
                    "p-1 rounded transition-colors",
                    copied ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/30"
                  )}>
                    {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">{copied ? "Copied!" : "Copy CA"}</TooltipContent>
              </Tooltip>
            )}
            {codexChartUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleChartClick} className="p-1 rounded text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/30 transition-colors">
                    <BarChart3 className="w-2.5 h-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">Chart</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>

        {/* Buttons row — onMouseDown capture prevents card navigation */}
        <div
          className="king-footer-actions flex items-center gap-2"
          onClickCapture={e => e.stopPropagation()}
          onMouseDownCapture={e => e.stopPropagation()}
          onTouchStartCapture={e => e.stopPropagation()}
          onPointerDownCapture={e => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); navigate(url); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-3 py-1.5 min-h-[30px] rounded-xl text-[11px] font-bold transition-all duration-200 font-mono",
              "bg-primary/10 text-primary hover:bg-primary/20",
              "border border-primary/20 hover:border-primary/40",
              "hover:scale-[1.03] active:scale-[0.97]",
            )}
          >
            <TrendingUp className="w-3 h-3" />
            Trade
          </button>
          <div onClick={e => e.stopPropagation()} className="king-quick-buy-wrapper flex-1">
            <PulseQuickBuyButton funToken={funToken} quickBuyAmount={quickBuyAmount} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── skeleton ── */
function KingCardSkeleton() {
  return (
    <div
      className="flex flex-col md:flex-1 rounded-2xl border border-border/10"
      style={{ background: "linear-gradient(135deg, hsl(0 0% 7%) 0%, hsl(0 0% 5%) 100%)", padding: "20px" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="space-y-1">
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-2 w-8" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
      <Skeleton className="h-[6px] w-full rounded-full mb-3" />
      <div className="flex items-center justify-between pt-2 border-t border-border/10">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-6 w-14 rounded-lg" />
      </div>
    </div>
  );
}

/* ── export ── */
export function KingOfTheHill() {
  const { tokens, isLoading } = useKingOfTheHill();
  const [quickBuyAmount] = useState(() => {
    try {
      const v = localStorage.getItem("pulse-quick-buy-amount");
      if (v) { const n = parseFloat(v); if (n > 0 && isFinite(n)) return n; }
    } catch {}
    return 0.5;
  });

  const sparklineAddresses = useMemo(
    () => (tokens ?? []).map(t => t.mint_address).filter(Boolean) as string[],
    [tokens]
  );
  const { data: sparklines } = useSparklineBatch(sparklineAddresses);

  // Scroll arrows state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateScrollState); ro.disconnect(); };
  }, [updateScrollState, tokens]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(':scope > *')?.getBoundingClientRect().width ?? el.clientWidth;
    el.scrollBy({ left: dir === "left" ? -cardWidth - 12 : cardWidth + 12, behavior: "smooth" });
  };

  return (
    <div className="w-full">
      {/* Premium Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img src="/saturn-logo.png" alt="Saturn" className="w-6 h-6 md:w-9 md:h-9 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
          <div>
            <h2 className="text-[13px] md:text-base font-black uppercase tracking-[0.08em] text-foreground" style={{ textShadow: "0 0 20px rgba(245,158,11,0.15)" }}>
              King of the Hill
            </h2>
            <span className="text-[10px] text-muted-foreground/40 tracking-wide">Soon to Graduate</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to="/agents/leaderboard" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/15 transition-all whitespace-nowrap">
            View Full Leaderboard
            <ArrowUpRight className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>

      {/* Cards Row with scroll arrows on mobile */}
      <div className="relative flex items-center">
        {/* Left arrow — always visible on mobile */}
        <button
          onClick={() => scroll("left")}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-muted/60 border border-border/40",
            "transition-all",
            "md:hidden",
            canScrollLeft
              ? "text-foreground/90 hover:bg-muted hover:border-border/60"
              : "text-muted-foreground/30 cursor-default",
          )}
          aria-label="Scroll left"
          disabled={!canScrollLeft}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 flex flex-row md:gap-4 overflow-x-auto pb-2 md:pb-0 snap-x snap-mandatory scrollbar-hide mx-1 md:mx-0 [&>*]:snap-center [&>*]:min-w-full [&>*]:flex-shrink-0 md:[&>*]:min-w-0 md:[&>*]:flex-shrink md:[&>*]:snap-align-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading
            ? [1, 2, 3].map(i => <KingCardSkeleton key={i} />)
            : tokens?.map((t, i) => <KingCard key={t.id} token={t} rank={i + 1} quickBuyAmount={quickBuyAmount} sparklineData={t.mint_address ? sparklines?.[t.mint_address] : undefined} />)
          }
        </div>

        {/* Right arrow — always visible on mobile */}
        <button
          onClick={() => scroll("right")}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-muted/60 border border-border/40",
            "transition-all",
            "md:hidden",
            canScrollRight
              ? "text-foreground/90 hover:bg-muted hover:border-border/60"
              : "text-muted-foreground/30 cursor-default",
          )}
          aria-label="Scroll right"
          disabled={!canScrollRight}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}