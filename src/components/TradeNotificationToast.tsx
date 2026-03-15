import { toast } from "sonner";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

const DEFAULT_AVATAR = "/saturn-logo.png";

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

function formatMcap(usd: number | null): string {
  if (!usd || usd <= 0) return "";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatSol(amount: number): string {
  if (amount < 0.001) return "<0.001";
  if (amount < 1) return amount.toFixed(3);
  if (amount < 100) return amount.toFixed(2);
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

const ACCENT = {
  buy:    { text: "#00D4FF", bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.15)", glow: "rgba(0,212,255,0.12)", dot: "#00D4FF", bar: "#00D4FF" },
  sell:   { text: "#FF4D4D", bg: "rgba(255,77,77,0.08)",  border: "rgba(255,77,77,0.15)",  glow: "rgba(255,77,77,0.12)",  dot: "#FF4D4D", bar: "#FF4D4D" },
  launch: { text: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.15)", glow: "rgba(167,139,250,0.12)", dot: "#A78BFA", bar: "#A78BFA" },
} as const;

export function showTradeNotification(data: TradeToastData) {
  const type = data.tradeType;
  const accent = ACCENT[type];
  const chainLabel = data.chain === "bnb" ? "BNB" : "SOL";
  const mcapStr = formatMcap(data.marketCapUsd);
  const duration = type === "launch" ? 6000 : 5000;

  // Build robust token image fallback chain
  const dexChain = data.chain === "bnb" ? "bsc" : "solana";
  const tokenSources: string[] = [];
  if (data.tokenImageUrl) tokenSources.push(data.tokenImageUrl);
  if (data.tokenMint) {
    tokenSources.push(`https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${data.tokenMint}.png`);
    if (dexChain === "bsc") {
      tokenSources.push(`https://tokens.1inch.io/56/${data.tokenMint.toLowerCase()}.png`);
      tokenSources.push(`https://tokens.pancakeswap.finance/images/${data.tokenMint.toLowerCase()}.png`);
    }
  }
  tokenSources.push(`https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(data.tokenMint || data.tokenTicker)}`);

  const actionLabel = type === "launch" ? "launched" : type === "buy" ? "bought" : "sold";
  const badgeLabel = type === "launch" ? "🚀 NEW" : type === "buy" ? "BUY" : "SELL";

  toast.custom(
    (id) => (
      <div
        className="trade-notif-card"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          maxWidth: "370px",
          padding: "12px 14px",
          borderRadius: "14px",
          background: "rgba(17,17,22,0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${accent.border}`,
          boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`,
          overflow: "hidden",
          cursor: "pointer",
          fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        }}
        onClick={() => toast.dismiss(id)}
      >
        {/* Token icon */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              overflow: "hidden",
              border: `1.5px solid ${accent.border}`,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <OptimizedTokenImage
              src={tokenSources[0] ?? null}
              fallbackSrc={tokenSources.slice(1)}
              fallbackText={data.tokenTicker}
              alt={data.tokenTicker}
              size={34}
              className="rounded-full"
              style={{ width: 34, height: 34, objectFit: "cover", display: "block", borderRadius: "50%" }}
            />
          </div>
          {/* Status dot */}
          <div
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: accent.dot,
              border: "2px solid rgba(17,17,22,0.9)",
              boxShadow: `0 0 6px ${accent.glow}`,
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
          {/* Line 1: wallet + action + ticker */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "nowrap" }}>
            {/* Tiny avatar */}
            <img
              src={data.traderAvatar || DEFAULT_AVATAR}
              alt=""
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                opacity: 0.8,
              }}
              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {data.traderName}
            </span>
            <span
              style={{
                fontSize: "12.5px",
                fontWeight: 500,
                color: accent.text,
                flexShrink: 0,
                opacity: 0.9,
              }}
            >
              {actionLabel}
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ${data.tokenTicker}
            </span>
          </div>

          {/* Line 2: amount + mcap */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {type === "launch" ? (
              <span style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                New token on {chainLabel}
              </span>
            ) : (
              <span
                style={{
                  fontSize: "11.5px",
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 500,
                  fontFamily: "'Geist Mono', 'SF Mono', monospace",
                  letterSpacing: "-0.02em",
                }}
              >
                {formatSol(data.amountSol)} {chainLabel}
              </span>
            )}
            {mcapStr && (
              <>
                <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "9px" }}>•</span>
                <span
                  style={{
                    fontSize: "11px",
                    color: accent.text,
                    opacity: 0.6,
                    fontWeight: 500,
                  }}
                >
                  MC {mcapStr}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Minimal badge */}
        <div
          style={{
            flexShrink: 0,
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "9.5px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: accent.text,
            background: accent.bg,
            border: `1px solid ${accent.border}`,
          }}
        >
          {badgeLabel}
        </div>

        {/* Progress bar — animates from full width to 0 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            background: "rgba(255,255,255,0.03)",
            overflow: "hidden",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <div
            className="trade-notif-progress"
            style={{
              height: "100%",
              background: `linear-gradient(90deg, transparent, ${accent.bar})`,
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
      className: "trade-notification-toast",
    }
  );
}
