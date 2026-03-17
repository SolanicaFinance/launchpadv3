import { Link, useNavigate } from "react-router-dom";
import { LiveAge } from "@/components/ui/LiveAge";
import { Users, Bot, BadgeCheck, TrendingUp, BarChart3, ArrowUpRight, Globe, MessageCircle, Copy, Check, Zap, ChevronLeft, ChevronRight, Pencil, Crown } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useKingOfTheHill, type KingToken } from "@/hooks/useKingOfTheHill";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatChange24h } from "@/lib/formatters";
import { PumpBadge } from "@/components/forum/PumpBadge";
import { BagsBadge } from "@/components/forum/BagsBadge";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { copyToClipboard } from "@/lib/clipboard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PulseQuickBuyButton } from "@/components/launchpad/PulseQuickBuyButton";
import { useSparklineBatch } from "@/hooks/useSparklineBatch";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import type { FunToken } from "@/hooks/useFunTokensPaginated";
import { BRAND } from "@/config/branding";

/* ── rank config ── */
const RANKS = [
  {
    borderColor: "rgba(245,158,11,0.25)",
    hoverBorderColor: "rgba(245,158,11,0.5)",
    glowColor: "rgba(245,158,11,0.12)",
    badgeBg: "linear-gradient(135deg, #F59E0B, #D97706, #F59E0B)",
    badgeShadow: "0 0 16px rgba(245,158,11,0.4), 0 2px 4px rgba(0,0,0,0.3)",
    king: true,
    label: "#1",
    crownPulse: true,
  },
  {
    borderColor: "rgba(0,212,255,0.18)",
    hoverBorderColor: "rgba(0,212,255,0.4)",
    glowColor: "rgba(0,212,255,0.08)",
    badgeBg: "linear-gradient(135deg, #00D4FF, #0891B2, #00D4FF)",
    badgeShadow: "0 0 12px rgba(0,212,255,0.3), 0 2px 4px rgba(0,0,0,0.3)",
    king: false,
    label: "#2",
    crownPulse: false,
  },
  {
    borderColor: "rgba(148,163,184,0.12)",
    hoverBorderColor: "rgba(148,163,184,0.3)",
    glowColor: "rgba(148,163,184,0.06)",
    badgeBg: "linear-gradient(135deg, #94A3B8, #64748B, #94A3B8)",
    badgeShadow: "0 0 8px rgba(148,163,184,0.2), 0 2px 4px rgba(0,0,0,0.3)",
    king: false,
    label: "#3",
    crownPulse: false,
  },
];

function extractXUsername(url?: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] || null; } catch { return null; }
}

/* ── ultra-premium progress bar ── */
function ProgressBar({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(Math.min(value, 100)), 200); return () => clearTimeout(t); }, [value]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] uppercase tracking-[0.15em] font-semibold font-mono" style={{ color: "#6E6E80" }}>
          Bonding Progress
        </span>
        <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color: "#FFFFFF" }}>
          {value.toFixed(0)}%
        </span>
      </div>
      <div className="relative h-[6px] w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div
          className="h-full rounded-full transition-all duration-[1.4s] ease-out relative"
          style={{
            width: `${Math.max(w, 1.5)}%`,
            background: value >= 80
              ? "linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)"
              : value >= 50
                ? "linear-gradient(90deg, #10B981, #34D399, #A3E635)"
                : "linear-gradient(90deg, #00D4FF, #00FFAA)",
            boxShadow: value >= 80
              ? "0 0 12px rgba(245,158,11,0.4)"
              : "0 0 10px rgba(0,212,255,0.3)",
          }}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="absolute -left-full top-0 w-full h-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                animation: "koth-shimmer 2.5s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function kingToFunToken(t: KingToken): FunToken {
  return {
    id: t.id, name: t.name, ticker: t.ticker, image_url: t.image_url,
    mint_address: t.mint_address, dbc_pool_address: t.dbc_pool_address,
    status: t.status as any, bonding_progress: t.bonding_progress ?? 0,
    market_cap_sol: t.market_cap_sol ?? 0, holder_count: t.holder_count ?? 0,
    trading_fee_bps: t.trading_fee_bps ?? 0, fee_mode: t.fee_mode ?? null,
    agent_id: t.agent_id ?? null, launchpad_type: t.launchpad_type ?? null,
    trading_agent_id: t.trading_agent_id ?? null, is_trading_agent_token: t.is_trading_agent_token ?? false,
    creator_wallet: t.creator_wallet ?? null, twitter_url: t.twitter_url ?? null,
    twitter_avatar_url: t.twitter_avatar_url ?? null, twitter_verified: t.twitter_verified ?? false,
    twitter_verified_type: t.twitter_verified_type ?? null, telegram_url: t.telegram_url ?? null,
    website_url: t.website_url ?? null, discord_url: t.discord_url ?? null,
    created_at: t.created_at, price_sol: 0, volume_24h_sol: 0,
    description: null, total_fees_earned: 0, last_distribution_at: null, updated_at: t.created_at,
  } as unknown as FunToken;
}

