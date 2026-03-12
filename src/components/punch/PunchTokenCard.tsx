import { useState } from "react";
import { ThumbsUp, ThumbsDown, Copy, Check, Users } from "lucide-react";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { Link } from "react-router-dom";
import type { PunchToken } from "@/hooks/usePunchTokenFeed";
import type { VoteCounts } from "@/hooks/usePunchVotes";
import type { TokenMarketData } from "@/hooks/usePunchMarketData";
import { formatChange24h } from "@/lib/formatters";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatMcap(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd > 0) return `$${usd.toFixed(0)}`;
  return "—";
}

function formatHolders(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Use centralized formatChange24h

interface PunchTokenCardProps {
  token: PunchToken;
  voteCounts: VoteCounts;
  onVote: (tokenId: string, voteType: 1 | -1) => void;
  marketData?: TokenMarketData;
  solPrice?: number | null;
}

export function PunchTokenCard({ token, voteCounts, onVote, marketData, solPrice }: PunchTokenCardProps) {
  const [shaking, setShaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleVote = (voteType: 1 | -1) => {
    setShaking(true);
    onVote(token.id, voteType);
    setTimeout(() => setShaking(false), 300);
  };

  const handleCopyCA = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token.mint_address) return;
    navigator.clipboard.writeText(token.mint_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Use Codex data if available, otherwise fall back to DB data
  const effectiveMcapUsd = marketData?.marketCapUsd
    ?? (token.market_cap_sol && solPrice ? token.market_cap_sol * solPrice : null);
  const effectiveHolders = marketData?.holders ?? token.holder_count ?? null;
  const rawChange = marketData?.change24h ?? null;
  const change = rawChange !== null && Math.abs(rawChange) < 0.05 ? 0 : rawChange;
  const hasChange = effectiveMcapUsd !== null; // show change whenever we have mcap data
  const displayChange = change ?? 0;
  const isNegative = displayChange < 0;
  const hasData = effectiveMcapUsd !== null || effectiveHolders !== null;

  return (
    <div
      className={`flex flex-col gap-1.5 p-2.5 rounded-xl border border-border bg-card/80 transition-all ${
        shaking ? "animate-punch-vote-shake" : ""
      }`}
    >
      {/* Top row: image + name + votes */}
      <div className="flex items-center gap-2.5">
        <Link to={token.mint_address ? `/punch/token/${token.mint_address}` : "#"} className="shrink-0">
          <OptimizedTokenImage
            src={token.image_url}
            fallbackText={token.ticker}
            size={80}
            className="w-10 h-10 rounded-lg object-cover"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <Link
            to={token.mint_address ? `/punch/token/${token.mint_address}` : "#"}
            className="block truncate text-xs font-bold text-foreground hover:text-primary transition-colors"
          >
            {token.name}
          </Link>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-mono">${token.ticker}</span>
            <span>·</span>
            <span>{timeAgo(token.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleVote(1)}
            className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-bold transition-all active:scale-110 ${
              voteCounts.userVote === 1
                ? "bg-green-500/20 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                : "text-muted-foreground hover:text-green-400 hover:bg-green-500/10"
            }`}
          >
            <ThumbsUp className="h-3 w-3" />
            <span>{voteCounts.likes}</span>
          </button>
          <button
            onClick={() => handleVote(-1)}
            className={`flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-bold transition-all active:scale-110 ${
              voteCounts.userVote === -1
                ? "bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            }`}
          >
            <ThumbsDown className="h-3 w-3" />
            <span>{voteCounts.dislikes}</span>
          </button>
        </div>
      </div>

      {/* Bottom row: market data + copy CA */}
      <div className="flex items-center gap-2 text-[10px] pl-[50px]">
        {/* Market Cap */}
        <span className="text-muted-foreground font-medium">
          MCap: <span className="text-foreground font-bold">
            {effectiveMcapUsd !== null ? formatMcap(effectiveMcapUsd) : (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground/60">
                <span className="animate-pulse">loading</span>
              </span>
            )}
          </span>
        </span>

        {/* 24h Change */}
        {hasChange && (
          <span
            className={`font-bold ${
              isNegative ? "text-red-400" : "text-green-400"
            }`}
          >
            {formatChange24h(displayChange)}
          </span>
        )}

        {/* Holders */}
        <span className="flex items-center gap-0.5 text-muted-foreground">
          <Users className="h-2.5 w-2.5" />
          <span className="font-bold text-foreground">
            {effectiveHolders !== null ? formatHolders(effectiveHolders) : (
              <span className="animate-pulse text-muted-foreground/60">...</span>
            )}
          </span>
        </span>

        {/* Copy CA */}
        {token.mint_address && (
          <button
            onClick={handleCopyCA}
            className="ml-auto flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors"
            title="Copy contract address"
          >
            {copied ? (
              <Check className="h-2.5 w-2.5 text-green-400" />
            ) : (
              <Copy className="h-2.5 w-2.5" />
            )}
            <span className="font-mono">{copied ? "Copied" : "CA"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
