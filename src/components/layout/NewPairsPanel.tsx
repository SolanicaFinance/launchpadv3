import { useState, useRef, useEffect, memo } from "react";
import { formatChange24h } from "@/lib/formatters";
import { useCodexNewPairs, type CodexPairToken, SOLANA_NETWORK_ID, BSC_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { RefreshCw, Rocket, ExternalLink, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
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

/* ── Mini sparkline for each token row ── */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const MiniSparkline = memo(function MiniSparkline({ seed, isUp }: { seed: string; isUp: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Generate deterministic curve from seed
    const hash = hashStr(seed);
    const pts = 20;
    const data: number[] = [];
    for (let i = 0; i < pts; i++) {
      const x = Math.sin(hash * 9301 + i * 49297 + 233280) * 49297;
      data.push(x - Math.floor(x));
    }
    // Ensure trend direction
    if (isUp) data[pts - 1] = Math.max(...data) * 0.95;
    else data[pts - 1] = Math.min(...data) * 1.05;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padY = 2;

    const coords = data.map((v, i) => ({
      x: (i / (pts - 1)) * w,
      y: padY + (h - padY * 2) - ((v - min) / range) * (h - padY * 2),
    }));

    // Draw smooth bezier
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 0; i < coords.length - 1; i++) {
      const xMid = (coords[i].x + coords[i + 1].x) / 2;
      const yMid = (coords[i].y + coords[i + 1].y) / 2;
      ctx.quadraticCurveTo(coords[i].x, coords[i].y, xMid, yMid);
    }
    ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);

    // Gradient stroke
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    if (isUp) {
      grad.addColorStop(0, "rgba(0, 212, 255, 0.3)");
      grad.addColorStop(1, "rgba(0, 255, 170, 0.8)");
    } else {
      grad.addColorStop(0, "rgba(255, 80, 80, 0.3)");
      grad.addColorStop(1, "rgba(255, 80, 80, 0.8)");
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Area fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isUp) {
      fillGrad.addColorStop(0, "rgba(0, 255, 170, 0.12)");
      fillGrad.addColorStop(1, "rgba(0, 255, 170, 0.0)");
    } else {
      fillGrad.addColorStop(0, "rgba(255, 80, 80, 0.08)");
      fillGrad.addColorStop(1, "rgba(255, 80, 80, 0.0)");
    }
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }, [seed, isUp]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
});