/* ── premium king card ── */
function KingCard({ token, rank, quickBuyAmount, sparklineData }: { token: KingToken; rank: number; quickBuyAmount: number; sparklineData?: number[] }) {
  const navigate = useNavigate();
  const funToken = useMemo(() => kingToFunToken(token), [token]);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { solPrice } = useSolPrice();
  const progress = token.codex_graduation_percent ?? token.bonding_progress ?? 0;
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
  const checkClr = vType === "business" || vType === "government" ? "#F0B90B" : "#00D4FF";
  const holders = token.holder_count ?? 0;

  const url = `/trade/${token.mint_address || token.dbc_pool_address || token.id}`;
  const codexChartUrl = token.mint_address ? `https://www.defined.fi/sol/${token.mint_address}` : null;

  const handleCopyCA = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!token.mint_address) return;
    const ok = await copyToClipboard(token.mint_address);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  const handleSocialClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault(); e.stopPropagation();
    window.open(url, "_blank");
  };

  return (
    <div
      onClick={() => navigate(url)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col cursor-pointer"
      style={{
        background: "linear-gradient(165deg, rgba(15,15,26,0.95) 0%, rgba(5,5,15,0.98) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${isHovered ? r.hoverBorderColor : r.borderColor}`,
        borderRadius: "20px",
        padding: "16px",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isHovered ? "scale(1.015) translateY(-2px)" : "scale(1)",
        boxShadow: isHovered
          ? `0 0 32px ${r.glowColor}, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`
          : `0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)`,
        minWidth: 0,
        flex: r.king ? "1.04" : "1",
      }}
    >
      {/* Top edge glow for #1 */}
      {r.king && (
        <div
          className="absolute -top-px left-4 right-4 h-[1px] rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.5), rgba(255,215,0,0.6), rgba(245,158,11,0.5), transparent)",
          }}
        />
      )}

      {/* Holders badge - top right corner */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2 py-1 rounded-lg"
        style={{ background: "rgba(15,15,26,0.7)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
        <Users className="flex-shrink-0" style={{ width: "12px", height: "12px", color: "#4A4A5A" }} />
        <span className="font-mono font-bold" style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
          {holders >= 1000 ? `${(holders / 1000).toFixed(1)}K` : holders}
        </span>
      </div>

      {/* Cosmic speck overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-[20px] overflow-hidden"
        style={{ opacity: 0.4 }}
      >
        <div
          className="absolute w-1 h-1 rounded-full"
          style={{ background: "rgba(0,212,255,0.3)", top: "15%", left: "80%", filter: "blur(1px)" }}
        />
        <div
          className="absolute w-0.5 h-0.5 rounded-full"
          style={{ background: "rgba(0,255,170,0.2)", top: "60%", left: "20%", filter: "blur(0.5px)" }}
        />
      </div>

      {/* ── Header: Rank + Avatar + Info ── */}
      <div className="relative z-10 flex items-center gap-3 mb-3">
        {/* Rank Badge */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-xl font-black text-white relative"
          style={{
            background: r.badgeBg,
            boxShadow: r.badgeShadow,
            width: r.king ? "40px" : "34px",
            height: r.king ? "40px" : "34px",
            fontSize: r.king ? "15px" : "13px",
            animation: r.crownPulse ? "koth-crown-pulse 2s ease-in-out infinite" : undefined,
          }}
        >
          {r.label}
          {r.king && (
            <Crown
              className="absolute -top-2 -right-1.5"
              style={{
                width: "14px", height: "14px",
                color: "#FFD700",
                filter: "drop-shadow(0 0 4px rgba(255,215,0,0.5))",
              }}
            />
          )}
        </div>

        {/* Token Icon */}
        <div
          className="flex-shrink-0 overflow-hidden"
          style={{
            width: r.king ? "48px" : "42px",
            height: r.king ? "48px" : "42px",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.06)",
            transition: "box-shadow 0.3s ease",
            boxShadow: isHovered ? "0 0 12px rgba(0,212,255,0.15)" : "none",
          }}
        >
          <OptimizedTokenImage
            src={token.image_url}
            alt={token.name}
            fallbackText={token.ticker}
            size={96}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Name + X link */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap overflow-visible">
            <span
              className="font-bold leading-tight truncate max-w-[110px]"
              style={{ color: "#FFFFFF", fontSize: r.king ? "16px" : "14px", letterSpacing: "0.2px" }}
            >
              {token.name}
            </span>
            <span className="font-mono flex-shrink-0 whitespace-nowrap" style={{ color: "#6E6E80", fontSize: "11px" }}>
              ${token.ticker}
            </span>
            <LiveAge createdAt={token.created_at} className="text-[9px]" />
            {isTrader && (
              <span
                className="text-[8px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0"
                style={{ background: "rgba(0,212,255,0.08)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.12)" }}
              >
                <Bot className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />Trader
              </span>
            )}
            {isPump && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
            {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} />}
          </div>
          <div className="flex items-center gap-1 mt-0.5 min-h-[16px]">
            <svg className="w-3 h-3 flex-shrink-0" style={{ color: "#4A4A5A" }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            {xUser ? (
              <>
                {xAvatar && (
                  <img src={xAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                )}
                <span className="truncate" style={{ fontSize: "11px", color: "#00D4FF", opacity: 0.7 }}>@{xUser}</span>
                {verified && <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: checkClr }} />}
              </>
            ) : (
              <span style={{ fontSize: "11px", color: "#3A3A4A", fontStyle: "italic" }}>— None</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sparkline Chart Background Section ── */}
      <div className="relative mb-3 rounded-xl overflow-hidden" style={{ minHeight: "72px" }}>
        {/* Chart behind metrics */}
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ opacity: 0.5 }}>
          <SparklineCanvas data={sparklineData && sparklineData.length >= 2 ? sparklineData : [1, 1]} seed={token.mint_address || token.id} />
        </div>

        {/* Metrics overlay */}
        <div className="relative z-10 grid grid-cols-2 gap-x-4 gap-y-2 p-2">
          {/* MCAP */}
          <div>
            <span className="block mb-0.5 uppercase tracking-[0.12em] font-mono font-semibold" style={{ fontSize: "9px", color: "#6E6E80" }}>
              MCap
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-black font-mono tabular-nums leading-none"
                style={{
                  fontSize: "17px",
                  color: "#FFD700",
                  textShadow: "0 0 12px rgba(255,215,0,0.2)",
                }}
              >
                ${mcapUsd >= 1_000_000 ? `${(mcapUsd / 1_000_000).toFixed(2)}M` : mcapUsd >= 1_000 ? `${(mcapUsd / 1_000).toFixed(1)}K` : mcapUsd.toFixed(0)}
              </span>
              {change24h !== 0 && (
                <span
                  className="font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={{
                    fontSize: "10px",
                    color: change24h > 0 ? "#00FFAA" : "#FF4D4D",
                    background: change24h > 0 ? "rgba(0,255,170,0.1)" : "rgba(255,77,77,0.1)",
                    border: `1px solid ${change24h > 0 ? "rgba(0,255,170,0.15)" : "rgba(255,77,77,0.15)"}`,
                  }}
                >
                  {formatChange24h(change24h)}
                </span>
              )}
            </div>
          </div>

          {/* HOLDERS - moved to absolute top-right */}

          {/* VOL 24H */}
          <div className="col-span-2">
            <span className="uppercase tracking-[0.12em] font-mono font-semibold" style={{ fontSize: "9px", color: "#6E6E80" }}>
              Vol 24h
            </span>
            <span className="ml-2 font-mono font-bold" style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              ${token.codex_volume_24h_usd != null && token.codex_volume_24h_usd > 0
                ? (token.codex_volume_24h_usd >= 1_000_000
                  ? `${(token.codex_volume_24h_usd / 1_000_000).toFixed(1)}M`
                  : token.codex_volume_24h_usd >= 1_000
                    ? `${(token.codex_volume_24h_usd / 1_000).toFixed(1)}K`
                    : token.codex_volume_24h_usd.toFixed(0))
                : "0"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div className="relative z-10 mb-3">
        <ProgressBar value={progress} />
      </div>

      {/* ── Social Icons ── */}
      <div className="relative z-10 flex items-center gap-0.5 mb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px" }}>
        <TooltipProvider delayDuration={200}>
          {token.twitter_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleSocialClick(e, token.twitter_url!)}
                  className="p-1.5 rounded-lg transition-all duration-300"
                  style={{ color: "#6E6E80" }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = "#00D4FF"; (e.target as HTMLElement).style.background = "rgba(0,212,255,0.08)"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = "#6E6E80"; (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Twitter</TooltipContent>
            </Tooltip>
          )}
          {token.telegram_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleSocialClick(e, token.telegram_url!)}
                  className="p-1.5 rounded-lg transition-all duration-300"
                  style={{ color: "#6E6E80" }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = "#00D4FF"; (e.target as HTMLElement).style.background = "rgba(0,212,255,0.08)"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = "#6E6E80"; (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  <MessageCircle className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Telegram</TooltipContent>
            </Tooltip>
          )}
          {token.website_url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleSocialClick(e, token.website_url!)}
                  className="p-1.5 rounded-lg transition-all duration-300"
                  style={{ color: "#6E6E80" }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = "#00D4FF"; (e.target as HTMLElement).style.background = "rgba(0,212,255,0.08)"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = "#6E6E80"; (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  <Globe className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Website</TooltipContent>
            </Tooltip>
          )}
          {token.mint_address && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopyCA}
                  className="p-1.5 rounded-lg transition-all duration-300"
                  style={{
                    color: copied ? "#00FFAA" : "#6E6E80",
                    background: copied ? "rgba(0,255,170,0.08)" : "transparent",
                  }}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">{copied ? "Copied!" : "Copy CA"}</TooltipContent>
            </Tooltip>
          )}
          {codexChartUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(codexChartUrl, "_blank"); }}
                  className="p-1.5 rounded-lg transition-all duration-300"
                  style={{ color: "#6E6E80" }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = "#00D4FF"; (e.target as HTMLElement).style.background = "rgba(0,212,255,0.08)"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = "#6E6E80"; (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  <BarChart3 className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">Chart</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      {/* ── Action Buttons ── */}
      <div
        className="relative z-10 flex items-center gap-2"
        onClickCapture={e => e.stopPropagation()}
        onMouseDownCapture={e => e.stopPropagation()}
        onTouchStartCapture={e => e.stopPropagation()}
        onPointerDownCapture={e => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); navigate(url); }}
          className="flex-1 flex items-center justify-center gap-1.5 font-bold font-mono transition-all duration-200 active:scale-[0.96]"
          style={{
            height: "34px",
            borderRadius: "12px",
            fontSize: "12px",
            color: "#00D4FF",
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.15)",
            letterSpacing: "0.3px",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.12)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.06)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.15)";
          }}
        >
          <TrendingUp style={{ width: "13px", height: "13px" }} />
          Trade
        </button>
        <div onClick={e => e.stopPropagation()} className="king-quick-buy-wrapper flex-1">
          <PulseQuickBuyButton funToken={funToken} quickBuyAmount={quickBuyAmount} />
        </div>
      </div>
    </div>
  );
}

