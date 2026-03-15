import { toast } from "sonner";

interface TradeToastData {
  traderName: string;
  traderAvatar: string | null;
  tokenTicker: string;
  tokenMint: string;
  tradeType: "buy" | "sell" | "launch";
  amountSol: number;
  marketCapUsd: number | null;
  chain: string;
  tokenImageUrl?: string | null;
}

/* ── Formatters ── */

function formatMcap(usd: number | null): string {
  if (!usd || usd <= 0) return "";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatSol(amount: number): string {
  if (amount <= 0) return "0";
  if (amount < 0.001) return "<0.001";
  if (amount < 1) return amount.toFixed(3);
  if (amount < 100) return amount.toFixed(2);
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/* ── Accent palette per trade type ── */

const PALETTE = {
  buy:    { rgb: "0, 212, 255",   label: "bought",   grad: "from-cyan-500 to-blue-600" },
  sell:   { rgb: "255, 77, 77",   label: "sold",     grad: "from-red-500 to-rose-600" },
  launch: { rgb: "167, 139, 250", label: "launched",  grad: "from-violet-500 to-purple-600" },
} as const;

/* ── Image sources builder ── */

function buildImageSources(data: TradeToastData): string[] {
  const dexChain = data.chain === "bnb" ? "bsc" : "solana";
  const sources: string[] = [];
  if (data.tokenImageUrl) sources.push(data.tokenImageUrl);
  if (data.tokenMint) {
    sources.push(`https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${data.tokenMint}.png`);
  }
  return sources;
}

/* ── Inline token icon with built-in fallback ── */

function TokenIcon({ sources, ticker, accentRgb, gradClass }: {
  sources: string[];
  ticker: string;
  accentRgb: string;
  gradClass: string;
}) {
  // Use a simple img with onerror chain — no external component needed
  const firstLetter = (ticker || "?").replace(/^\$/, "").charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      <div
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center"
        style={{
          border: `1.5px solid rgba(${accentRgb}, 0.3)`,
          background: `linear-gradient(135deg, rgba(${accentRgb}, 0.15), rgba(${accentRgb}, 0.05))`,
        }}
      >
        {sources.length > 0 ? (
          <img
            src={sources[0]}
            alt={ticker}
            className="w-full h-full object-cover rounded-full"
            onError={(e) => {
              const img = e.currentTarget;
              const next = sources.indexOf(img.src) + 1;
              if (next < sources.length) {
                img.src = sources[next];
              } else {
                // Replace with gradient letter
                img.style.display = "none";
                const parent = img.parentElement;
                if (parent && !parent.querySelector("span")) {
                  const span = document.createElement("span");
                  span.textContent = firstLetter;
                  span.style.cssText = "font-size:13px;font-weight:700;color:rgba(255,255,255,0.7)";
                  parent.appendChild(span);
                }
              }
            }}
          />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
            {firstLetter}
          </span>
        )}
      </div>
      {/* Live pulse dot */}
      <span
        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
        style={{
          background: `rgb(${accentRgb})`,
          boxShadow: `0 0 6px rgba(${accentRgb}, 0.6)`,
          border: "1.5px solid rgba(14, 14, 20, 0.95)",
        }}
      />
    </div>
  );
}

/* ── Close button ── */

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
      aria-label="Dismiss"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 1l6 6M7 1L1 7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

/* ── Main export ── */

export function showTradeNotification(data: TradeToastData) {
  const type = data.tradeType;
  const p = PALETTE[type];
  const rgb = p.rgb;
  const chainLabel = data.chain === "bnb" ? "BNB" : "SOL";
  const mcapStr = formatMcap(data.marketCapUsd);
  const duration = type === "launch" ? 6000 : 5000;
  const imageSources = buildImageSources(data);

  toast.custom(
    (id) => (
      <div
        className="group saturn-toast-card"
        onClick={() => toast.dismiss(id)}
        role="status"
        aria-label={`${data.traderName} ${p.label} $${data.tokenTicker} for ${formatSol(data.amountSol)} ${chainLabel}`}
        style={{
          // Glassmorphism
          background: "rgba(14, 14, 20, 0.88)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
          borderRadius: 14,
          padding: "10px 14px 12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          maxWidth: 360,
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Left accent strip */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "15%",
            bottom: "15%",
            width: 2.5,
            borderRadius: "0 2px 2px 0",
            background: `rgb(${rgb})`,
            opacity: 0.65,
          }}
        />

        {/* Token icon */}
        <TokenIcon
          sources={imageSources}
          ticker={data.tokenTicker}
          accentRgb={rgb}
          gradClass={p.grad}
        />

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Line 1: trader action ticker */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
              {data.traderName}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: `rgb(${rgb})`, flexShrink: 0, opacity: 0.9 }}>
              {p.label}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.95)", overflow: "hidden", textOverflow: "ellipsis" }}>
              ${data.tokenTicker}
            </span>
          </div>

          {/* Line 2: amount + mcap */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {type === "launch" ? (
              <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>
                🚀 New token on {chainLabel}
              </span>
            ) : (
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
                letterSpacing: "-0.02em",
              }}>
                {formatSol(data.amountSol)} {chainLabel}
              </span>
            )}
            {mcapStr && (
              <>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.15)" }}>·</span>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: `rgba(${rgb}, 0.65)`,
                  fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
                }}>
                  MC {mcapStr}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Close button */}
        <CloseBtn onClose={() => toast.dismiss(id)} />

        {/* Bottom progress bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(255,255,255,0.03)",
            overflow: "hidden",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <div
            className="saturn-bar-fill"
            style={{
              height: "100%",
              background: `linear-gradient(90deg, transparent 0%, rgb(${rgb}) 100%)`,
              animationDuration: `${duration}ms`,
            }}
          />
        </div>
      </div>
    ),
    {
      duration,
      position: "bottom-right",
      unstyled: true,
      className: "saturn-trade-notification",
    }
  );
}