/* ── Token Icon with fallback chain ── */
function TokenIcon({ pair, chain }: { pair: CodexPairToken; chain: PanelChain }) {
  const [stage, setStage] = useState(0);
  const isBnb = chain === "bnb";
  const dexChain = isBnb ? "bsc" : "solana";
  const dexUrl = pair.address
    ? `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${pair.address}.png`
    : null;

  const srcs: string[] = [];
  if (isBnb) {
    if (pair.imageUrl && !pair.imageUrl.includes("dicebear.com")) srcs.push(pair.imageUrl);
    if (pair.fallbackImageUrl && !srcs.includes(pair.fallbackImageUrl)) srcs.push(pair.fallbackImageUrl);
    if (dexUrl && !srcs.includes(dexUrl)) srcs.push(dexUrl);
  } else {
    if (dexUrl) srcs.push(dexUrl);
    if (pair.imageUrl && pair.imageUrl !== dexUrl) srcs.push(pair.imageUrl);
  }

  if (stage >= srcs.length) {
    const hash = hashStr(pair.symbol || "?");
    const hue = hash % 360;
    return (
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, hsl(${hue} 60% 25%), hsl(${(hue + 40) % 360} 50% 35%))`,
        border: "1.5px solid rgba(255,255,255,0.1)",
        fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)",
        fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em",
      }}>
        {pair.symbol?.slice(0, 2) || "?"}
      </div>
    );
  }

  return (
    <img
      src={srcs[stage]}
      alt={pair.symbol}
      style={{
        width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
        border: "1.5px solid rgba(255,255,255,0.08)",
      }}
      loading="eager"
      decoding="sync"
      onError={() => setStage(s => s + 1)}
    />
  );
}

/* ── Token Row Card ── */
function TokenRowCard({ pair, chain, onClick }: {
  pair: CodexPairToken;
  chain: PanelChain;
  onClick: (e: React.MouseEvent) => void;
}) {
  const isUp = pair.change24h >= 0;
  const changeColor = isUp ? "#00FF9D" : "#FF5050";
  const age = timeAgo(pair.createdAt);

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        padding: "10px 12px 8px",
        margin: "0 0 1px",
        border: "none",
        background: "rgba(255,255,255,0.02)",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s ease",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.transform = "scale(1.005)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* Sparkline background */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
        opacity: 0.5, pointerEvents: "none",
      }}>
        <MiniSparkline seed={pair.address || pair.symbol} isUp={isUp} />
      </div>

      {/* Top row: Icon + Name + Change */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative", zIndex: 1 }}>
        <TokenIcon pair={pair} chain={chain} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + ticker */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              fontFamily: "'Inter', system-ui, sans-serif",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: "120px",
            }}>
              {pair.name || pair.symbol}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              ${pair.symbol}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 500,
              color: "rgba(255,255,255,0.3)",
              marginLeft: "auto", flexShrink: 0,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {age}
            </span>
          </div>

          {/* Metrics row */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginTop: 4,
          }}>
            {/* MCap - gold */}
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{
                fontSize: 9, fontWeight: 500,
                color: "rgba(255,255,255,0.35)",
                fontFamily: "'Inter', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>MC</span>
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: "#FFD700",
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {formatMcap(pair.marketCap)}
              </span>
            </div>

            {/* Volume */}
            {pair.volume24h > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{
                  fontSize: 9, fontWeight: 500,
                  color: "rgba(255,255,255,0.35)",
                  fontFamily: "'Inter', sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}>V</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {formatMcap(pair.volume24h)}
                </span>
              </div>
            )}

            {/* Change pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: "2px",
              padding: "1px 6px",
              borderRadius: 6,
              background: isUp ? "rgba(0, 255, 157, 0.1)" : "rgba(255, 80, 80, 0.1)",
              border: `1px solid ${isUp ? "rgba(0, 255, 157, 0.15)" : "rgba(255, 80, 80, 0.15)"}`,
              marginLeft: "auto",
            }}>
              {isUp
                ? <TrendingUp style={{ width: 9, height: 9, color: changeColor }} />
                : <TrendingDown style={{ width: 9, height: 9, color: changeColor }} />
              }
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: changeColor,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {formatChange24h(pair.change24h)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
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
    if (pair.address) navigate(`/launchpad/${pair.address}`);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: compact ? "320px" : "400px",
        maxWidth: compact ? "calc(100vw - 16px)" : "440px",
        maxHeight: compact ? "55vh" : "520px",
        background: "linear-gradient(180deg, #141418 0%, #0E0E12 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        boxShadow: "0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(200,255,0,0.1)",
            border: "1px solid rgba(200,255,0,0.15)",
          }}>
            <Rocket style={{ width: 14, height: 14, color: "#c8ff00" }} />
          </div>
          <div>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              fontFamily: "'Inter', system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}>
              New Pairs
            </span>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: "#c8ff00",
            background: "rgba(200,255,0,0.12)",
            padding: "2px 7px",
            borderRadius: 6,
            border: "1px solid rgba(200,255,0,0.15)",
            letterSpacing: "0.06em",
            animation: "pulse 2s ease-in-out infinite",
          }}>
            LIVE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedChain("solana"); setVisibleCount(PAGE_SIZE); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
              background: selectedChain === "solana" ? "rgba(200,255,0,0.12)" : "transparent",
              boxShadow: selectedChain === "solana" ? "inset 0 0 0 1px rgba(200,255,0,0.2)" : "none",
              transition: "all 0.15s",
            }}
            title="Solana pairs"
          >
            <img src={solanaLogo} alt="SOL" style={{ width: 18, height: 18, borderRadius: "50%" }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedChain("bnb"); setVisibleCount(PAGE_SIZE); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
              background: selectedChain === "bnb" ? "rgba(243,186,47,0.12)" : "transparent",
              boxShadow: selectedChain === "bnb" ? "inset 0 0 0 1px rgba(243,186,47,0.2)" : "none",
              transition: "all 0.15s",
            }}
            title="BNB pairs"
          >
            <BnbIcon size={18} />
          </button>
          {onRefresh && (
            <button onClick={onRefresh} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, display: "flex",
              color: "rgba(255,255,255,0.25)",
              transition: "color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
            >
              <RefreshCw style={{
                width: 13, height: 13,
                transition: "transform 0.6s",
                transform: refreshing ? "rotate(360deg)" : "none",
              }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.06) transparent",
      }}>
        {isLoading && pairs.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
            Loading new pairs…
          </div>
        ) : pairs.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
            No new pairs found
          </div>
        ) : (
          <>
            {pairs.map((pair, idx) => (
              <TokenRowCard
                key={pair.address || idx}
                pair={pair}
                chain={selectedChain}
                onClick={(e) => handleClick(pair, e)}
              />
            ))}
            {hasMore && (
              <button
                onClick={(e) => { e.stopPropagation(); setVisibleCount(c => c + PAGE_SIZE); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, width: "100%", padding: "10px",
                  border: "none",
                  background: "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  fontSize: 11, fontWeight: 600,
                  color: "rgba(255,255,255,0.35)",
                  fontFamily: "'Inter', sans-serif",
                  transition: "all 0.15s",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                }}
              >
                Load more
                <ChevronDown style={{ width: 12, height: 12 }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/trade"); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, width: "100%", padding: "10px",
          border: "none",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(200,255,0,0.06) 0%, rgba(200,255,0,0.02) 100%)",
          cursor: "pointer",
          fontSize: 11, fontWeight: 700,
          color: "#c8ff00",
          fontFamily: "'Inter', sans-serif",
          letterSpacing: "0.02em",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,255,0,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(180deg, rgba(200,255,0,0.06) 0%, rgba(200,255,0,0.02) 100%)"; }}
      >
        Open Pulse Terminal
        <ExternalLink style={{ width: 11, height: 11 }} />
      </button>
    </div>
  );
}
