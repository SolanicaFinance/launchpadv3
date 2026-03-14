import { TokenCard, WalletBalanceCard } from "@/components/launchpad";
import { TopPerformersToday } from "@/components/launchpad/TopPerformersToday";
import { PulseColumnHeaderBar } from "@/components/launchpad/PulseColumnHeaderBar";
import { PulseFiltersDialog } from "@/components/launchpad/PulseFiltersDialog";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { usePulseFilters } from "@/hooks/usePulseFilters";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Search, Clock, Sparkles, Zap, GraduationCap, Flame, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { BRAND } from "@/config/branding";


export default function LaunchpadPage() {
  const { tokens, isLoadingTokens } = useLaunchpad();
  const { solPrice } = useSolPrice();
  const { filters, activeFilterColumn, setActiveFilterColumn, updateFilter, resetFilter, hasActiveFilters, applyFilterToFunTokens } = usePulseFilters();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("new");
  const [quickBuyAmount, setQuickBuyAmount] = useState(() => {
    try { const v = localStorage.getItem("pulse-qb-P1"); if (v) { const n = parseFloat(v); if (n > 0) return n; } } catch {}
    return 0.5;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleQuickBuyChange = useCallback((amount: number) => {
    setQuickBuyAmount(amount);
  }, []);
  // Calculate "hotness" score for trending algorithm
  const calculateHotScore = (token: typeof tokens[0]) => {
    const now = Date.now();
    const createdAt = new Date(token.created_at).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    
    const volumeScore = Math.log10(token.volume_24h_sol + 1) * 30;
    const recencyScore = Math.max(0, 20 - ageHours * 0.8);
    const priceChangeRaw = (token as any).price_change_24h || 0;
    const momentumScore = Math.min(20, Math.max(-10, priceChangeRaw * 0.5));
    const holderScore = Math.log10(token.holder_count + 1) * 10;
    const bondingBonus = token.status === 'bonding' 
      ? (token.bonding_curve_progress || 0) * 0.2 
      : 0;
    
    return volumeScore + recencyScore + momentumScore + holderScore + bondingBonus;
  };

  // Filter tokens based on search and tab
  const filteredTokens = useMemo(() => {
    let result = tokens;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
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
          .filter(t => t.status === 'bonding')
          .sort((a, b) => (b.bonding_curve_progress || 0) - (a.bonding_curve_progress || 0));
        break;
      case "graduated":
        result = result
          .filter(t => t.status === 'graduated')
          .sort((a, b) => b.volume_24h_sol - a.volume_24h_sol);
        break;
      default:
        result = [...result].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [tokens, searchQuery, activeTab]);

  const totalTokens = tokens.length;
  const bondingTokens = tokens.filter(t => t.status === 'bonding').length;
  const graduatedTokens = tokens.filter(t => t.status === 'graduated').length;
  const totalVolume = tokens.reduce((acc, t) => acc + t.volume_24h_sol, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-accent/10">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
        </div>

        <div className="relative px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="flex items-center gap-2">
            <img src={BRAND.logoPath} alt={BRAND.name} className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-lg font-bold">{BRAND.name}</span>
            </Link>
            <Link to="/launch">
              <Button size="default" className="gap-2 shadow-lg glow-yellow">
                <Sparkles className="h-4 w-4" />
                Launch Token
              </Button>
            </Link>
          </div>

          <WalletBalanceCard className="mb-4" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-secondary/50 rounded-lg p-2 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-bold text-foreground">{totalTokens}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-bold text-primary">{bondingTokens}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Bonding</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-bold text-green-500">{graduatedTokens}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Graduated</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-2 sm:p-3 text-center">
              <p className="text-base sm:text-lg font-bold text-foreground">{totalVolume.toFixed(1)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">24h Vol</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ticker, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-secondary/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-11 sm:h-12 bg-transparent rounded-none p-0 border-0 grid grid-cols-5 gap-0">
            <TabsTrigger 
              value="new" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-xs sm:text-sm transition-all px-1 sm:px-2"
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">New</span>
            </TabsTrigger>
            <TabsTrigger 
              value="hot" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-xs sm:text-sm transition-all px-1 sm:px-2"
            >
              <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Hot</span>
            </TabsTrigger>
            <TabsTrigger 
              value="top" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-xs sm:text-sm transition-all px-1 sm:px-2"
            >
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Top</span>
            </TabsTrigger>
            <TabsTrigger 
              value="bonding" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-xs sm:text-sm transition-all px-1 sm:px-2"
            >
              <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Bonding</span>
            </TabsTrigger>
            <TabsTrigger 
              value="graduated" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-xs sm:text-sm transition-all px-1 sm:px-2"
            >
              <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Live</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Pulse Header Bar */}
      <div className="max-w-4xl mx-auto px-4 pt-3">
        <PulseColumnHeaderBar
          label="Launchpad"
          color="160 84% 39%"
          icon={Rocket}
          columnId="launchpad"
          quickBuyAmount={quickBuyAmount}
          onQuickBuyChange={handleQuickBuyChange}
          onOpenFilters={() => setFiltersOpen(true)}
          hasActiveFilters={hasActiveFilters("new")}
        />
      </div>

      <PulseFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        activeColumn={activeFilterColumn}
        onColumnChange={setActiveFilterColumn}
        onUpdate={updateFilter}
        onReset={resetFilter}
      />

      {/* Content */}
      {activeTab === "top" ? (
        <TopPerformersToday />
      ) : (
        <div className="p-4 space-y-3 max-w-4xl mx-auto">
          {!isLoadingTokens && filteredTokens.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}</span>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="text-primary hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {isLoadingTokens ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border border-border rounded-xl bg-card space-y-3 animate-pulse">
                <div className="flex gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">No tokens found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {searchQuery 
                  ? "Try adjusting your search query or filters" 
                  : `Be the first to launch a token on ${BRAND.name}!`}
              </p>
              <Link to="/launch">
                <Button className="gap-2 mt-2">
                  <Sparkles className="h-4 w-4" />
                  Launch Token
                </Button>
              </Link>
            </div>
          ) : (
            filteredTokens.map((token, index) => (
              <div 
                key={token.id} 
                className="animate-fadeIn" 
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TokenCard token={token as any} solPrice={solPrice} quickBuyAmount={quickBuyAmount} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
