import { toast } from "sonner";

const DEFAULT_AVATAR = "/saturn-logo.png";

interface TradeToastData {
  traderName: string;
  traderAvatar: string | null;
  tokenTicker: string;
  tokenMint: string;
  tradeType: "buy" | "sell";
  amountSol: number;
  marketCapUsd: number | null;
  chain: string;
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

function getTokenImageFallbacks(mint: string, chain: string): string[] {
  const dexChain = chain === "bnb" ? "bsc" : "solana";
  return [
    `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${mint}.png`,
    `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(mint)}`,
  ];
}

export function showTradeNotification(data: TradeToastData) {
  const isBuy = data.tradeType === "buy";
  const chainLabel = data.chain === "bnb" ? "BNB" : "SOL";
  const mcapStr = formatMcap(data.marketCapUsd);
  const tokenFallbacks = getTokenImageFallbacks(data.tokenMint, data.chain);
  const avatarImg = data.traderAvatar || DEFAULT_AVATAR;

  toast.custom(
    () => (
      <div
        className={`
          flex items-center gap-3 w-full max-w-[380px] px-4 py-3 rounded-xl border backdrop-blur-xl
          shadow-[0_8px_32px_rgba(0,0,0,0.5)]
          ${isBuy 
            ? "bg-emerald-950/80 border-emerald-500/25" 
            : "bg-red-950/80 border-red-500/25"
          }
        `}
      >
        {/* Token icon with cascading fallback */}
        <div className="relative flex-shrink-0">
          <TokenImg
            src={tokenFallbacks[0]}
            fallbacks={tokenFallbacks.slice(1)}
            alt={data.tokenTicker}
            className="w-10 h-10 rounded-full object-cover bg-white/5"
          />
          {/* Buy/Sell indicator dot */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black/60 ${
              isBuy ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
        </div>

        {/* Trade info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* User avatar */}
            <img
              src={avatarImg}
              alt={data.traderName}
              className="w-4 h-4 rounded-full object-cover flex-shrink-0 bg-white/10"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
              }}
            />
            <span className="text-[13px] font-semibold text-white/90 truncate">
              {data.traderName}
            </span>
            <span className={`text-[12px] font-medium flex-shrink-0 ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
              {isBuy ? "bought" : "sold"}
            </span>
            <span className="text-[13px] font-bold text-white truncate">
              ${data.tokenTicker}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-white/50 font-medium">
              {formatSol(data.amountSol)} {chainLabel}
            </span>
            {mcapStr && (
              <>
                <span className="text-white/20 text-[10px]">•</span>
                <span className={`text-[11px] font-medium ${isBuy ? "text-emerald-400/70" : "text-red-400/70"}`}>
                  MC {mcapStr}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Trade type badge */}
        <div
          className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            isBuy
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          {isBuy ? "BUY" : "SELL"}
        </div>
      </div>
    ),
    {
      duration: 5000,
      position: "bottom-right",
      unstyled: true,
      className: "trade-notification-toast",
    }
  );
}

/** Image with cascading onError fallbacks */
function TokenImg({ src, fallbacks, alt, className }: { src: string; fallbacks: string[]; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        const nextFallback = fallbacks.shift();
        if (nextFallback) {
          img.src = nextFallback;
        }
      }}
    />
  );
}
