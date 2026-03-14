import { useMemo, useState, useRef, useEffect, useCallback } from "react";
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

const DEFAULT_QB = 0.5;

function getColumnQb(colId: string): number {
  try {
    const v = localStorage.getItem(`pulse-col-qb-${colId}`);
    if (v) { const n = parseFloat(v); if (n > 0 && isFinite(n)) return n; }
  } catch {}
  return DEFAULT_QB;
}

function saveColumnQb(colId: string, amount: number) {
  try { localStorage.setItem(`pulse-col-qb-${colId}`, String(amount)); } catch {}
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

export function AxiomTerminalGrid({ tokens, solPrice, isLoading, codexNewPairs = [], codexCompleting = [], codexGraduated = [], quickBuyAmount: _globalQb, onQuickBuyChange, proTradersMap = {}, chain = 'solana', networkId = SOLANA_NETWORK_ID, nativeCurrency = 'SOL' }: AxiomTerminalGridProps) {
  const [mobileTab, setMobileTab] = useState<ColumnTab>("new");
  const [tabletRightTab, setTabletRightTab] = useState<"final" | "migrated">("final");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { tokens: kingTokens } = useKingOfTheHill();
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  // Per-column quick-buy amounts
  const [qbNew, setQbNew] = useState(() => getColumnQb("new"));
  const [qbFinal, setQbFinal] = useState(() => getColumnQb("final"));
  const [qbMigrated, setQbMigrated] = useState(() => getColumnQb("migrated"));

  const handleQbChange = useCallback((colId: ColumnTab, amount: number) => {
    saveColumnQb(colId, amount);
    if (colId === "new") setQbNew(amount);
    else if (colId === "final") setQbFinal(amount);
    else setQbMigrated(amount);
  }, []);

  const qbMap: Record<ColumnTab, number> = { new: qbNew, final: qbFinal, migrated: qbMigrated };

  const isBnb = chain === 'bnb';
  const [activeFilterColumn, setActiveFilterColumn] = useState<ColumnId>("new");
  const { filters, updateFilter, resetFilter, applyFilterToFunTokens, applyFilterToCodexTokens, hasActiveFilters } = usePulseFilters();

  // Filter DB tokens into columns
  const { filteredNewPairs, filteredFinalStretch, filteredMigrated } = useMemo(() => {
    const newPairs: FunToken[] = [];
    const finalStretch: FunToken[] = [];
    const migrated: FunToken[] = [];

    for (const t of tokens) {
      const progress = t.bonding_progress ?? 0;
      const status = t.status ?? 'active';
      if (status === 'graduated' || status === 'migrated') migrated.push(t);
      else if (progress >= 50) finalStretch.push(t);
      else newPairs.push(t);
    }
    return {
      filteredNewPairs: applyFilterToFunTokens(newPairs, "new", solPrice),
      filteredFinalStretch: applyFilterToFunTokens(finalStretch, "final", solPrice),
      filteredMigrated: applyFilterToFunTokens(migrated, "migrated", solPrice),
    };
  }, [tokens, applyFilterToFunTokens, solPrice]);

  // Filter codex tokens
  const filteredCodexNew = useMemo(() => applyFilterToCodexTokens(codexNewPairs, "new"), [codexNewPairs, applyFilterToCodexTokens]);
  const filteredCodexCompleting = useMemo(() => applyFilterToCodexTokens(codexCompleting, "final"), [codexCompleting, applyFilterToCodexTokens]);
  const filteredCodexGraduated = useMemo(() => applyFilterToCodexTokens(codexGraduated, "migrated"), [codexGraduated, applyFilterToCodexTokens]);

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
    const colQb = qbMap[col.id];
    if (isLoading) return <PulseColumnSkeleton />;
    if (col.tokens.length === 0 && col.codex.length === 0) return <PulseEmptyColumn label={col.label} color={col.color} />;
    return (
      <div className="pulse-card-list">
        {col.codex.map(t => (
          <CodexPairRow
            key={`codex-${t.address}`}
            token={t}
            quickBuyAmount={colQb}
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
            quickBuyAmount={colQb}
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
            columnId="new"
            quickBuyAmount={qbNew}
            onQuickBuyChange={(v) => handleQbChange("new", v)}
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
              columnId={col.id}
              quickBuyAmount={qbMap[col.id]}
              onQuickBuyChange={(v) => handleQbChange(col.id, v)}
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