/* ── skeleton ── */
function KingCardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-[20px]"
      style={{
        background: "linear-gradient(165deg, rgba(15,15,26,0.95) 0%, rgba(5,5,15,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.04)",
        padding: "16px",
        flex: 1,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-12 h-12 rounded-[14px]" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <Skeleton className="h-[72px] w-full rounded-xl" />
      </div>
      <Skeleton className="h-[6px] w-full rounded-full mb-3" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-[34px] flex-1 rounded-xl" />
        <Skeleton className="h-[34px] flex-1 rounded-xl" />
      </div>
    </div>
  );
}

/* ── main export ── */
export function KingOfTheHill() {
  const { tokens, isLoading } = useKingOfTheHill();
  const [quickBuyAmount, setQuickBuyAmount] = useState(() => {
    try {
      const v = localStorage.getItem("pulse-quick-buy-amount");
      if (v) { const n = parseFloat(v); if (n > 0 && isFinite(n)) return n; }
    } catch {}
    return 0.5;
  });
  const [editingQuickBuy, setEditingQuickBuy] = useState(false);
  const [quickBuyInput, setQuickBuyInput] = useState(String(quickBuyAmount));
  const quickBuyInputRef = useRef<HTMLInputElement>(null);

  const commitQuickBuy = () => {
    const n = parseFloat(quickBuyInput);
    if (n > 0 && isFinite(n)) {
      setQuickBuyAmount(n);
      try { localStorage.setItem("pulse-quick-buy-amount", String(n)); } catch {}
    } else {
      setQuickBuyInput(String(quickBuyAmount));
    }
    setEditingQuickBuy(false);
  };

  useEffect(() => {
    if (editingQuickBuy) quickBuyInputRef.current?.focus();
  }, [editingQuickBuy]);

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
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <img
            src={BRAND.logoPath}
            alt={BRAND.shortName}
            className="w-7 h-7 md:w-9 md:h-9 object-contain"
            style={{ filter: "drop-shadow(0 0 10px rgba(245,158,11,0.25))" }}
          />
          <div>
            <h2
              className="font-black uppercase tracking-[0.1em]"
              style={{
                fontSize: "clamp(13px, 3vw, 16px)",
                color: "#FFFFFF",
                textShadow: "0 0 24px rgba(245,158,11,0.12)",
                lineHeight: 1.3,
              }}
            >
              King of the Hill
            </h2>
            <span className="tracking-wide" style={{ fontSize: "10px", color: "#4A4A5A" }}>
              Soon to Graduate
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick buy amount editor */}
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Zap style={{ width: "11px", height: "11px", color: "#F0B90B" }} />
            {editingQuickBuy ? (
              <input
                ref={quickBuyInputRef}
                type="text"
                inputMode="decimal"
                value={quickBuyInput}
                onChange={(e) => setQuickBuyInput(e.target.value.replace(/[^0-9.]/g, ""))}
                onBlur={commitQuickBuy}
                onKeyDown={(e) => { if (e.key === "Enter") commitQuickBuy(); if (e.key === "Escape") { setQuickBuyInput(String(quickBuyAmount)); setEditingQuickBuy(false); } }}
                className="w-12 bg-transparent outline-none font-mono font-bold"
                style={{ fontSize: "11px", color: "#FFFFFF", borderBottom: "1px solid rgba(0,212,255,0.4)" }}
              />
            ) : (
              <button
                onClick={() => { setQuickBuyInput(String(quickBuyAmount)); setEditingQuickBuy(true); }}
                className="flex items-center gap-0.5 font-mono font-bold transition-colors"
                style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}
              >
                {quickBuyAmount} SOL
                <Pencil style={{ width: "10px", height: "10px", color: "#4A4A5A" }} />
              </button>
            )}
          </div>
          <Link
            to="/agents/leaderboard"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all duration-200"
            style={{
              fontSize: "clamp(9px, 2vw, 11px)",
              color: "#00D4FF",
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.12)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.25)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.06)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.12)";
            }}
          >
            View Full Leaderboard
            <ArrowUpRight style={{ width: "11px", height: "11px" }} />
          </Link>
        </div>
      </div>

      {/* ── Cards Row ── */}
      <div className="relative flex items-center">
        {/* Left arrow mobile */}
        <button
          onClick={() => scroll("left")}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all md:hidden",
            canScrollLeft ? "text-foreground/80" : "text-muted-foreground/20 cursor-default",
          )}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          disabled={!canScrollLeft}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 flex flex-row md:gap-4 overflow-x-auto md:overflow-visible pb-2 md:pb-0 snap-x snap-mandatory scrollbar-hide mx-1 md:mx-0 md:px-0.5 [&>*]:snap-center [&>*]:min-w-full [&>*]:flex-shrink-0 md:[&>*]:min-w-0 md:[&>*]:flex-shrink md:[&>*]:snap-align-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading
            ? [1, 2, 3].map(i => <KingCardSkeleton key={i} />)
            : tokens?.map((t, i) => (
              <KingCard
                key={t.id}
                token={t}
                rank={i + 1}
                quickBuyAmount={quickBuyAmount}
                sparklineData={t.mint_address ? sparklines?.[t.mint_address] : undefined}
              />
            ))
          }
        </div>

        {/* Right arrow mobile */}
        <button
          onClick={() => scroll("right")}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all md:hidden",
            canScrollRight ? "text-foreground/80" : "text-muted-foreground/20 cursor-default",
          )}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          disabled={!canScrollRight}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
