import { toast } from "sonner";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

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
  if (amount < 0.001) return "<0.001";
  if (amount < 1) return amount.toFixed(3);
  if (amount < 100) return amount.toFixed(2);
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/* ── Accent palette per trade type ── */

const PALETTE = {
  buy: {
    accent: "0, 212, 255",      // Cyan
    label: "bought",
    badge: "BUY",
    emoji: null,
  },
  sell: {
    accent: "255, 77, 77",      // Crimson
    label: "sold",
    badge: "SELL",
    emoji: null,
  },
  launch: {
    accent: "167, 139, 250",    // Violet
    label: "launched",
    badge: "NEW",
    emoji: "🚀",
  },
} as const;

/* ── Image fallback builder ── */

function buildTokenSources(data: TradeToastData): string[] {
  const dexChain = data.chain === "bnb" ? "bsc" : "solana";
  const sources: string[] = [];

  if (data.tokenImageUrl) sources.push(data.tokenImageUrl);

  if (data.tokenMint) {
    sources.push(
      `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${data.tokenMint}.png`
    );
    if (dexChain === "bsc") {
      sources.push(`https://tokens.1inch.io/56/${data.tokenMint.toLowerCase()}.png`);
      sources.push(`https://tokens.pancakeswap.finance/images/${data.tokenMint.toLowerCase()}.png`);
    }
  }

  sources.push(
    `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(data.tokenMint || data.tokenTicker)}`
  );

  return sources;
}

/* ── Main export ── */

export function showTradeNotification(data: TradeToastData) {
  const type = data.tradeType;
  const p = PALETTE[type];
  const rgb = p.accent;
  const chainLabel = data.chain === "bnb" ? "BNB" : "SOL";
  const mcapStr = formatMcap(data.marketCapUsd);
  const duration = type === "launch" ? 6000 : 5000;
  const tokenSources = buildTokenSources(data);

  toast.custom(
    (id) => (
      <div
        className="saturn-trade-toast"
        data-type={type}
        onClick={() => toast.dismiss(id)}
        role="status"
        aria-label={`${data.traderName} ${p.label} $${data.tokenTicker} for ${formatSol(data.amountSol)} ${chainLabel}`}
      >
        {/* Accent side strip */}
        <div
          className="saturn-trade-toast__strip"
          style={{ background: `rgb(${rgb})` }}
        />

        {/* Token icon */}
        <div className="saturn-trade-toast__icon-wrap">
          <div
            className="saturn-trade-toast__icon"
            style={{ borderColor: `rgba(${rgb}, 0.35)` }}
          >
            <OptimizedTokenImage
              src={tokenSources[0] ?? null}
              fallbackSrc={tokenSources.slice(1)}
              fallbackText={data.tokenTicker}
              alt={data.tokenTicker}
              size={32}
              className="saturn-trade-toast__icon-img"
            />
          </div>
          {/* Live dot */}
          <span
            className="saturn-trade-toast__dot"
            style={{
              background: `rgb(${rgb})`,
              boxShadow: `0 0 6px rgba(${rgb}, 0.6)`,
            }}
          />
        </div>

        {/* Text content */}
        <div className="saturn-trade-toast__body">
          {/* Line 1 */}
          <div className="saturn-trade-toast__headline">
            <span className="saturn-trade-toast__trader">
              {data.traderName}
            </span>
            <span
              className="saturn-trade-toast__action"
              style={{ color: `rgb(${rgb})` }}
            >
              {p.label}
            </span>
            <span className="saturn-trade-toast__ticker">
              ${data.tokenTicker}
            </span>
          </div>

          {/* Line 2 */}
          <div className="saturn-trade-toast__meta">
            {type === "launch" ? (
              <span className="saturn-trade-toast__meta-text">
                {p.emoji} New token on {chainLabel}
              </span>
            ) : (
              <span className="saturn-trade-toast__amount">
                {formatSol(data.amountSol)} {chainLabel}
              </span>
            )}
            {mcapStr && (
              <>
                <span className="saturn-trade-toast__sep">·</span>
                <span
                  className="saturn-trade-toast__mcap"
                  style={{ color: `rgba(${rgb}, 0.7)` }}
                >
                  MC {mcapStr}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Badge */}
        <span
          className="saturn-trade-toast__badge"
          style={{
            color: `rgb(${rgb})`,
            background: `rgba(${rgb}, 0.1)`,
            borderColor: `rgba(${rgb}, 0.2)`,
          }}
        >
          {p.emoji ?? ""}{p.badge}
        </span>

        {/* Countdown progress bar */}
        <div className="saturn-trade-toast__bar-track">
          <div
            className="saturn-trade-toast__bar-fill"
            style={{
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
