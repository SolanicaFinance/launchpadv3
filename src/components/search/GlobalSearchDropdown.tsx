import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { SearchResult } from "@/hooks/useTokenSearch";
import { Loader2, TrendingUp, TrendingDown, Droplets, BarChart3 } from "lucide-react";

function formatNumber(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(priceStr: string | null): string {
  if (!priceStr) return "—";
  const p = parseFloat(priceStr);
  if (p === 0) return "$0";
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toPrecision(3)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

function getChainBadge(chainId: string) {
  const chain = chainId?.toLowerCase() || "unknown";
  if (chain === "solana") return { label: "SOL", color: "#9945FF", bg: "rgba(153,69,255,0.12)" };
  if (chain === "ethereum") return { label: "ETH", color: "#627EEA", bg: "rgba(98,126,234,0.12)" };
  if (chain === "bsc") return { label: "BNB", color: "#F0B90B", bg: "rgba(240,185,11,0.12)" };
  if (chain === "base") return { label: "BASE", color: "#0052FF", bg: "rgba(0,82,255,0.12)" };
  return { label: chain.slice(0, 4).toUpperCase(), color: "#888", bg: "rgba(136,136,136,0.12)" };
}

function getDexScreenerFallback(address: string, chainId: string): string {
  const dexChain = chainId === "bsc" ? "bsc" : chainId;
  return `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${address}.png`;
}

interface Props {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onClose: () => void;
}

export function GlobalSearchDropdown({ results, isLoading, query, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (query.length < 2) return null;

  const solanaResults = results.filter(r => r.chainId === "solana");
  const otherResults = results.filter(r => r.chainId !== "solana");
  const grouped = [...solanaResults, ...otherResults];

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: "rgba(10,12,18,0.96)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 16px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)",
        maxHeight: "460px",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Search Results
        </span>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
        )}
        {!isLoading && grouped.length > 0 && (
          <span className="text-[10px] text-muted-foreground/40 font-mono">
            {grouped.length} found
          </span>
        )}
      </div>

      {isLoading && results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
          <span className="text-xs text-muted-foreground/50">Searching across chains...</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground/60 mb-1">No tokens found</p>
          <p className="text-[11px] text-muted-foreground/30">Try a different name, ticker, or address</p>
        </div>
      ) : (
        <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: "410px" }}>
          {grouped.map((r, i) => {
            const change = r.priceChange24h;
            const isPositive = change !== null && change >= 0;
            const isSolana = r.chainId === "solana";
            const chain = getChainBadge(r.chainId);

            const imageFallbacks = [
              getDexScreenerFallback(r.baseToken.address, r.chainId),
              `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(r.baseToken.address)}`,
            ];

            return (
              <button
                key={`${r.baseToken.address}-${r.pairAddress}-${i}`}
                onClick={() => {
                  if (isSolana && r.baseToken.address) {
                    navigate(`/trade/${r.baseToken.address}`);
                  }
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-all text-left group"
                style={{
                  borderBottom: i < grouped.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Token Image */}
                <div className="relative flex-shrink-0">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <OptimizedTokenImage
                      src={r.imageUrl}
                      fallbackSrc={imageFallbacks}
                      fallbackText={r.baseToken.symbol}
                      size={36}
                      style={{ width: 36, height: 36, objectFit: "cover", display: "block" }}
                    />
                  </div>
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      ${r.baseToken.symbol}
                    </span>
                    <span className="text-[11px] text-muted-foreground/50 truncate max-w-[100px]">
                      {r.baseToken.name}
                    </span>
                    {/* Chain badge */}
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide flex-shrink-0"
                      style={{
                        background: chain.bg,
                        color: chain.color,
                        border: `1px solid ${chain.color}20`,
                      }}
                    >
                      {chain.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground/45 flex items-center gap-1">
                      <BarChart3 className="h-2.5 w-2.5" />
                      MCap {formatNumber(r.marketCap)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/45 flex items-center gap-1">
                      <Droplets className="h-2.5 w-2.5" />
                      Liq {formatNumber(r.liquidity)}
                    </span>
                    {r.volume24h > 0 && (
                      <span className="text-[10px] text-muted-foreground/35 hidden sm:flex items-center gap-1">
                        Vol {formatNumber(r.volume24h)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Change */}
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[12px] font-mono font-semibold text-foreground">
                    {formatPrice(r.priceUsd)}
                  </span>
                  {change !== null && (
                    <span
                      className="text-[10px] font-mono font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md"
                      style={{
                        color: isPositive ? "#34D399" : "#F87171",
                        background: isPositive ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                      }}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5" />
                      )}
                      {isPositive ? "+" : ""}{change.toFixed(1)}%
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
