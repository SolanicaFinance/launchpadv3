import { TokenCard } from "@/components/launchpad";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useChain } from "@/contexts/ChainContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Rocket, Search, Clock, Sparkles, Zap, GraduationCap, Flame, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo, useCallback, useEffect } from "react";

const WALLET_PRESETS = ["P1", "P2", "P3"] as const;
const PRESET_DEFAULTS: Record<string, number> = { P1: 0.5, P2: 1.0, P3: 2.0 };
const COLUMN_ID = "all-tokens";

function getPresetAmount(preset: string): number {
  try {
    const v = localStorage.getItem(`pulse-qb-${COLUMN_ID}-${preset}`);
    if (v) {
      const n = parseFloat(v);
      if (n > 0 && isFinite(n)) return n;
    }
  } catch {}
  return PRESET_DEFAULTS[preset] ?? 0.5;
}

function savePresetAmount(preset: string, amount: number) {
  try {
    localStorage.setItem(`pulse-qb-${COLUMN_ID}-${preset}`, String(amount));
  } catch {}
}

function getActivePreset(): string {
  try {
    return localStorage.getItem(`pulse-active-preset-${COLUMN_ID}`) || "P1";
  } catch {
    return "P1";
  }
}

function saveActivePreset(preset: string) {
  try {
    localStorage.setItem(`pulse-active-preset-${COLUMN_ID}`, preset);
  } catch {}
}

export default function AllTokensPage() {
  const { chainConfig } = useChain();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { tokens, totalCount, isLoading } = useFunTokensPaginated(page, pageSize);
  const { solPrice } = useSolPrice();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("new");

  const [activePreset, setActivePreset] = useState(() => getActivePreset());
  const [quickBuyAmount, setQuickBuyAmount] = useState(() => getPresetAmount(getActivePreset()));
  const [editingQb, setEditingQb] = useState(false);
  const [qbInput, setQbInput] = useState(String(quickBuyAmount));

  useEffect(() => {
    if (!editingQb) setQbInput(String(quickBuyAmount));
  }, [quickBuyAmount, editingQb]);

  const handlePresetSwitch = useCallback(
    (preset: string) => {
      savePresetAmount(activePreset, quickBuyAmount);
      const newAmount = getPresetAmount(preset);
      setActivePreset(preset);
      saveActivePreset(preset);
      setQbInput(String(newAmount));
      setQuickBuyAmount(newAmount);
    },
    [activePreset, quickBuyAmount]
  );

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

  const calculateHotScore = (token: typeof tokens[0]) => {
    const now = Date.now();
    const createdAt = new Date(token.created_at).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    const volumeScore = Math.log10((token.volume_24h_sol || 0) + 1) * 30;
    const recencyScore = Math.max(0, 20 - ageHours * 0.8);
    const priceChangeRaw = token.price_change_24h || 0;
    const momentumScore = Math.min(20, Math.max(-10, priceChangeRaw * 0.5));
    const holderScore = Math.log10((token.holder_count || 0) + 1) * 10;
    const bondingBonus = token.status === "bonding" ? (token.bonding_progress || 0) * 0.2 : 0;
    return volumeScore + recencyScore + momentumScore + holderScore + bondingBonus;
  };

  const filteredTokens = useMemo(() => {
    let result = tokens;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.ticker.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    switch (activeTab) {
      case "hot":
        result = [...result].sort((a, b) => calculateHotScore(b) - calculateHotScore(a));
        break;
      case "bonding":
        result = result
          .filter((t) => t.status === "bonding")
          .sort((a, b) => (b.bonding_progress || 0) - (a.bonding_progress || 0));
        break;
      case "graduated":
        result = result
          .filter((t) => t.status === "graduated")
          .sort((a, b) => (b.volume_24h_sol || 0) - (a.volume_24h_sol || 0));
        break;
      default:
        result = [...result].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [tokens, searchQuery, activeTab]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="w-full py-6 pb-20 px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">All Tokens</h1>
              <p className="text-xs text-muted-foreground">
                {totalCount} tokens on {chainConfig.name} • {chainConfig.icon}
              </p>
            </div>
          </div>
          <Link to="/launchpad">
            <Button size="sm" className="gap-1.5 glow-yellow">
              <Sparkles className="h-3.5 w-3.5" />
              Launch
            </Button>
          </Link>
        </div>

        <div className="pulse-axiom-header mb-3" style={{ "--col-accent": "84 81% 44%" } as React.CSSProperties}>
          <button className="pulse-axiom-qb" onClick={() => setEditingQb(!editingQb)}>
            <Zap className="h-3 w-3 text-warning" />
            {editingQb ? (
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={qbInput}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                    setQbInput(e.target.value);
                  }
                }}
                onBlur={handleQbSave}
                onKeyDown={(e) => e.key === "Enter" && handleQbSave()}
                className="w-10 bg-transparent text-[11px] font-mono font-bold text-foreground outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-[11px] font-mono font-bold text-foreground">{quickBuyAmount}</span>
            )}
          </button>

          <button className="pulse-axiom-icon-btn">
            <Menu className="h-3 w-3" />
          </button>

          <div className="pulse-axiom-presets">
            {WALLET_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => handlePresetSwitch(p)}
                className={`pulse-axiom-preset ${activePreset === p ? "active" : ""}`}
                style={activePreset === p ? { borderColor: "hsl(84 81% 44%)", color: "hsl(84 81% 44%)" } : undefined}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Flame className="h-3 w-3 flex-shrink-0 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 truncate">
              All Tokens
            </span>
          </div>

          <div
            className="pulse-col-accent-line"
            style={{ background: "linear-gradient(90deg, hsl(84 81% 44% / 0.6), transparent)" }}
          />
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ticker, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-secondary/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
          <TabsList className="w-full bg-secondary/30 p-1 grid grid-cols-4 gap-1 rounded-lg">
            <TabsTrigger
              value="new"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs rounded-md gap-1"
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </TabsTrigger>
            <TabsTrigger
              value="hot"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs rounded-md gap-1"
            >
              <Flame className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hot</span>
            </TabsTrigger>
            <TabsTrigger
              value="bonding"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs rounded-md gap-1"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bonding</span>
            </TabsTrigger>
            <TabsTrigger
              value="graduated"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-xs rounded-md gap-1"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Live</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card border border-border overflow-hidden animate-pulse">
                  <Skeleton className="w-full aspect-[16/9]" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">No tokens found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {searchQuery ? "Try adjusting your search query" : `No tokens on ${chainConfig.name} yet. Be the first!`}
              </p>
              <Link to="/launchpad">
                <Button className="gap-2 mt-2">
                  <Sparkles className="h-4 w-4" />
                  Launch Token
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1 mb-3">
                <span>
                  {filteredTokens.length} token{filteredTokens.length !== 1 ? "s" : ""} (page {page}/
                  {totalPages || 1})
                </span>
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-primary hover:underline text-xs">
                    Clear search
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                {filteredTokens.map((token, index) => (
                  <div key={token.id} className="animate-fadeIn" style={{ animationDelay: `${index * 30}ms` }}>
                    <TokenCard token={token as any} solPrice={solPrice} quickBuyAmount={quickBuyAmount} />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <span className="text-sm text-muted-foreground font-mono px-3">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </LaunchpadLayout>
  );
}
