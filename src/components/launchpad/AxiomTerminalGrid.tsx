import { useMemo, useState, useRef, useEffect } from "react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { CodexPairToken } from "@/hooks/useCodexNewPairs";
import { useKingOfTheHill } from "@/hooks/useKingOfTheHill";
import { AxiomTokenRow } from "./AxiomTokenRow";
import { CodexPairRow } from "./CodexPairRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Flame, CheckCircle2, Zap, Radio } from "lucide-react";

interface AxiomTerminalGridProps {
  tokens: FunToken[];
  solPrice: number | null;
  isLoading: boolean;
  codexNewPairs?: CodexPairToken[];
  codexCompleting?: CodexPairToken[];
  codexGraduated?: CodexPairToken[];
  quickBuyAmount: number;
}

const COLUMN_TABS = [
  { id: "new", label: "New Pairs", icon: Rocket, color: "var(--col-new)" },
  { id: "final", label: "Final Stretch", icon: Flame, color: "var(--col-final)" },
  { id: "migrated", label: "Migrated", icon: CheckCircle2, color: "var(--col-migrated)" },
] as const;

type ColumnTab = typeof COLUMN_TABS[number]["id"];

/* ── Premium Column Header ── */
function PulseColumnHeader({ label, count, icon: Icon, color }: { label: string; count: number; icon: React.ElementType; color: string }) {
  return (
    <div className="pulse-col-header-v2" style={{ "--col-accent": color } as React.CSSProperties}>
      <div className="flex items-center gap-2.5">
        <div className="pulse-col-icon-pill" style={{ background: `hsl(${color} / 0.12)` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: `hsl(${color})` }} />
        </div>
        <span className="text-[12px] font-semibold tracking-wide uppercase text-foreground/90">{label}</span>
        <div className="pulse-live-count">
          <span className="pulse-live-dot" style={{ background: `hsl(${color})` }} />
          <span className="text-[10px] font-mono font-bold text-foreground/70">{count}</span>
        </div>
      </div>
      <div className="pulse-col-accent-line" style={{ background: `linear-gradient(90deg, hsl(${color} / 0.6), transparent)` }} />
    </div>
  );
}

function PulseColumnSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="pulse-card-skeleton">
          <Skeleton className="w-12 h-12 rounded-xl skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 skeleton-shimmer" />
            <Skeleton className="h-2.5 w-full skeleton-shimmer" />
            <Skeleton className="h-2.5 w-1/2 skeleton-shimmer" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-16 skeleton-shimmer ml-auto" />
            <Skeleton className="h-2.5 w-12 skeleton-shimmer ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PulseEmptyColumn({ label, color }: { label: string; color: string }) {
  return (
    <div className="pulse-empty-state">
      <div className="pulse-empty-icon" style={{ background: `hsl(${color} / 0.08)`, borderColor: `hsl(${color} / 0.15)` }}>
        <Radio className="h-5 w-5 pulse-empty-pulse" style={{ color: `hsl(${color} / 0.4)` }} />
      </div>
      <span className="text-[11px] text-muted-foreground/50 font-medium">No {label.toLowerCase()} yet</span>
      <span className="text-[9px] text-muted-foreground/30 font-mono">Scanning...</span>
    </div>
  );
}

