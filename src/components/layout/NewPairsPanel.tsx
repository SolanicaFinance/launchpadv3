import { useState } from "react";
import { formatChange24h } from "@/lib/formatters";
import { useCodexNewPairs, type CodexPairToken, SOLANA_NETWORK_ID, BSC_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { RefreshCw, Rocket, ExternalLink, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import solanaLogo from "@/assets/solana-logo.png";

type PanelChain = "solana" | "bnb";

interface NewPairsPanelProps {
  onRefresh?: (e: React.MouseEvent) => void;
  refreshing?: boolean;
  compact?: boolean;
}

function formatMcap(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(raw: string | number | null): string {
  if (!raw) return "—";
  try {
    const ms = typeof raw === "number"
      ? (raw < 1e12 ? raw * 1000 : raw)
      : (() => {
          const n = Number(raw);
          if (!isNaN(n)) return n < 1e12 ? n * 1000 : n;
          return new Date(raw).getTime();
        })();
    if (isNaN(ms)) return "—";
    const diff = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  } catch {
    return "—";
  }
}

const PAGE_SIZE = 10;

function BnbIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path d="M16 6L19.09 9.09L12.36 15.82L9.27 12.73L16 6Z" fill="white" />
      <path d="M22.73 12.73L25.82 15.82L19.09 22.55L16 19.45L22.73 12.73Z" fill="white" />
      <path d="M9.27 12.73L12.36 15.82L9.27 18.91L6.18 15.82L9.27 12.73Z" fill="white" />
      <path d="M16 19.45L19.09 22.55L16 25.64L12.91 22.55L16 19.45Z" fill="white" />
      <path d="M22.73 18.91L25.82 15.82L22.73 12.73L19.64 15.82L22.73 18.91Z" fill="white" />
      <path d="M16 12.73L19.09 15.82L16 18.91L12.91 15.82L16 12.73Z" fill="white" />
    </svg>
  );
}

const IMG_STYLE: React.CSSProperties = {
  width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover", flexShrink: 0,
};

function toChecksumHex(addr: string): string {
  // Simple pass-through — Trust Wallet CDN accepts lowercase too
  return addr.toLowerCase();
}

function TokenIcon({ pair, chain }: { pair: CodexPairToken; chain: PanelChain }) {
  const [stage, setStage] = useState(0);

  // DexScreener is the most reliable single source for token images
  const dexChain = chain === "bnb" ? "bsc" : "solana";
  const dexUrl = pair.address
    ? `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${pair.address}.png`
    : null;

  const srcs: string[] = [];
  // 1. DexScreener first — most reliable for new tokens
  if (dexUrl) srcs.push(dexUrl);
  // 2. Codex image as backup
  if (pair.imageUrl && pair.imageUrl !== dexUrl) srcs.push(pair.imageUrl);

  if (stage >= srcs.length) {
    return (
      <div style={{
        ...IMG_STYLE,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.08)", fontSize: "8px", fontWeight: 700,
        color: "rgba(255,255,255,0.5)", fontFamily: "'IBM Plex Mono', monospace",
      }}>
        {pair.symbol?.slice(0, 2) || "?"}
      </div>
    );
  }

  return (
    <img
      src={srcs[stage]}
      alt={pair.symbol}
      style={IMG_STYLE}
      loading="eager"
      decoding="sync"
      onError={() => setStage((s) => s + 1)}
    />
  );
}


