import { Link } from "react-router-dom";
import { useTickerTokens } from "@/hooks/useTickerTokens";

export function TokenTickerBar() {
  const { tokens, isLoading } = useTickerTokens();

  if (isLoading || tokens.length === 0) {
    return null;
  }

  const uniqueTokens = tokens.filter((t, i, arr) => arr.findIndex(x => x.ticker === t.ticker) === i);
  const displayTokens = [...uniqueTokens, ...uniqueTokens, ...uniqueTokens, ...uniqueTokens];

  return (
    <div className="gate-ticker-bar w-full">
      <div className="animate-ticker">
        {displayTokens.map((token, index) => {
          const priceChange = token.price_change_24h || 0;
          return (
            <Link
              key={`${token.id}-${index}`}
              to={`/token/${token.id}`}
              className="gate-ticker-item hover:opacity-70 transition-opacity"
            >
              {token.image_url ? (
                <img
                  src={token.image_url}
                  alt={token.ticker}
                  className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground flex-shrink-0">
                  {token.ticker?.[0] || "?"}
                </div>
              )}
              <span className="gate-ticker-symbol">
                {token.ticker}
              </span>
              <span
                className={`gate-ticker-change ${
                  priceChange >= 0 ? "gate-price-up" : "gate-price-down"
                }`}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