export function AxiomTerminalGrid({ tokens, solPrice, isLoading, codexNewPairs = [], codexCompleting = [], codexGraduated = [], quickBuyAmount }: AxiomTerminalGridProps) {
  const [mobileTab, setMobileTab] = useState<ColumnTab>("new");
  const [tabletRightTab, setTabletRightTab] = useState<"final" | "migrated">("final");
  const { tokens: kingTokens } = useKingOfTheHill();
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  const { newPairs, finalStretch, migrated } = useMemo(() => {
    const newPairs = tokens
      .filter(t => (t.bonding_progress ?? 0) < 80 && t.status !== 'graduated')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let finalStretch = tokens
      .filter(t => (t.bonding_progress ?? 0) >= 5 && t.status !== 'graduated')
      .sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0));

    if (finalStretch.length < 3 && kingTokens.length > 0) {
      const existingIds = new Set(finalStretch.map(t => t.id));
      const kingFill = kingTokens
        .filter(k => !existingIds.has(k.id))
        .slice(0, 3 - finalStretch.length)
        .map(k => ({
          id: k.id, name: k.name, ticker: k.ticker, description: null,
          image_url: k.image_url, creator_wallet: k.creator_wallet ?? "",
          twitter_url: k.twitter_url, website_url: null,
          twitter_avatar_url: k.twitter_avatar_url ?? null,
          twitter_verified: k.twitter_verified ?? false,
          twitter_verified_type: k.twitter_verified_type ?? null,
          mint_address: k.mint_address, dbc_pool_address: k.dbc_pool_address,
          status: k.status, price_sol: 0, price_change_24h: null,
          volume_24h_sol: 0, total_fees_earned: 0, holder_count: k.holder_count,
          market_cap_sol: k.market_cap_sol, bonding_progress: k.bonding_progress,
          trading_fee_bps: k.trading_fee_bps, fee_mode: k.fee_mode,
          agent_id: k.agent_id, launchpad_type: k.launchpad_type,
          last_distribution_at: null, created_at: k.created_at, updated_at: k.created_at,
        } satisfies FunToken));
      finalStretch = [...finalStretch, ...kingFill];
    }

    const migrated = tokens
      .filter(t => t.status === 'graduated')
      .sort((a, b) => (b.market_cap_sol ?? 0) - (a.market_cap_sol ?? 0));

    return { newPairs, finalStretch, migrated };
  }, [tokens, kingTokens]);

  const columns = [
    { id: "new" as const, label: "New Pairs", icon: Rocket, tokens: newPairs, codex: codexNewPairs, color: COLUMN_TABS[0].color },
    { id: "final" as const, label: "Final Stretch", icon: Flame, tokens: finalStretch, codex: codexCompleting, color: COLUMN_TABS[1].color },
    { id: "migrated" as const, label: "Migrated", icon: CheckCircle2, tokens: migrated, codex: codexGraduated, color: COLUMN_TABS[2].color },
  ];

  const activeColumn = columns.find(c => c.id === mobileTab)!;

  // Animated tab indicator
  useEffect(() => {
    if (!tabBarRef.current) return;
    const idx = COLUMN_TABS.findIndex(t => t.id === mobileTab);
    const tabs = tabBarRef.current.querySelectorAll<HTMLButtonElement>('[data-tab]');
    const tab = tabs[idx];
    if (tab) {
      setIndicatorStyle({
        left: tab.offsetLeft,
        width: tab.offsetWidth,
      });
    }
  }, [mobileTab]);

  const renderColumnContent = (col: typeof columns[number]) => {
    if (isLoading) return <PulseColumnSkeleton />;
    if (col.tokens.length === 0 && col.codex.length === 0) return <PulseEmptyColumn label={col.label} color={col.color} />;
    return (
      <div className="pulse-card-list">
        {col.codex.map(t => (
          <CodexPairRow key={`codex-${t.address}`} token={t} quickBuyAmount={quickBuyAmount} />
        ))}
        {col.tokens.map(token => (
          <AxiomTokenRow key={token.id} token={token} solPrice={solPrice} quickBuyAmount={quickBuyAmount} />
        ))}
      </div>
    );
  };

  const tabletRightColumn = tabletRightTab === "final" ? columns[1] : columns[2];

  return (
    <div className="w-full">
      {/* ═══ Mobile: Premium Tab Switcher (<640px) ═══ */}
      <div className="sm:hidden">
        <div className="pulse-mobile-tabs" ref={tabBarRef}>
          {COLUMN_TABS.map(tab => {
            const col = columns.find(c => c.id === tab.id)!;
            const isActive = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`pulse-mobile-tab ${isActive ? "active" : ""}`}
              >
                <span className="pulse-tab-dot" style={{ background: `hsl(${tab.color})` }} />
                <span>{tab.label}</span>
                <span className="pulse-tab-count">{isLoading ? '…' : col.tokens.length + col.codex.length}</span>
              </button>
            );
          })}
          <div className="pulse-tab-indicator" style={indicatorStyle} />
        </div>
        <div className="pulse-column-scroll-v2">
          {renderColumnContent(activeColumn)}
        </div>
      </div>

      {/* ═══ Tablet: Two-Column Split (640px-1279px) ═══ */}
      <div className="hidden sm:grid sm:grid-cols-2 xl:hidden border-t border-border">
        {/* Left: Always New Pairs */}
        <div className="pulse-column-v2 border-r border-border">
          <PulseColumnHeader label="New Pairs" count={newPairs.length + codexNewPairs.length} icon={Rocket} color={COLUMN_TABS[0].color} />
          <div className="pulse-column-scroll-v2">
            {renderColumnContent(columns[0])}
          </div>
        </div>
        {/* Right: Toggle between Final Stretch / Migrated */}
        <div className="pulse-column-v2">
          <div className="pulse-tablet-toggle-header">
            <div className="pulse-segmented-control">
              {(["final", "migrated"] as const).map(id => {
                const tab = COLUMN_TABS.find(t => t.id === id)!;
                const col = columns.find(c => c.id === id)!;
                const isActive = tabletRightTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTabletRightTab(id)}
                    className={`pulse-segment ${isActive ? "active" : ""}`}
                    style={isActive ? { "--seg-color": tab.color } as React.CSSProperties : undefined}
                  >
                    <tab.icon className="h-3 w-3" />
                    <span>{tab.label}</span>
                    <span className="pulse-seg-count">{isLoading ? '…' : col.tokens.length + col.codex.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pulse-column-scroll-v2">
            {renderColumnContent(tabletRightColumn)}
          </div>
        </div>
      </div>

      {/* ═══ Desktop: Three Columns (1280px+) ═══ */}
      <div className="hidden xl:grid grid-cols-3 gap-0 border-t border-border">
        {columns.map((col, i) => (
          <div key={col.id} className={`pulse-column-v2 ${i < 2 ? "border-r border-border" : ""}`}>
            <PulseColumnHeader label={col.label} count={col.tokens.length + col.codex.length} icon={col.icon} color={col.color} />
            <div className="pulse-column-scroll-v2">
              {renderColumnContent(col)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
