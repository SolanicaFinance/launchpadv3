import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Globe, Users, Copy, CheckCircle, Sparkles, ArrowUpRight, ArrowDownRight, ExternalLink, MessageCircle, Search } from "lucide-react";
import { PulseQuickBuyButton } from "./PulseQuickBuyButton";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { toast } from "sonner";

interface AxiomTokenRowProps {
  token: FunToken;
  solPrice: number | null;
  quickBuyAmount?: number;
}

function formatUsd(mcapSol: number | null | undefined, solPrice: number | null): string {
  if (!mcapSol || !solPrice) return "$0";
  const usd = mcapSol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatVolume(vol: number | null | undefined, solPrice: number | null): string {
  if (!vol || !solPrice) return "$0";
  const usd = vol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatAge(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: false })
    .replace("about ", "")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo")
    .replace("less than a", "<1");
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

function formatHolders(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export const AxiomTokenRow = memo(function AxiomTokenRow({ token, solPrice, quickBuyAmount }: AxiomTokenRowProps) {
  const [copiedCA, setCopiedCA] = useState(false);
  const bondingProgress = token.bonding_progress ?? 0;
  const isAgent = !!token.agent_id;
  const xUsername = extractXUsername(token.twitter_url);
  const mcap = formatUsd(token.market_cap_sol, solPrice);
  const vol = formatVolume(token.volume_24h_sol, solPrice);
  const fees = formatUsd(token.total_fees_earned, solPrice);
  const holders = token.holder_count ?? 0;
  const age = formatAge(token.created_at);
  const shortAddr = token.mint_address ? `${token.mint_address.slice(0, 4)}...${token.mint_address.slice(-4)}` : "";
  const priceChange = token.price_change_24h ?? 0;

  const tradeUrl = token.mint_address
    ? `/trade/${token.mint_address}`
    : `/trade/${token.id}`;

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

  return (
    <Link to={tradeUrl} className="pulse-card group">
      {/* Row 1: Avatar + Info + Metrics */}
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className="pulse-avatar-wrap">
          <div className="pulse-avatar">
            <OptimizedTokenImage
              src={token.image_url}
              fallbackText={token.ticker}
              size={48}
              loading="eager"
              alt={token.name}
              className="w-full h-full object-cover"
            />
          </div>
          {token.status === 'graduated' && <div className="pulse-verified-dot" />}
        </div>

        {/* Center info block */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Name + symbol + link */}
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-bold text-foreground truncate leading-tight">{token.ticker}</span>
            <span className="text-[11px] text-muted-foreground/70 truncate italic">{token.name}</span>
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />
            {isAgent && (
              <span className="axiom-agent-badge">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            )}
          </div>

          {/* Line 2: Age + social icons row with counts */}
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-foreground/50">{age}</span>
            <span className="pulse-icon-separator" />
            {token.twitter_url && (
              <a href={token.twitter_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="pulse-social-icon">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            )}
            <span className="pulse-social-icon"><Users className="h-2.5 w-2.5" /></span>
            {token.website_url && (
              <a href={token.website_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="pulse-social-icon">
                <Globe className="h-2.5 w-2.5" />
              </a>
            )}
            <span className="pulse-social-icon"><MessageCircle className="h-2.5 w-2.5" /></span>
            <span className="pulse-social-icon"><Search className="h-2.5 w-2.5" /></span>
            {holders > 0 && (
              <span className="text-[9px] font-mono text-foreground/45">{formatHolders(holders)}</span>
            )}
          </div>

          {/* Line 3: Creator line */}
          <div className="flex items-center gap-1 mt-0.5">
            {xUsername ? (
              <span className="text-[10px] text-foreground/45 font-mono">by <span className="text-foreground/65">@{xUsername}</span></span>
            ) : (
            <span className="text-[10px] text-foreground/40 font-mono">by {token.launchpad_type === 'dbc' ? 'Meteora' : token.launchpad_type === 'pump' ? 'Pump.fun' : token.creator_wallet.slice(0, 6) + '...'}</span>
            )}
            {holders > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-foreground/40">
                <Users className="h-2.5 w-2.5" />{formatHolders(holders)}
              </span>
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
            <span className="text-[11px] font-mono font-semibold text-foreground/80">{fees}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="pulse-metric-label">TX</span>
            <span className="text-[11px] font-mono font-semibold text-foreground/80">{formatHolders(holders)}</span>
            {priceChange !== 0 && (
              <>
                {priceChange > 0 ? (
                  <ArrowUpRight className="h-2.5 w-2.5 text-success" />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5 text-destructive" />
                )}
                <span className={`text-[9px] font-mono font-bold ${priceChange > 0 ? "text-success" : "text-destructive"}`}>
                  {priceChange > 0 ? "+" : ""}{priceChange.toFixed(0)}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Bottom bar */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          {/* Progress % */}
          <div className="flex items-center gap-1">
            {bondingProgress > 0 && (
              <ArrowUpRight className="h-2.5 w-2.5 text-success" />
            )}
            <span className="text-[9px] font-mono font-bold" style={{
              color: bondingProgress >= 80 ? "hsl(38 92% 50%)" : bondingProgress >= 50 ? "hsl(45 93% 47%)" : "hsl(160 84% 39%)"
            }}>
              {bondingProgress.toFixed(bondingProgress >= 1 ? 0 : 1)}%
            </span>
          </div>

          {/* Colored % dots */}
          {token.trading_fee_bps != null && (
            <span className="pulse-metric-dot pulse-metric-dot--neutral">
              {(token.trading_fee_bps / 100).toFixed(0)}%
            </span>
          )}

          {/* DS badge */}
          <span className="pulse-metric-dot pulse-metric-dot--neutral">DS</span>

          {/* Paid badge */}
          {token.fee_mode === 'paid' && (
            <span className="pulse-metric-dot pulse-metric-dot--success">Paid</span>
          )}

          {/* Short address */}
          {shortAddr && (
            <button
              onClick={handleCopyCA}
              className="flex items-center gap-0.5 text-[9px] font-mono text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              {copiedCA ? <CheckCircle className="h-2 w-2 text-success" /> : <Copy className="h-2 w-2" />}
              <span>{shortAddr}</span>
            </button>
          )}
        </div>

        {/* Quick Buy button */}
        <PulseQuickBuyButton funToken={token} quickBuyAmount={quickBuyAmount} />
      </div>
    </Link>
  );
});
