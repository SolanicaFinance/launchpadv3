import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KolTweet } from "@/hooks/useKolTweets";
import { Link } from "react-router-dom";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatUsd(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function KolTweetCard({ tweet }: { tweet: KolTweet }) {
  const isSolana = tweet.chain === "solana";
  const explorerUrl = isSolana
    ? `/trade/${tweet.contract_address}`
    : `https://etherscan.io/token/${tweet.contract_address}`;

  return (
    <div className="group flex flex-col gap-3 p-4 rounded-xl transition-all duration-300
                    bg-card/30 backdrop-blur-sm border border-border/20
                    hover:border-primary/30 hover:bg-card/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.06)]">
      {/* Header: KOL info + time */}
      <div className="flex items-center gap-2.5">
        {tweet.kol_profile_image ? (
          <img
            src={tweet.kol_profile_image}
            alt={tweet.kol_username}
            className="w-8 h-8 rounded-full object-cover border border-border/30 flex-shrink-0 group-hover:ring-1 group-hover:ring-primary/20 transition-all"
            loading="lazy"
            width={32}
            height={32}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
            {tweet.kol_username[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <a
            href={`https://x.com/${tweet.kol_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-foreground hover:text-primary truncate block transition-colors"
          >
            @{tweet.kol_username}
          </a>
        </div>
        <span className="text-[11px] text-muted-foreground flex-shrink-0 font-mono">
          {timeAgo(tweet.tweeted_at)}
        </span>
      </div>

      {/* Tweet text */}
      {tweet.tweet_text && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {tweet.tweet_text}
        </p>
      )}

      {/* Token info */}
      <div className="flex items-center gap-2 bg-background/40 rounded-lg p-2.5 border border-border/10">
        {tweet.token_image_url ? (
          <img
            src={tweet.token_image_url}
            alt={tweet.token_symbol || ""}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
            {tweet.token_symbol?.[0] || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {tweet.token_name || shortenAddress(tweet.contract_address)}
            </span>
            {tweet.token_symbol && (
              <span className="text-[11px] text-muted-foreground font-mono">${tweet.token_symbol}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {tweet.token_price_usd !== null && (
              <span className="text-[11px] text-primary font-medium font-mono">
                {formatUsd(tweet.token_price_usd)}
              </span>
            )}
            {tweet.token_market_cap !== null && (
              <span className="text-[11px] text-muted-foreground font-mono">
                MC {formatUsd(tweet.token_market_cap)}
              </span>
            )}
          </div>
        </div>
        <Badge variant={isSolana ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
          {isSolana ? "SOL" : "EVM"}
        </Badge>
      </div>

      {/* Footer: links */}
      <div className="flex items-center gap-3">
        {tweet.tweet_url && (
          <a
            href={tweet.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Tweet
          </a>
        )}
        {isSolana ? (
          <Link
            to={explorerUrl}
            className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Trade
          </Link>
        ) : (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Explorer
          </a>
        )}
      </div>
    </div>
  );
}
