import { useMemo, useState, useRef, useEffect } from "react";
import { FunToken } from "@/hooks/useFunTokensPaginated";
import { CodexPairToken } from "@/hooks/useCodexNewPairs";
import { useKingOfTheHill } from "@/hooks/useKingOfTheHill";
import { useSparklineBatch } from "@/hooks/useSparklineBatch";
import { AxiomTokenRow } from "./AxiomTokenRow";
import { CodexPairRow } from "./CodexPairRow";
import { PulseColumnHeaderBar } from "./PulseColumnHeaderBar";
import { PulseFiltersDialog } from "./PulseFiltersDialog";
import { LaunchedTokensMarquee } from "./LaunchedTokensMarquee";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Flame, CheckCircle2, Radio } from "lucide-react";
import { usePulseFilters, ColumnId } from "@/hooks/usePulseFilters";
import { SOLANA_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import type { SupportedChain } from "@/contexts/ChainContext";

interface AxiomTerminalGridProps {
  tokens: FunToken[];
  solPrice: number | null;
  isLoading: boolean;
  codexNewPairs?: CodexPairToken[];
  codexCompleting?: CodexPairToken[];
  codexGraduated?: CodexPairToken[];
  quickBuyAmount: number;
  onQuickBuyChange?: (amount: number) => void;
  proTradersMap?: Record<string, number>;
  chain?: SupportedChain;
  networkId?: number;
  nativeCurrency?: string;
}

const COLUMN_TABS = [
  { id: "new" as const, label: "New Pairs", icon: Rocket, color: "160 84% 39%" },
  { id: "final" as const, label: "Final Stretch", icon: Flame, color: "38 92% 50%" },
  { id: "migrated" as const, label: "Migrated", icon: CheckCircle2, color: "220 90% 56%" },
];

type ColumnTab = typeof COLUMN_TABS[number]["id"];

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

export function AxiomTerminalGrid({ tokens, solPrice, isLoading, codexNewPairs = [], codexCompleting = [], codexGraduated = [], quickBuyAmount, onQuickBuyChange, proTradersMap = {}, chain = 'solana', networkId = SOLANA_NETWORK_ID, nativeCurrency = 'SOL' }: AxiomTerminalGridProps) {
  const [mobileTab, setMobileTab] = useState<ColumnTab>("new");
  const [tabletRightTab, setTabletRightTab] = useState<"final" | "migrated">("final");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { tokens: kingTokens } = useKingOfTheHill();
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  const isBnb = chain === 'bnb';

  const {
    filters, activeFilterColumn, setActiveFilterColumn,
    updateFilter, resetFilter, hasActiveFilters,
    applyFilterToFunTokens, applyFilterToCodexTokens,
  } = usePulseFilters();

  const { newPairs, finalStretch, migrated } = useMemo(() => {
    // On BNB chain, DB tokens are empty — only Codex tokens used
    if (isBnb) return { newPairs: [] as FunToken[], finalStretch: [] as FunToken[], migrated: [] as FunToken[] };

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
  }, [tokens, kingTokens, isBnb]);

  // Apply filters
  const filteredNewPairs = useMemo(() => applyFilterToFunTokens(newPairs, "new", solPrice), [newPairs, filters, solPrice]);
  const filteredFinalStretch = useMemo(() => applyFilterToFunTokens(finalStretch, "final", solPrice), [finalStretch, filters, solPrice]);
  const filteredMigrated = useMemo(() => applyFilterToFunTokens(migrated, "migrated", solPrice), [migrated, filters, solPrice]);

  const filteredCodexNew = useMemo(() => applyFilterToCodexTokens(codexNewPairs, "new"), [codexNewPairs, filters]);
  const filteredCodexCompleting = useMemo(() => applyFilterToCodexTokens(codexCompleting, "final"), [codexCompleting, filters]);
  const filteredCodexGraduated = useMemo(() => applyFilterToCodexTokens(codexGraduated, "migrated"), [codexGraduated, filters]);

  // Collect addresses for sparkline batch fetch (all columns)
  const allAddresses = useMemo(() => {
    const funAddrs = [...filteredNewPairs, ...filteredFinalStretch, ...filteredMigrated]
      .map(t => t.mint_address).filter(Boolean) as string[];
    const codexAddrs = [...(filteredCodexNew ?? []), ...(filteredCodexCompleting ?? []), ...(filteredCodexGraduated ?? [])]
      .map(t => t.address).filter(Boolean) as string[];
    return [...funAddrs, ...codexAddrs];
  }, [filteredNewPairs, filteredFinalStretch, filteredMigrated, filteredCodexNew, filteredCodexCompleting, filteredCodexGraduated]);

  const { data: sparklineMap } = useSparklineBatch(allAddresses, networkId);

  // Column labels adapt to chain
  const columnLabels = isBnb
    ? { new: "New BNB Pairs", final: "Final Stretch", migrated: "Top Liquidity" }
    : { new: "New Pairs", final: "Final Stretch", migrated: "Migrated" };

  const columns = [
    { id: "new" as const, label: columnLabels.new, icon: Rocket, tokens: filteredNewPairs, codex: filteredCodexNew, color: COLUMN_TABS[0].color },
    { id: "final" as const, label: columnLabels.final, icon: Flame, tokens: filteredFinalStretch, codex: filteredCodexCompleting, color: COLUMN_TABS[1].color },
    { id: "migrated" as const, label: columnLabels.migrated, icon: CheckCircle2, tokens: filteredMigrated, codex: filteredCodexGraduated, color: COLUMN_TABS[2].color },
  ];


  const activeColumn = columns.find(c => c.id === mobileTab)!;

  // Animated tab indicator
  useEffect(() => {
    if (!tabBarRef.current) return;
    const idx = COLUMN_TABS.findIndex(t => t.id === mobileTab);
    const tabs = tabBarRef.current.querySelectorAll<HTMLButtonElement>('[data-tab]');
    const tab = tabs[idx];
    if (tab) {
      setIndicatorStyle({ left: tab.offsetLeft, width: tab.offsetWidth });
    }
  }, [mobileTab]);

  const openFiltersForColumn = (col: ColumnId) => {
    setActiveFilterColumn(col);
    setFiltersOpen(true);
  };

  const renderColumnContent = (col: typeof columns[number]) => {
    if (isLoading) return <PulseColumnSkeleton />;
    if (col.tokens.length === 0 && col.codex.length === 0) return <PulseEmptyColumn label={col.label} color={col.color} />;
    return (
      <div className="pulse-card-list">
        {col.codex.map(t => (
          <CodexPairRow
            key={`codex-${t.address}`}
            token={t}
            quickBuyAmount={quickBuyAmount}
            proTraders={0}
            sparklineData={t.address ? sparklineMap?.[t.address] : undefined}
            chain={chain}
          />
        ))}
        {col.tokens.map(token => (
          <AxiomTokenRow
            key={token.id}
            token={token}
            solPrice={solPrice}
            quickBuyAmount={quickBuyAmount}
            proTraders={proTradersMap[token.id] ?? 0}
            sparklineData={token.mint_address ? sparklineMap?.[token.mint_address] : undefined}
          />
        ))}
      </div>
    );
  };

  const tabletRightColumn = tabletRightTab === "final" ? columns[1] : columns[2];

  return (
    <div className="w-full">
      {/* Scrolling launched token cards */}
      <LaunchedTokensMarquee />
      {/* Filters Dialog */}
      <PulseFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        activeColumn={activeFilterColumn}
        onColumnChange={setActiveFilterColumn}
        onUpdate={updateFilter}
        onReset={resetFilter}
      />

      {/* ═══ Mobile: Premium Tab Switcher (<640px) ═══ */}
      <div className="sm:hidden">
        <div className="pulse-mobile-tabs" ref={tabBarRef}>
          {columns.map((col) => {
            const tab = COLUMN_TABS.find(t => t.id === col.id)!;
            const isActive = mobileTab === col.id;
            return (
              <button
                key={col.id}
                data-tab={col.id}
                onClick={() => setMobileTab(col.id)}
                className={`pulse-mobile-tab ${isActive ? "active" : ""}`}
              >
                <span className="pulse-tab-dot" style={{ background: `hsl(${tab.color})` }} />
                <span>{col.label}</span>
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
        <div className="pulse-column-v2 border-r border-border">
          <PulseColumnHeaderBar
            label={columnLabels.new} color={COLUMN_TABS[0].color} icon={Rocket}
            quickBuyAmount={quickBuyAmount}
            onQuickBuyChange={onQuickBuyChange}
            onOpenFilters={() => openFiltersForColumn("new")}
            hasActiveFilters={hasActiveFilters("new")}
          />
          <div className="pulse-column-scroll-v2">
            {renderColumnContent(columns[0])}
          </div>
        </div>
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
                    <span>{col.label}</span>
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
            <PulseColumnHeaderBar
              label={col.label} color={col.color} icon={col.icon}
              quickBuyAmount={quickBuyAmount}
              onQuickBuyChange={onQuickBuyChange}
              onOpenFilters={() => openFiltersForColumn(col.id)}
              hasActiveFilters={hasActiveFilters(col.id)}
            />
            <div className="pulse-column-scroll-v2">
              {renderColumnContent(col)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
