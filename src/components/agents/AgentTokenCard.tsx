import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingUp, TrendingDown, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatChange24h } from "@/lib/formatters";

interface AgentTokenCardProps {
  id: string;
  agentName: string;
  agentAvatarUrl?: string | null;
  sourcePlatform: string;
  sourcePostUrl: string | null;
  createdAt: string;
  token: {
    name: string;
    ticker: string;
    mintAddress: string;
    imageUrl: string | null;
    marketCapSol: number;
    priceChange24h: number;
  };
  solPrice: number;
}

export function AgentTokenCard({
  id,
  agentName,
  agentAvatarUrl,
  sourcePlatform,
  sourcePostUrl,
  createdAt,
  token,
  solPrice,
}: AgentTokenCardProps) {
  const priceChange = token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  const formatUSD = (solAmount: number) => {
    const usd = solAmount * (solPrice || 0);
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source.toLowerCase()) {
      case "api":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "twitter":
        return "bg-sky-500/10 text-sky-500 border-sky-500/30";
      case "telegram":
        return "bg-purple-500/10 text-purple-500 border-purple-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all">
      <div className="flex items-start gap-4">
        {/* Token Image */}
        <Link to={`/t/${token.ticker}`} className="flex-shrink-0">
          {token.imageUrl ? (
            <img
              src={token.imageUrl}
              alt={token.name}
              className="w-14 h-14 rounded-lg object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {token.ticker?.[0] || "?"}
              </span>
            </div>
          )}
        </Link>

        {/* Token Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/t/${token.ticker}`}
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              ${token.ticker}
            </Link>
            <Badge variant="outline" className={getSourceBadgeColor(sourcePlatform)}>
              {sourcePlatform.toUpperCase()}
            </Badge>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatChange24h(priceChange)}
            </div>
          </div>

          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {token.name}
          </p>

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {agentAvatarUrl ? (
                <img src={agentAvatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <Bot className="h-3 w-3" />
              )}
              {agentName}
            </span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
            <span>·</span>
            <span className="text-primary font-medium">{formatUSD(token.marketCapSol)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {sourcePostUrl && (
            <a href={sourcePostUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                Post
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
          <Link to={`/t/${token.ticker}`}>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
              View
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
