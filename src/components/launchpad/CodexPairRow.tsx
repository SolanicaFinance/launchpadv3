import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Users, Copy, CheckCircle, Globe, ArrowUpRight, ArrowDownRight, ExternalLink, MessageCircle, Crown } from "lucide-react";
import { PulseQuickBuyButton } from "./PulseQuickBuyButton";
import { CodexPairToken } from "@/hooks/useCodexNewPairs";
import { LaunchpadBadge } from "./LaunchpadBadge";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { SparklineCanvas } from "./SparklineCanvas";
import { toast } from "sonner";
import type { SupportedChain } from "@/contexts/ChainContext";
import { formatChange24h } from "@/lib/formatters";

function formatUsdCompact(usd: number): string {
  if (!isFinite(usd) || usd > 1e15) return "$?";
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(0)}`;
  return "$0";
}

function formatAge(createdAt: string | null): string {
  if (!createdAt) return "?";
  try {
    return formatDistanceToNow(new Date(parseInt(createdAt) * 1000), { addSuffix: false })
      .replace("about ", "")
      .replace(" hours", "h").replace(" hour", "h")
      .replace(" minutes", "m").replace(" minute", "m")
      .replace(" seconds", "s").replace(" second", "s")
      .replace(" days", "d").replace(" day", "d")
      .replace(" months", "mo").replace(" month", "mo")
      .replace("less than a", "<1");
  } catch {
    return "?";
  }
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

function formatTxCount(holders: number): string {
  if (holders >= 1000) return `${(holders / 1000).toFixed(1)}K`;
  return String(holders);
}

function getExplorerUrl(address: string, chain: SupportedChain): string {
  if (chain === 'bnb') return `https://bscscan.com/token/${address}`;
  return `https://solscan.io/token/${address}`;
}

