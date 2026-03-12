import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentTokens } from "@/hooks/useAgentTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { formatChange24h } from "@/lib/formatters";

export function AgentTopTokens() {
  const { data: tokens, isLoading } = useAgentTokens({ sort: "mcap", limit: 5 });
  const { solPrice } = useSolPrice();

  const formatUSD = (solAmount: number) => {
    const usd = solAmount * (solPrice || 0);
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Card className="gate-card">
        <div className="gate-card-header">
          <h2 className="gate-card-title">
            <Trophy className="h-5 w-5 text-warning" />
            Top by Market Cap
          </h2>
        </div>
        <div className="gate-card-body">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <Card className="gate-card">
        <div className="gate-card-header">
          <h2 className="gate-card-title">
            <Trophy className="h-5 w-5 text-warning" />
            Top by Market Cap
          </h2>
        </div>
        <div className="gate-card-body text-center py-8">
          <p className="text-muted-foreground">No agent tokens yet. Be the first to launch!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="gate-card">
      <div className="gate-card-header">
        <h2 className="gate-card-title">
          <Trophy className="h-5 w-5 text-warning" />
          Top by Market Cap
        </h2>
      </div>
      <div className="gate-card-body">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {tokens.slice(0, 5).map((agentToken, index) => {
            const token = agentToken.token;
            if (!token) return null;
            
            const priceChange = token.priceChange24h || 0;
            const isPositive = priceChange >= 0;

            return (
              <Link
                key={agentToken.id}
                to={`/t/${token.ticker}`}
                className="block"
              >
                <div className="bg-secondary/30 hover:bg-secondary/50 border border-border rounded-lg p-4 transition-all hover:border-primary/50">
                  {/* Rank Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      #{index + 1}
                    </Badge>
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatChange24h(priceChange)}
                    </div>
                  </div>

                  {/* Token Image */}
                  <div className="flex justify-center mb-3">
                    {token.imageUrl ? (
                      <img
                        src={token.imageUrl}
                        alt={token.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {token.ticker?.[0] || "?"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="text-center">
                    <p className="font-semibold text-foreground text-sm truncate">
                      ${token.ticker}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {token.name}
                    </p>
                    <p className="text-sm font-medium text-primary mt-1">
                      {formatUSD(token.marketCapSol)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