export function NewPairsPanel({ onRefresh, refreshing, compact }: NewPairsPanelProps) {
  const [selectedChain, setSelectedChain] = useState<PanelChain>("solana");
  const networkId = selectedChain === "bnb" ? BSC_NETWORK_ID : SOLANA_NETWORK_ID;
  const { newPairs, isLoading } = useCodexNewPairs(networkId);
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const pairs = newPairs.slice(0, visibleCount);
  const hasMore = newPairs.length > visibleCount;

  const handleClick = (pair: CodexPairToken, e: React.MouseEvent) => {
    e.stopPropagation();
    const mint = pair.address;
    if (mint) {
      navigate(`/launchpad/${mint}`);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: compact ? "300px" : "380px",
        maxWidth: compact ? "calc(100vw - 16px)" : "420px",
        maxHeight: compact ? "50vh" : "460px",
        background: "#141416",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Rocket style={{ width: "14px", height: "14px", color: "#c8ff00" }} />
          <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.95)", fontFamily: "'IBM Plex Mono', monospace" }}>
            New Pairs
          </span>
          <span style={{
            fontSize: "9px",
            fontWeight: 600,
            color: "#c8ff00",
            background: "rgba(200,255,0,0.1)",
            padding: "1px 5px",
            borderRadius: "4px",
          }}>
            LIVE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {/* Chain toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedChain("solana"); setVisibleCount(PAGE_SIZE); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "24px", height: "24px", borderRadius: "6px", border: "none", cursor: "pointer",
              background: selectedChain === "solana" ? "rgba(200,255,0,0.15)" : "transparent",
              boxShadow: selectedChain === "solana" ? "inset 0 0 0 1px rgba(200,255,0,0.3)" : "none",
              transition: "all 0.15s",
            }}
            title="Solana pairs"
          >
            <img src={solanaLogo} alt="SOL" style={{ width: "16px", height: "16px", borderRadius: "50%" }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedChain("bnb"); setVisibleCount(PAGE_SIZE); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "24px", height: "24px", borderRadius: "6px", border: "none", cursor: "pointer",
              background: selectedChain === "bnb" ? "rgba(243,186,47,0.15)" : "transparent",
              boxShadow: selectedChain === "bnb" ? "inset 0 0 0 1px rgba(243,186,47,0.3)" : "none",
              transition: "all 0.15s",
            }}
            title="BNB pairs"
          >
            <BnbIcon size={16} />
          </button>
          {onRefresh && (
            <button onClick={onRefresh} style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              color: "rgba(255,255,255,0.3)",
            }}>
              <RefreshCw style={{
                width: "12px",
                height: "12px",
                transition: "transform 0.6s",
                transform: refreshing ? "rotate(360deg)" : "none",
              }} />
            </button>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 70px 50px",
        padding: "4px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Token</span>
        <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>MCap</span>
        <span style={{ fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Age</span>
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.08) transparent",
      }}>
        {isLoading && pairs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
            Loading new pairs…
          </div>
        ) : pairs.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
            No new pairs found
          </div>
        ) : (
          <>
            {pairs.map((pair, idx) => {
              const changeColor = pair.change24h >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
              return (
                <button
                  key={pair.address || idx}
                  onClick={(e) => handleClick(pair, e)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 70px 50px",
                    width: "100%",
                    padding: "6px 12px",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.1s",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.04)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Token info */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <TokenIcon pair={pair} chain={selectedChain} />
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.9)",
                        fontFamily: "'IBM Plex Mono', monospace",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        ${pair.symbol}
                      </div>
                      <div style={{
                        fontSize: "9px",
                        color: changeColor,
                        fontWeight: 500,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {formatChange24h(pair.change24h)}
                      </div>
                    </div>
                  </div>

                  {/* Market cap */}
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    textAlign: "right",
                  }}>
                    {formatMcap(pair.marketCap)}
                  </span>

                  {/* Age */}
                  <span style={{
                    fontSize: "9px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    textAlign: "right",
                  }}>
                    {timeAgo(pair.createdAt)}
                  </span>
                </button>
              );
            })}
            {hasMore && (
              <button
                onClick={(e) => { e.stopPropagation(); setVisibleCount((c) => c + PAGE_SIZE); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  width: "100%",
                  padding: "6px",
                  border: "none",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                Load more
                <ChevronDown style={{ width: "10px", height: "10px" }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer link */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/trade"); }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          width: "100%",
          padding: "7px",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(200,255,0,0.04)",
          cursor: "pointer",
          fontSize: "10px",
          fontWeight: 600,
          color: "#c8ff00",
          fontFamily: "'IBM Plex Mono', monospace",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.04)"; }}
      >
        Open Pulse Terminal
        <ExternalLink style={{ width: "10px", height: "10px" }} />
      </button>
    </div>
  );
}