import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useGraduatedTokens } from "@/hooks/useGraduatedTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useCodexNewPairs } from "@/hooks/useCodexNewPairs";
import { useProTradersCount } from "@/hooks/useProTradersCount";
import { AxiomTerminalGrid } from "@/components/launchpad/AxiomTerminalGrid";
import { useTradeSounds } from "@/hooks/useTradeSounds";
import {
  List, Settings, Bookmark, Monitor, Volume2, VolumeX, LayoutGrid, ChevronDown, Zap
} from "lucide-react";

const QUICK_BUY_KEY = "pulse-quick-buy-amount";
const DEFAULT_QUICK_BUY = 0.5;

function getStoredQuickBuy(): number {
  try {
    const v = localStorage.getItem(QUICK_BUY_KEY);
    if (v) { const n = parseFloat(v); if (n > 0 && isFinite(n)) return n; }
  } catch {}
  return DEFAULT_QUICK_BUY;
}

export default function TradePage() {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const { tokens, totalCount, isLoading } = useFunTokensPaginated(1, 100);
  const { tokens: graduatedTokens } = useGraduatedTokens();
  const { solPrice } = useSolPrice();
  const { newPairs: codexNewPairs, completing: codexCompleting, graduated: codexGraduated } = useCodexNewPairs();
  const [quickBuyAmount, setQuickBuyAmount] = useState(getStoredQuickBuy);
  const [quickBuyInput, setQuickBuyInput] = useState(String(getStoredQuickBuy()));
  const { toggle: toggleSounds, isEnabled: isSoundsEnabled } = useTradeSounds();
  const [soundsOn, setSoundsOn] = useState(() => localStorage.getItem("pulse-sounds-enabled") === "true");

  const handleQuickBuyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setQuickBuyInput(val);
      const num = parseFloat(val);
      if (num > 0 && isFinite(num)) {
        setQuickBuyAmount(num);
        localStorage.setItem(QUICK_BUY_KEY, String(num));
      }
    }
  }, []);

  const handleQuickBuySet = useCallback((amount: number) => {
    setQuickBuyAmount(amount);
    setQuickBuyInput(String(amount));
    localStorage.setItem(QUICK_BUY_KEY, String(amount));
  }, []);

  const allTokens = useMemo(() => {
    const tokenIds = new Set(tokens.map(t => t.id));
    const missingGraduated = graduatedTokens.filter(t => !tokenIds.has(t.id));
    return [...tokens, ...missingGraduated];
  }, [tokens, graduatedTokens]);

  const mintAddresses = useMemo(() => allTokens.map(t => t.mint_address).filter(Boolean) as string[], [allTokens]);
  const { data: proTradersMap } = useProTradersCount(mintAddresses);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTokens;
    const q = search.toLowerCase();
    return allTokens.filter(t =>
      t.name.toLowerCase().includes(q) || t.ticker.toLowerCase().includes(q)
    );
  }, [allTokens, search]);

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="space-y-0 relative z-10">
        {/* Pulse Header Toolbar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-bold text-foreground tracking-tight">Pulse</h1>
            <button className="pulse-toolbar-icon"><List className="h-3.5 w-3.5" /></button>
            <button className="pulse-toolbar-icon"><Settings className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="pulse-toolbar-btn">
              <span>Display</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
            <button className="pulse-toolbar-icon"><Bookmark className="h-3.5 w-3.5" /></button>
            <button className="pulse-toolbar-icon"><Monitor className="h-3.5 w-3.5" /></button>
            <button
              className={`pulse-toolbar-icon ${soundsOn ? "!text-primary !bg-primary/10" : ""}`}
              onClick={() => { toggleSounds(); setSoundsOn(!soundsOn); }}
              title={soundsOn ? "Mute trade sounds" : "Enable trade sounds"}
            >
              {soundsOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
            <button className="pulse-toolbar-icon"><Settings className="h-3.5 w-3.5" /></button>
            <button className="pulse-toolbar-icon"><LayoutGrid className="h-3.5 w-3.5" /></button>
            <div className="flex items-center gap-1 ml-1 px-2 py-1 rounded bg-muted/50 text-[10px] font-mono text-muted-foreground">
              <span className="text-foreground font-bold">1</span>
              <span>=</span>
              <span>{totalCount.toLocaleString()}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-40" />
            </div>
          </div>
        </div>

        {search && (
          <div className="px-3 py-1">
            <span className="text-[10px] font-mono text-accent-purple">
              filtering: "{search}"
            </span>
          </div>
        )}

        {/* Axiom Terminal Grid */}
        <AxiomTerminalGrid
          tokens={filtered}
          solPrice={solPrice}
          isLoading={isLoading}
          codexNewPairs={codexNewPairs}
          codexCompleting={codexCompleting}
          codexGraduated={codexGraduated}
          quickBuyAmount={quickBuyAmount}
          onQuickBuyChange={handleQuickBuySet}
          proTradersMap={proTradersMap ?? {}}
        />
      </div>
    </LaunchpadLayout>
  );
}
