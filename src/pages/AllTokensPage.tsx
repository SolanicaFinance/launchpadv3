import { TokenCard, WalletBalanceCard } from "@/components/launchpad";
import { PulseColumnHeaderBar } from "@/components/launchpad/PulseColumnHeaderBar";
import { PulseFiltersDialog } from "@/components/launchpad/PulseFiltersDialog";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { usePulseFilters } from "@/hooks/usePulseFilters";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useChain } from "@/contexts/ChainContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Rocket, Search, Clock, Sparkles, Zap, GraduationCap, Flame, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { BRAND } from "@/config/branding";

export default function AllTokensPage() {
  const { chain, chainConfig } = useChain();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { tokens, totalCount, isLoading } = useFunTokensPaginated(page, pageSize);
  const { solPrice } = useSolPrice();
  const { filters, activeFilterColumn, setActiveFilterColumn, updateFilter, resetFilter, hasActiveFilters } = usePulseFilters();
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

  const calculateHotScore = (token: typeof tokens[0]) => {
    const now = Date.now();
    const createdAt = new Date(token.created_at).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    const volumeScore = Math.log10((token.volume_24h_sol || 0) + 1) * 30;
    const recencyScore = Math.max(0, 20 - ageHours * 0.8);
    const priceChangeRaw = token.price_change_24h || 0;
    const momentumScore = Math.min(20, Math.max(-10, priceChangeRaw * 0.5));
    const holderScore = Math.log10((token.holder_count || 0) + 1) * 10;
    const bondingBonus = token.status === 'bonding' ? (token.bonding_progress || 0) * 0.2 : 0;
    return volumeScore + recencyScore + momentumScore + holderScore + bondingBonus;
  };

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
          .sort((a, b) => (b.bonding_progress || 0) - (a.bonding_progress || 0));
        break;
      case "graduated":
        result = result
          .filter(t => t.status === 'graduated')
          .sort((a, b) => (b.volume_24h_sol || 0) - (a.volume_24h_sol || 0));
        break;
      default:
        result = [...result].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [tokens, searchQuery, activeTab]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-20">
        {/* Header */}
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

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ticker, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-secondary/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>

        {/* Tabs */}
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

        {/* Token List */}
        <div className="space-y-3">
          {isLoading ? (
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
                  ? "Try adjusting your search query"
                  : `No tokens on ${chainConfig.name} yet. Be the first!`}
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
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>{filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} (page {page}/{totalPages || 1})</span>
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-primary hover:underline text-xs">
                    Clear search
                  </button>
                )}
              </div>
              {filteredTokens.map((token, index) => (
                <div
                  key={token.id}
                  className="animate-fadeIn"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <TokenCard token={token as any} solPrice={solPrice} quickBuyAmount={quickBuyAmount} />
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground font-mono px-3">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
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