export const CodexPairRow = memo(function CodexPairRow({ token, quickBuyAmount, proTraders = 0, sparklineData, chain = 'solana' }: { token: CodexPairToken; quickBuyAmount?: number; proTraders?: number; sparklineData?: number[]; chain?: SupportedChain }) {
  const [copiedCA, setCopiedCA] = useState(false);
  const gradPct = token.graduationPercent ?? 0;
  const mcap = formatUsdCompact(token.marketCap);
  const vol = formatUsdCompact(token.volume24h);
  const liq = formatUsdCompact(token.liquidity);
  const age = formatAge(token.createdAt);
  const xUsername = extractXUsername(token.twitterUrl);
  const isBnb = chain === 'bnb';
  const shortAddr = token.address
    ? isBnb
      ? `${token.address.slice(0, 6)}...${token.address.slice(-4)}`
      : `${token.address.slice(0, 4)}...${token.address.slice(-4)}`
    : "";

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.address) {
      navigator.clipboard.writeText(token.address);
      setCopiedCA(true);
      toast.success("CA copied!");
      setTimeout(() => setCopiedCA(false), 2000);
    }
  };

  const tradeUrl = token.address
    ? `/trade/${token.address}`
    : "#";

  return (
    <Link
      to={tradeUrl}
      className="pulse-card group relative overflow-hidden"
    >
      <div className="relative">
        {/* Sparkline background - starts after avatar (left offset ~60px) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <SparklineCanvas data={sparklineData && sparklineData.length >= 2 ? sparklineData : [1, 1]} seed={token.address || token.symbol} />
        </div>
        {/* Row 1: Avatar + Info + Metrics */}
        <div className="relative z-10 flex items-start gap-2.5">
        {/* Avatar */}
        <div className="pulse-avatar-wrap relative z-20">
          <div className="pulse-avatar">
            <OptimizedTokenImage
              src={token.imageUrl}
              fallbackText={token.symbol}
              size={48}
              loading="eager"
              alt={token.name}
              className="w-full h-full object-cover"
            />
          </div>
          {token.migrated && <div className="pulse-verified-dot" />}
        </div>

        {/* Center info */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Symbol + name + link */}
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-bold text-foreground truncate leading-tight">{token.symbol}</span>
            <span className="text-[11px] text-muted-foreground/70 truncate italic">{token.name}</span>
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />
          </div>

          {/* Line 2: Age + social icons + holders + pro traders */}
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-foreground/50">{age}</span>
            <span className="pulse-icon-separator" />
            {token.twitterUrl && (
              <a href={token.twitterUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="pulse-social-icon" title="Twitter">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            )}
            {token.websiteUrl && (
              <a href={token.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="pulse-social-icon" title="Website">
                <Globe className="h-2.5 w-2.5" />
              </a>
            )}
            {token.telegramUrl && (
              <a href={token.telegramUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="pulse-social-icon" title="Telegram">
                <MessageCircle className="h-2.5 w-2.5" />
              </a>
            )}
            <span className="pulse-icon-separator" />
            {token.holders > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-foreground/50" title="Holders">
                <Users className="h-2.5 w-2.5" />{formatTxCount(token.holders)}
              </span>
            )}
            {proTraders > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-primary/80" title="Pro Traders">
                <Crown className="h-2.5 w-2.5" />{proTraders}
              </span>
            )}
          </div>

          {/* Line 3: Creator line */}
          <div className="flex items-center gap-1 mt-0.5">
            {xUsername ? (
              <span className="text-[10px] text-foreground/45 font-mono">by <span className="text-foreground/65">@{xUsername}</span></span>
            ) : (
              <span className="text-[10px] text-foreground/40 font-mono">by {token.launchpadName}</span>
            )}
          </div>
        </div>

        {/* Right metrics */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0 min-w-[72px]">
          <div className="flex items-center gap-1">
            <span className="pulse-metric-label">MC</span>
            <span className="text-[14px] font-mono font-bold text-foreground leading-tight">{mcap}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="pulse-metric-label">V</span>
            <span className="text-[11px] font-mono font-semibold text-foreground/85">{vol}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="pulse-metric-label">F</span>
            <span className="text-[11px] font-mono font-semibold text-foreground/80">{liq}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="pulse-metric-label">TX</span>
            <span className="text-[11px] font-mono font-semibold text-foreground/80">{formatTxCount(token.holders)}</span>
            {token.change24h !== 0 && (
              <>
                {token.change24h > 0 ? (
                  <ArrowUpRight className="h-2.5 w-2.5 text-success" />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5 text-destructive" />
                )}
                <span className={`text-[9px] font-mono font-bold ${token.change24h > 0 ? "text-success" : "text-destructive"}`}>
                  {formatChange24h(token.change24h)}
                </span>
              </>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Row 2: Bottom bar */}
      <div className="relative z-10 flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          {/* Progress % — only show for Solana launchpad tokens */}
          {!isBnb && (
            <div className="flex items-center gap-1">
              {gradPct > 0 && (
                <ArrowUpRight className="h-2.5 w-2.5 text-success" />
              )}
              <span className="text-[9px] font-mono font-bold" style={{
                color: gradPct >= 80 ? "hsl(38 92% 50%)" : gradPct >= 50 ? "hsl(45 93% 47%)" : "hsl(160 84% 39%)"
              }}>
                {gradPct.toFixed(gradPct >= 1 ? 0 : 1)}%
              </span>
            </div>
          )}

          <LaunchpadBadge launchpadName={token.launchpadName} iconUrl={token.launchpadIconUrl} />

          {/* DS badge */}
          <span className="pulse-metric-dot pulse-metric-dot--neutral">DS</span>

          {/* Paid badge */}
          {token.completed && (
            <span className="pulse-metric-dot pulse-metric-dot--success">Paid</span>
          )}

          {/* Short address + explorer link */}
          {shortAddr && (
            <button
              onClick={handleCopyCA}
              className="flex items-center gap-0.5 text-[9px] font-mono text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              {copiedCA ? <CheckCircle className="h-2 w-2 text-success" /> : <Copy className="h-2 w-2" />}
              <span>{shortAddr}</span>
            </button>
          )}

          {/* Explorer link for BNB */}
          {isBnb && token.address && (
            <a
              href={getExplorerUrl(token.address, chain)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[9px] font-mono text-foreground/40 hover:text-foreground/70 transition-colors"
              title="View on BscScan"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        {/* Quick Buy button */}
        <PulseQuickBuyButton codexToken={token} quickBuyAmount={quickBuyAmount} chain={chain} />
      </div>
    </Link>
  );
});
