import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Crown, Copy, CheckCircle, TrendingUp, TrendingDown, BadgeCheck, Sparkles, LineChart } from "lucide-react";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { PumpBadge } from "@/components/forum/PumpBadge";
import { BagsBadge } from "@/components/forum/BagsBadge";
import { PhantomBadge } from "@/components/forum/PhantomBadge";
import { PulseQuickBuyButton } from "@/components/launchpad/PulseQuickBuyButton";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatChange24h } from "@/lib/formatters";

interface TokenCardProps {
  token: FunToken;
  solPrice: number | null;
  isPromoted?: boolean;
  creatorUsername?: string | null;
  creatorAvatarUrl?: string | null;
  creatorVerified?: boolean;
  quickBuyAmount?: number;
  sparklineData?: number[];
}

interface XProfileInfo {
  profileImageUrl: string | null;
  verified: boolean;
  verifiedType: string | null;
}

const xProfileCache = new Map<string, XProfileInfo>();

function formatUsd(mcapSol: number | null | undefined, solPrice: number | null): string {
  if (!mcapSol || !solPrice) return "$0";
  const usd = mcapSol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatAge(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: false })
    .replace("about ", "")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo");
}

function extractXUsername(twitterUrl?: string | null): string | null {
  if (!twitterUrl) return null;
  try {
    const url = new URL(twitterUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

export function TokenCard({ token, solPrice, isPromoted, creatorUsername, creatorAvatarUrl, creatorVerified, quickBuyAmount, sparklineData }: TokenCardProps) {
  const [copiedCA, setCopiedCA] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [xProfile, setXProfile] = useState<XProfileInfo | null>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const isPumpFun = token.launchpad_type === 'pumpfun';
  const isBags = token.launchpad_type === 'bags';
  const isPhantom = token.launchpad_type === 'phantom';
  const isAgent = !!token.agent_id;
  const isNearGrad = (token.bonding_progress ?? 0) >= 80;
  const priceChange = token.price_change_24h ?? 0;
  const isPositive = priceChange >= 0;
  const bondingProgress = token.bonding_progress ?? 0;

  const xUsername = creatorUsername || extractXUsername(token.twitter_url);

  // Use cached DB data from fun_tokens first, then fall back to API
  useEffect(() => {
    if (!xUsername) return;

    // If props provide avatar, use those
    if (creatorAvatarUrl) {
      setXProfile({ profileImageUrl: creatorAvatarUrl, verified: creatorVerified ?? false, verifiedType: null });
      return;
    }

    // If fun_tokens already has cached twitter profile data, use it (no API call needed)
    if (token.twitter_avatar_url) {
      const info: XProfileInfo = {
        profileImageUrl: token.twitter_avatar_url,
        verified: token.twitter_verified ?? false,
        verifiedType: token.twitter_verified_type || null,
      };
      xProfileCache.set(xUsername.toLowerCase(), info);
      setXProfile(info);
      return;
    }

    // Check in-memory cache
    const cached = xProfileCache.get(xUsername.toLowerCase());
    if (cached) { setXProfile(cached); return; }

    // Only call API if no cached data exists — this will also populate the DB for next time
    let cancelled = false;
    supabase.functions.invoke('twitter-user-info', {
      body: { username: xUsername },
    }).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const info: XProfileInfo = {
        profileImageUrl: data.profileImageUrl || null,
        verified: data.verified || false,
        verifiedType: data.verifiedType || null,
      };
      xProfileCache.set(xUsername.toLowerCase(), info);
      setXProfile(info);
    });
    return () => { cancelled = true; };
  }, [xUsername, creatorAvatarUrl, creatorVerified, token.twitter_avatar_url, token.twitter_verified, token.twitter_verified_type]);

  const tradeUrl = (isPumpFun || isBags || isAgent)
    ? `/t/${token.ticker}`
    : `/trade/${token.mint_address}`;

  const mcapFormatted = formatUsd(token.market_cap_sol, solPrice);

  useEffect(() => {
    const shouldShake = Math.random() < 0.15;
    if (!shouldShake) return;
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 600);
      }
    }, 6000 + Math.random() * 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.mint_address) {
      navigator.clipboard.writeText(token.mint_address);
      setCopiedCA(true);
      toast.success("CA copied!");
      setTimeout(() => setCopiedCA(false), 2000);
    }
  };

  const avatarUrl = xProfile?.profileImageUrl || creatorAvatarUrl || null;
  const isVerified = xProfile?.verified || creatorVerified || false;
  const verifiedType = xProfile?.verifiedType;
  const checkColor = (verifiedType === 'business' || verifiedType === 'government')
    ? "hsl(38 92% 50%)"
    : "hsl(210 100% 52%)";

  return (
    <Link
      ref={cardRef}
      to={tradeUrl}
      className={`lt-card group block overflow-hidden relative ${isPulsing ? 'lt-shake' : ''} ${isNearGrad ? 'lt-card-hot' : ''}`}
    >
      {/* ── Token Image ── */}
      <div className="relative z-10 w-full" style={{ paddingBottom: "54%" }}>
        <div className="absolute inset-0">
          <OptimizedTokenImage
            src={token.image_url}
            fallbackSrc={token.mint_address ? `https://dd.dexscreener.com/ds-data/tokens/solana/${token.mint_address}.png` : undefined}
            alt={token.name}
            fallbackText={token.ticker}
            size={400}
            className="w-full h-full object-cover"
          />

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(220 25% 8%) 0%, hsl(220 25% 8% / 0.6) 30%, transparent 60%)" }} />

          {/* Top-right: age + badges */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {isNearGrad && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: "hsl(24 95% 53% / 0.85)", color: "white" }}>
                🔥
              </span>
            )}
            {isAgent && (
              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: "hsl(var(--accent-purple) / 0.85)", color: "white" }}>
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            )}
            {isPromoted && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: "hsl(38 92% 50% / 0.85)", color: "white" }}>
                <Crown className="h-2.5 w-2.5 inline" />
              </span>
            )}
          </div>

          {/* Bottom-left overlay: Market cap */}
          <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
            <span className="text-lg font-bold font-mono tracking-tight" style={{ color: "hsl(0 0% 100%)", textShadow: "0 2px 8px rgb(0 0 0 / 0.5)" }}>
              {mcapFormatted}
            </span>
            {priceChange !== 0 && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isPositive ? 'lt-price-up' : 'lt-price-down'}`}
                style={{ background: isPositive ? "hsl(160 84% 39% / 0.15)" : "hsl(0 72% 55% / 0.15)" }}>
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {formatChange24h(priceChange)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div className="relative z-10 px-3 pt-3 pb-2.5 flex flex-col">
        {/* Area between image and bonding bar — with sparkline bg */}
        <div className="relative mb-1">
          {/* Sparkline background - only in this section */}
          <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden rounded-lg">
            <SparklineCanvas data={sparklineData && sparklineData.length >= 2 ? sparklineData : [1, 1]} seed={token.mint_address || token.id} />
          </div>

          {/* Name + Ticker row */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold truncate leading-tight" style={{ color: "hsl(0 0% 95%)" }}>
              {token.name}
            </h3>
            <span className="text-xs font-mono font-semibold flex-shrink-0 text-primary">
              ${token.ticker}
            </span>
          </div>

          {/* Source badges + age */}
          <div className="relative z-10 flex items-center gap-1.5 mb-1.5 min-h-[1rem]">
            {isPumpFun && <PumpBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
            {isBags && <BagsBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" className="px-0 py-0 bg-transparent hover:bg-transparent" />}
            {isPhantom && <PhantomBadge mintAddress={token.mint_address ?? undefined} showText={false} size="sm" />}
            <span className="text-[10px] font-mono" style={{ color: "hsl(215 15% 55%)" }}>
              {formatAge(token.created_at)} ago
            </span>
          </div>

          {/* Description */}
          <p className="relative z-10 text-[11px] leading-relaxed line-clamp-2 min-h-[2.35rem] mb-2" style={{ color: "hsl(215 15% 65%)" }}>
            {token.description?.trim() ? token.description : <span className="opacity-0">placeholder line</span>}
          </p>

          {/* ── Creator Attribution ── */}
          {xUsername ? (
            <a
              href={token.twitter_url || `https://x.com/${xUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 flex items-center gap-2 mb-2 py-1.5 px-2 rounded-lg min-h-[2.25rem] transition-colors hover:bg-white/[0.04]"
              style={{ borderTop: "1px solid hsl(215 20% 25% / 0.4)" }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`@${xUsername}`}
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  style={{ border: "1.5px solid hsl(215 20% 35%)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                  style={{ background: "hsl(215 25% 20%)", color: "hsl(215 15% 55%)", border: "1.5px solid hsl(215 20% 30%)" }}>
                  {xUsername[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-medium truncate text-primary">
                @{xUsername}
              </span>
              {isVerified && (
                <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: checkColor }} />
              )}
            </a>
          ) : (
            <div
              className="relative z-10 flex items-center gap-2 mb-2 py-1.5 px-2 rounded-lg min-h-[2.25rem]"
              style={{ borderTop: "1px solid hsl(215 20% 25% / 0.4)" }}
            >
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: "hsl(215 15% 35%)" }}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-[11px] font-medium italic" style={{ color: "hsl(215 15% 40%)" }}>
                No X account
              </span>
            </div>
          )}

          {/* ── CA Copy Row ── */}
          {token.mint_address && (
            <button
              onClick={handleCopyCA}
              className="relative z-10 flex items-center gap-1.5 w-full text-left group/ca mb-2 px-2 py-1 rounded-md min-h-[1.75rem] transition-colors hover:bg-white/[0.03]"
            >
              <code className="text-[9px] font-mono truncate flex-1" style={{ color: "hsl(215 15% 45%)" }}>
                {token.mint_address.slice(0, 6)}...{token.mint_address.slice(-4)}
              </code>
              {copiedCA ? (
                <CheckCircle className="h-3 w-3 flex-shrink-0" style={{ color: "hsl(160 84% 50%)" }} />
              ) : (
                <Copy className="h-3 w-3 flex-shrink-0 opacity-40 group-hover/ca:opacity-80 transition-opacity" style={{ color: "hsl(215 15% 60%)" }} />
              )}
            </button>
          )}
        </div>

        {/* ── Bonding Progress Bar ── */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-medium tracking-wide uppercase" style={{ color: "hsl(215 15% 45%)" }}>
              Bonding Progress
            </span>
            <span className="text-[10px] font-mono font-bold" style={{
              color: bondingProgress >= 80 ? "hsl(24 95% 60%)"
                : "hsl(160 84% 55%)"
            }}>
              {bondingProgress.toFixed(bondingProgress >= 1 ? 0 : 1)}%
            </span>
          </div>
          <div className="w-full h-[7px] rounded-full overflow-hidden" style={{ background: "hsl(215 20% 20%)", boxShadow: "inset 0 1px 2px rgb(0 0 0 / 0.3)" }}>
            <div
              className="h-full rounded-full transition-all duration-700 relative overflow-hidden lt-progress-shine"
              style={{
                width: `${Math.max(Math.min(bondingProgress, 100), 3)}%`,
                background: bondingProgress >= 80
                  ? "linear-gradient(90deg, hsl(24 95% 53%), hsl(16 85% 48%))"
                  : "linear-gradient(90deg, hsl(160 84% 39%), hsl(142 76% 42%))",
                boxShadow: bondingProgress >= 80
                  ? "0 0 8px hsl(24 95% 53% / 0.4)"
                  : "0 0 8px hsl(160 84% 39% / 0.3)",
              }}
            />
          </div>
        </div>

        {/* ── Actions Row ── */}
        {quickBuyAmount != null && (
          <div className="mt-3 flex items-center justify-end gap-2" onClick={e => e.preventDefault()}>
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all hover:shadow-lg"
              style={{
                background: "hsl(80 100% 50%)",
                color: "hsl(0 0% 10%)",
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/t/${token.ticker}`;
              }}
            >
              <LineChart className="h-3 w-3" />
              <span>Chart</span>
            </button>
            <PulseQuickBuyButton funToken={token} quickBuyAmount={quickBuyAmount} />
          </div>
        )}
      </div>
    </Link>
  );
}
