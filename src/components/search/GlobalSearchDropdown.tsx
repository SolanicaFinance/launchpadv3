import { useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { SearchResult } from "@/hooks/useTokenSearch";
import { cn } from "@/lib/utils";
import { Loader2, TrendingUp, TrendingDown, Droplets, BarChart3 } from "lucide-react";

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n === 0) return "$0";
  return `$${n.toFixed(2)}`;
}

function formatPrice(priceStr: string | null): string {
  if (!priceStr) return "—";
  const p = Number.parseFloat(priceStr);
  if (!Number.isFinite(p)) return "—";
  if (p === 0) return "$0";
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toPrecision(3)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

function normalizeChainId(chainId: string): string {
  const chain = chainId?.toLowerCase() || "unknown";
  if (chain === "bnb" || chain === "binance") return "bsc";
  if (chain === "eth") return "ethereum";
  if (chain === "sol") return "solana";
  return chain;
}

function getChainBadge(chainId: string) {
  const chain = normalizeChainId(chainId);
  if (chain === "solana") return { label: "SOL", hue: "268 100% 63%" };
  if (chain === "ethereum") return { label: "ETH", hue: "225 77% 65%" };
  if (chain === "bsc") return { label: "BNB", hue: "44 90% 52%" };
  if (chain === "base") return { label: "BASE", hue: "220 100% 58%" };
  return { label: chain.slice(0, 4).toUpperCase(), hue: "0 0% 62%" };
}

function buildTokenImageFallbacks(address: string, chainId: string): string[] {
  if (!address) return [];

  const normalizedAddress = address.trim();
  const lowercaseAddress = normalizedAddress.toLowerCase();
  const normalizedChain = normalizeChainId(chainId);
  const dexChain = normalizedChain === "bsc" ? "bsc" : normalizedChain;

  const fallbacks = [
    `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${normalizedAddress}.png`,
  ];

  if (dexChain === "bsc") {
    fallbacks.push(`https://tokens.1inch.io/56/${lowercaseAddress}.png`);
    fallbacks.push(`https://tokens.pancakeswap.finance/images/symbol/${lowercaseAddress}.png`);
    fallbacks.push(`https://tokens.pancakeswap.finance/images/${lowercaseAddress}.png`);
  }

  fallbacks.push(`https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(lowercaseAddress)}`);

  return fallbacks.filter((src, index, all) => !!src && all.indexOf(src) === index);
}

interface Props {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onClose: () => void;
  inline?: boolean;
}

export function GlobalSearchDropdown({ results, isLoading, query, onClose, inline = false }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inline) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, inline]);

  const grouped = useMemo(() => {
    const solanaResults = results.filter((r) => normalizeChainId(r.chainId) === "solana");
    const otherResults = results.filter((r) => normalizeChainId(r.chainId) !== "solana");
    return [...solanaResults, ...otherResults];
  }, [results]);

  if (query.length < 2) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "z-50 overflow-hidden rounded-2xl border border-border/70 bg-background/90 shadow-xl backdrop-blur-2xl animate-fade-in",
        inline ? "relative mt-2 w-full" : "absolute left-0 right-0 top-full mt-1.5"
      )}
      style={{
        WebkitBackdropFilter: "blur(24px)",
        maxHeight: inline ? "min(70dvh, 520px)" : "460px",
      }}
    >
      <div className="px-3.5 sm:px-4 py-2.5 flex items-center justify-between border-b border-border/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Search Results
        </span>

        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary/80" />
        ) : grouped.length > 0 ? (
          <span className="text-[10px] text-muted-foreground/70 font-mono">{grouped.length} found</span>
        ) : null}
      </div>

      {isLoading && results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
          <span className="text-xs text-muted-foreground">Searching across chains...</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center px-5">
          <p className="text-sm text-foreground/80 mb-1">No tokens found</p>
          <p className="text-[11px] text-muted-foreground">Try a different name, ticker, or address</p>
        </div>
      ) : (
        <div className={cn("overflow-y-auto custom-scrollbar", inline ? "max-h-[min(64dvh,460px)]" : "max-h-[410px]")}>
          {grouped.map((r, i) => {
            const change = r.priceChange24h;
            const isPositive = change !== null && change >= 0;
            const isSolana = normalizeChainId(r.chainId) === "solana";
            const chain = getChainBadge(r.chainId);
            const imageFallbacks = buildTokenImageFallbacks(r.baseToken.address, r.chainId);

            return (
              <button
                key={`${r.baseToken.address}-${r.pairAddress}-${i}`}
                onClick={() => {
                  if (r.baseToken.address) {
                    const chain = normalizeChainId(r.chainId);
                    if (chain === "solana") {
                      navigate(`/trade/${r.baseToken.address}`);
                    } else if (chain === "bsc") {
                      navigate(`/trade/${r.baseToken.address}?chain=bnb`);
                    } else {
                      navigate(`/trade/${r.baseToken.address}?chain=${chain}`);
                    }
                  }
                  onClose();
                }}
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 transition-colors text-left group hover:bg-muted/35 active:bg-muted/50"
                style={{
                  borderBottom: i < grouped.length - 1 ? "1px solid hsl(var(--border) / 0.35)" : "none",
                }}
              >
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-xl overflow-hidden border border-border/70 bg-card/60">
                    <OptimizedTokenImage
                      src={r.imageUrl}
                      fallbackSrc={imageFallbacks}
                      fallbackText={r.baseToken.symbol || "?"}
                      alt={`${r.baseToken.symbol || "Token"} icon`}
                      size={36}
                      style={{ width: 36, height: 36, objectFit: "cover", display: "block" }}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {r.baseToken.symbol || "?"}
                    </span>
                    <span className="hidden xs:inline text-[11px] text-muted-foreground truncate max-w-[110px]">
                      {r.baseToken.name || "Unknown token"}
                    </span>
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide flex-shrink-0 border"
                      style={{
                        backgroundColor: `hsl(${chain.hue} / 0.14)`,
                        color: `hsl(${chain.hue})`,
                        borderColor: `hsl(${chain.hue} / 0.32)`,
                      }}
                    >
                      {chain.label}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2.5 sm:gap-3 flex-wrap">
                    <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                      <BarChart3 className="h-2.5 w-2.5" />
                      MCap {formatNumber(r.marketCap)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                      <Droplets className="h-2.5 w-2.5" />
                      Liq {formatNumber(r.liquidity)}
                    </span>
                    {r.volume24h > 0 && (
                      <span className="hidden sm:flex text-[10px] text-muted-foreground/70 items-center gap-1">
                        Vol {formatNumber(r.volume24h)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 min-w-[98px] sm:min-w-[114px] flex flex-col items-end gap-0.5">
                  <span className="text-[12px] sm:text-[13px] font-mono font-semibold text-foreground">
                    {formatPrice(r.priceUsd)}
                  </span>

                  {change !== null && (
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
                        isPositive ? "text-success bg-success/15" : "text-destructive bg-destructive/15"
                      )}
                    >
                      {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {isPositive ? "+" : ""}
                      {change.toFixed(1)}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

