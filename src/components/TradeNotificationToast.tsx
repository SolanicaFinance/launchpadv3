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

function getTokenImageFallbacks(mint: string, chain: string): string[] {
  const dexChain = chain === "bnb" ? "bsc" : "solana";
  return [
    `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${mint}.png`,
    `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(mint)}`,
  ];
}

export function showTradeNotification(data: TradeToastData) {
  const isBuy = data.tradeType === "buy";
  const isLaunch = data.tradeType === "launch";
  const chainLabel = data.chain === "bnb" ? "BNB" : "SOL";
  const mcapStr = formatMcap(data.marketCapUsd);

  // Build token image sources array
  const dexChain = data.chain === "bnb" ? "bsc" : "solana";
  const tokenSources: string[] = [];
  if (data.tokenImageUrl) tokenSources.push(data.tokenImageUrl);
  if (data.tokenMint) {
    tokenSources.push(`https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${data.tokenMint}.png`);
  }
  tokenSources.push(`https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(data.tokenMint || data.tokenTicker)}`);

  const avatarImg = data.traderAvatar || DEFAULT_AVATAR;

  const bgClass = isLaunch
    ? "bg-violet-950/80 border-violet-500/25"
    : isBuy
      ? "bg-emerald-950/80 border-emerald-500/25"
      : "bg-red-950/80 border-red-500/25";

  const accentColor = isLaunch
    ? "text-violet-400"
    : isBuy
      ? "text-emerald-400"
      : "text-red-400";

  const dotColor = isLaunch
    ? "bg-violet-400"
    : isBuy
      ? "bg-emerald-400"
      : "bg-red-400";

  const badgeBg = isLaunch
    ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
    : isBuy
      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
      : "bg-red-500/15 text-red-400 border border-red-500/20";

  const mcapAccent = isLaunch
    ? "text-violet-400/70"
    : isBuy
      ? "text-emerald-400/70"
      : "text-red-400/70";

  const actionLabel = isLaunch ? "launched" : isBuy ? "bought" : "sold";
  const badgeLabel = isLaunch ? "🚀 NEW" : isBuy ? "BUY" : "SELL";

  toast.custom(
    () => (
      <div
        className={`
          flex items-center gap-3 w-full max-w-[380px] px-4 py-3 rounded-xl border backdrop-blur-xl
          shadow-[0_8px_32px_rgba(0,0,0,0.5)]
          ${bgClass}
        `}
      >
        {/* Token icon with cascading fallback */}
        <div className="relative flex-shrink-0">
          <OptimizedTokenImage
            src={tokenSources[0]}
            fallbackSrc={tokenSources.slice(1)}
            fallbackText={data.tokenTicker}
            alt={data.tokenTicker}
            size={40}
            className="w-10 h-10 rounded-full object-cover bg-white/5"
          />
          {/* Indicator dot */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black/60 ${dotColor}`}
          />
        </div>

        {/* Trade info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* User avatar */}
            <AvatarImg
              src={avatarImg}
              alt={data.traderName}
              className="w-4 h-4 rounded-full object-cover flex-shrink-0 bg-white/10"
            />
            <span className="text-[13px] font-semibold text-white/90 truncate">
              {data.traderName}
            </span>
            <span className={`text-[12px] font-medium flex-shrink-0 ${accentColor}`}>
              {actionLabel}
            </span>
            <span className="text-[13px] font-bold text-white truncate">
              ${data.tokenTicker}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {!isLaunch && (
              <span className="text-[12px] text-white/50 font-medium">
                {formatSol(data.amountSol)} {chainLabel}
              </span>
            )}
            {isLaunch && (
              <span className="text-[12px] text-white/50 font-medium">
                New token on {chainLabel}
              </span>
            )}
            {mcapStr && (
              <>
                <span className="text-white/20 text-[10px]">•</span>
                <span className={`text-[11px] font-medium ${mcapAccent}`}>
                  MC {mcapStr}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Badge */}
        <div
          className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${badgeBg}`}
        >
          {badgeLabel}
        </div>
      </div>
    ),
    {
      duration: isLaunch ? 6000 : 5000,
      position: "bottom-right",
      unstyled: true,
      className: "trade-notification-toast",
    }
  );
}


/** Avatar with fallback to default */
function AvatarImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
      }}
    />
  );
}
