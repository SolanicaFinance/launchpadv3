import { useState, useEffect } from "react";
import { TrendingUp, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface WidgetConfig {
  apiKey: string;
  theme: "dark" | "light";
  accentColor?: string;
  hideHeader?: boolean;
  limit?: number;
}

interface TokenListWidgetProps {
  config: WidgetConfig;
}

interface Token {
  mintAddress: string;
  poolAddress: string;
  name: string;
  ticker: string;
  price: number;
  marketCap: number;
  volume24h: number;
  status: string;
}

const BASE_URL = "https://ptwytypavumcrbofspno.supabase.co/functions/v1";

export default function TokenListWidget({ config }: TokenListWidgetProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api-swap/pools`, {
          headers: {
            "x-api-key": config.apiKey,
          },
        });
        const data = await response.json();
        
        if (data.success) {
          setTokens(data.pools.slice(0, config.limit || 10));
        } else {
          toast.error("Failed to load tokens");
        }
      } catch (error) {
        toast.error("Failed to load tokens");
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [config.apiKey, config.limit]);

  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 1e6) return `${(mc / 1e6).toFixed(2)}M`;
    if (mc >= 1e3) return `${(mc / 1e3).toFixed(1)}K`;
    return mc.toFixed(0);
  };

  const handleTokenClick = (token: Token) => {
    window.parent.postMessage({
      type: "token-selected",
      data: {
        mintAddress: token.mintAddress,
        poolAddress: token.poolAddress,
        name: token.name,
        ticker: token.ticker,
      },
    }, "*");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="w-6 h-6 border-2 border-transparent border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      {!config.hideHeader && (
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Trending Tokens
          </CardTitle>
          <CardDescription>Top tokens by market cap</CardDescription>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {tokens.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No tokens found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tokens.map((token, index) => (
              <div
                key={token.mintAddress}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleTokenClick(token)}
              >
                {/* Rank */}
                <span className="text-sm font-bold text-muted-foreground w-6">
                  #{index + 1}
                </span>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{token.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      ${token.ticker}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatPrice(token.price)} SOL</span>
                    <span>•</span>
                    <span>MC: {formatMarketCap(token.marketCap)} SOL</span>
                  </div>
                </div>

                {/* Status & Link */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge 
                    variant={token.status === "bonding" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {token.status}
                  </Badge>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Powered by Saturn
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
