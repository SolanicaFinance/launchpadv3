import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDiscoverTokens, TrendingToken } from "@/hooks/useDiscoverTokens";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { TrendingUp, RefreshCw, Zap, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { PulseQuickBuyButton } from "@/components/launchpad/PulseQuickBuyButton";
import type { CodexPairToken } from "@/hooks/useCodexNewPairs";

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function PriceChange({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={cn("font-mono text-sm font-semibold", positive ? "text-green-400" : "text-red-400")}>
      {positive ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function trendingToCodex(t: TrendingToken): CodexPairToken {
  return {
    address: t.address,
    name: t.name,
    symbol: t.symbol,
    imageUrl: t.imageUrl ?? null,
    marketCap: t.marketCap ?? 0,
    volume24h: t.volume24h ?? 0,
    change24h: t.priceChange6h ?? 0,
    holders: 0,
    liquidity: t.liquidity ?? 0,
    graduationPercent: 100,
    poolAddress: t.pairAddress ?? null,
    launchpadName: "",
    completed: true,
    migrated: true,
    completedAt: null,
    migratedAt: null,
    createdAt: null,
    websiteUrl: t.socialLinks?.find(s => s.type === "website")?.url ?? null,
    twitterUrl: t.socialLinks?.find(s => s.type === "twitter")?.url ?? null,
    telegramUrl: t.socialLinks?.find(s => s.type === "telegram")?.url ?? null,
    discordUrl: t.socialLinks?.find(s => s.type === "discord")?.url ?? null,
    launchpadIconUrl: null,
  };
}

const WALLET_PRESETS = ["P1", "P2", "P3"] as const;
const PRESET_DEFAULTS: Record<string, number> = { P1: 0.5, P2: 1.0, P3: 2.0 };

function getPresetAmount(preset: string): number {
  try {
    const v = localStorage.getItem(`pulse-qb-${preset}`);
    if (v) { const n = parseFloat(v); if (n > 0 && isFinite(n)) return n; }
  } catch {}
  return PRESET_DEFAULTS[preset] ?? 0.5;
}
function savePresetAmount(preset: string, amount: number) {
  try { localStorage.setItem(`pulse-qb-${preset}`, String(amount)); } catch {}
}
function getActivePreset(): string {
  try { return localStorage.getItem("pulse-active-preset") || "P1"; } catch { return "P1"; }
}
function saveActivePreset(preset: string) {
  try { localStorage.setItem("pulse-active-preset", preset); } catch {}
}

function TokenRow({ token, quickBuyAmount }: { token: TrendingToken; quickBuyAmount: number }) {
  const navigate = useNavigate();
  const codexToken = trendingToCodex(token);

  return (
    <tr
      onClick={() => navigate(`/trade/${token.address}`)}
      className="border-b border-border/30 hover:bg-surface-hover/50 cursor-pointer transition-colors group"
    >
      <td className="py-3 px-3 text-center">
        <span className="font-mono text-sm text-muted-foreground font-bold">#{token.rank}</span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <OptimizedTokenImage
            src={token.imageUrl}
            fallbackText={token.symbol}
            size={32}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {token.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">${token.symbol}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 text-right hidden sm:table-cell">
        <span className="font-mono text-sm text-foreground">{formatNumber(token.marketCap)}</span>
      </td>
      <td className="py-3 px-3 text-right hidden md:table-cell">
        <span className="font-mono text-sm text-foreground">{formatNumber(token.liquidity)}</span>
      </td>
      <td className="py-3 px-3 text-right hidden lg:table-cell">
        <span className="font-mono text-sm text-foreground">{formatNumber(token.volume24h)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <PriceChange value={token.priceChange6h} />
      </td>
      <td className="py-2 px-2 text-right" onClick={e => e.stopPropagation()}>
        <PulseQuickBuyButton codexToken={codexToken} quickBuyAmount={quickBuyAmount} />
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className="border-b border-border/30">
          <td className="py-3 px-3"><Skeleton className="h-4 w-6 mx-auto" /></td>
          <td className="py-3 px-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </td>
          <td className="py-3 px-3 hidden sm:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="py-3 px-3 hidden md:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="py-3 px-3 hidden lg:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
          <td className="py-3 px-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
          <td className="py-3 px-3"><Skeleton className="h-6 w-16 ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

export default function DiscoverPage() {
  const { data: tokens, isLoading, isFetching, dataUpdatedAt } = useDiscoverTokens();
  const [activePreset, setActivePreset] = useState(getActivePreset);
  const [quickBuyAmount, setQuickBuyAmount] = useState(() => getPresetAmount(getActivePreset()));
  const [editingQb, setEditingQb] = useState(false);
  const [qbInput, setQbInput] = useState(String(quickBuyAmount));
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!editingQb) setQbInput(String(quickBuyAmount));
  }, [quickBuyAmount, editingQb]);

  const handlePresetSwitch = useCallback((preset: string) => {
    savePresetAmount(activePreset, quickBuyAmount);
    const newAmount = getPresetAmount(preset);
    setActivePreset(preset);
    saveActivePreset(preset);
    setQbInput(String(newAmount));
    setQuickBuyAmount(newAmount);
  }, [activePreset, quickBuyAmount]);

  const handleQbSave = useCallback(() => {
    setEditingQb(false);
    const num = parseFloat(qbInput);
    if (num > 0 && isFinite(num)) {
      setQuickBuyAmount(num);
      savePresetAmount(activePreset, num);
    } else {
      setQbInput(String(quickBuyAmount));
    }
  }, [qbInput, quickBuyAmount, activePreset]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const ACCENT = "160 84% 39%";

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="space-y-0 relative z-10">
        {/* Header with P1 P2 P3 + Quick Buy */}
        <div className="pulse-axiom-header" style={{ "--col-accent": ACCENT } as React.CSSProperties}>
          {/* Quick Buy Amount */}
          <button className="pulse-axiom-qb" onClick={() => setEditingQb(!editingQb)}>
            <Zap className="h-3 w-3 text-warning" />
            {editingQb ? (
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={qbInput}
                onChange={e => {
                  if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                    setQbInput(e.target.value);
                  }
                }}
                onBlur={handleQbSave}
                onKeyDown={e => e.key === "Enter" && handleQbSave()}
                className="w-10 bg-transparent text-[11px] font-mono font-bold text-foreground outline-none"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-[11px] font-mono font-bold text-foreground">{quickBuyAmount}</span>
            )}
          </button>

          {/* Menu */}
          <button className="pulse-axiom-icon-btn">
            <Menu className="h-3 w-3" />
          </button>

          {/* Wallet Presets */}
          <div className="pulse-axiom-presets">
            {WALLET_PRESETS.map(p => (
              <button
                key={p}
                onClick={() => handlePresetSwitch(p)}
                className={`pulse-axiom-preset ${activePreset === p ? "active" : ""}`}
                style={activePreset === p ? { borderColor: `hsl(${ACCENT})`, color: `hsl(${ACCENT})` } : undefined}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Column Label */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <TrendingUp className="h-3 w-3 flex-shrink-0" style={{ color: `hsl(${ACCENT})` }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 truncate">
              Trending 6H
            </span>
          </div>

          {/* Refresh indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin text-primary")} />
            {lastUpdated && <span className="hidden sm:inline">{lastUpdated}</span>}
          </div>

          {/* Accent line */}
          <div className="pulse-col-accent-line" style={{ background: `linear-gradient(90deg, hsl(${ACCENT} / 0.6), transparent)` }} />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="py-2.5 px-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">#</th>
                <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Token</th>
                <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Market Cap</th>
                <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Liquidity</th>
                <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Volume 24h</th>
                <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">6h %</th>
                <th className="py-2.5 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Buy</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : tokens && tokens.length > 0 ? (
                tokens.map((token) => <TokenRow key={token.address} token={token} quickBuyAmount={quickBuyAmount} />)
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No trending tokens found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LaunchpadLayout>
  );
}
