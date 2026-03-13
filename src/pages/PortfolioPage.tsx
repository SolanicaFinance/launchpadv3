import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletHoldings, type TokenHolding } from "@/hooks/useWalletHoldings";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useTurboSwap } from "@/hooks/useTurboSwap";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet, TrendingUp, Search, ArrowLeft, ExternalLink,
  Loader2, DollarSign, BarChart3
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import moondexoLogo from "@/assets/moondexo-logo.png";

// Fetch enriched token data for holdings
function useEnrichedHoldings(walletAddress: string | null | undefined) {
  const { data: rawHoldings = [], isLoading } = useWalletHoldings(walletAddress);

  const mints = rawHoldings.map(h => h.mint);

  const { data: tokenData = [] } = useQuery({
    queryKey: ["portfolio-tokens", mints.join(",")],
    enabled: mints.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      if (mints.length === 0) return [];
      // Fetch from claw_tokens table by mint_address
      const { data } = await (supabase as any)
        .from("claw_tokens")
        .select("id, mint_address, name, ticker, image_url, price_sol, market_cap_sol, status, dbc_pool_address")
        .in("mint_address", mints);
      return data || [];
    },
  });

  const enriched = useMemo(() => {
    const tokenMap = new Map<string, any>();
    tokenData.forEach((t: any) => tokenMap.set(t.mint_address, t));

    return rawHoldings
      .map(h => ({
        ...h,
        token: tokenMap.get(h.mint) || null,
      }))
      .filter(h => h.token && h.balance > 0)
      .sort((a, b) => {
        const aVal = a.balance * (a.token?.price_sol || 0);
        const bVal = b.balance * (b.token?.price_sol || 0);
        return bVal - aVal;
      });
  }, [rawHoldings, tokenData]);

  return { holdings: enriched, isLoading };
}

// Mock PnL chart data (in a real app, this would come from trade history)
const mockPnlData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  pnl: Math.random() * 2 - 0.5,
})).reduce((acc: { day: number; pnl: number; cumulative: number }[], item) => {
  const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
  acc.push({ ...item, cumulative: prev + item.pnl });
  return acc;
}, []);

export default function PortfolioPage() {
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { getBalance } = useSolanaWalletWithPrivy();
  const { holdings, isLoading } = useEnrichedHoldings(solanaAddress);
  const { executeTurboSwap, isLoading: isSelling } = useTurboSwap();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sellingMint, setSellingMint] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  // Fetch SOL balance
  useState(() => {
    if (solanaAddress && getBalance) {
      getBalance().then(b => setSolBalance(b)).catch(() => {});
    }
  });

  const filteredHoldings = useMemo(() => {
    if (!searchQuery.trim()) return holdings;
    const q = searchQuery.toLowerCase();
    return holdings.filter(h =>
      h.token?.name?.toLowerCase().includes(q) ||
      h.token?.ticker?.toLowerCase().includes(q) ||
      h.mint.toLowerCase().includes(q)
    );
  }, [holdings, searchQuery]);

  const totalValue = useMemo(() =>
    holdings.reduce((sum, h) => sum + (h.balance / (10 ** h.decimals)) * (h.token?.price_sol || 0), 0),
    [holdings]
  );

  const handleSell = async (holding: any) => {
    if (!holding.token) return;
    setSellingMint(holding.mint);
    try {
      const result = await executeTurboSwap(
        {
          ...holding.token,
          mint_address: holding.mint,
        },
        holding.balance / (10 ** holding.decimals),
        false, // isBuy = false (sell)
        500,
      );
      toast({
        title: "Sold!",
        description: `${holding.token.ticker} sold successfully (${result.totalMs}ms)`,
      });
    } catch (err: any) {
      toast({
        title: "Sell failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSellingMint(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-foreground">Connect Wallet</h2>
        <p className="text-muted-foreground mb-4 text-center">Connect your wallet to view your portfolio</p>
        <Button onClick={() => login()}>Connect Wallet</Button>
      </div>
    );
  }

  const formatSol = (n: number) => {
    if (n >= 1000) return n.toFixed(1);
    if (n >= 1) return n.toFixed(3);
    if (n >= 0.001) return n.toFixed(4);
    return n.toFixed(6);
  };

  const formatTokenBalance = (balance: number, decimals: number) => {
    const actual = balance / (10 ** decimals);
    if (actual >= 1_000_000) return (actual / 1_000_000).toFixed(2) + "M";
    if (actual >= 1_000) return (actual / 1_000).toFixed(2) + "K";
    return actual.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-6xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src={moondexoLogo} alt="Logo" className="h-7 w-7 rounded-lg object-cover" />
          </Link>
          <h1 className="text-lg font-bold text-foreground flex-1">Portfolio</h1>
          <div className="text-sm font-mono text-muted-foreground">
            {solanaAddress ? `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}` : ""}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-xl font-bold text-foreground">{formatSol(totalValue)} SOL</p>
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">SOL Balance</p>
            <p className="text-xl font-bold text-foreground">
              {solBalance !== null ? `${formatSol(solBalance)} SOL` : "—"}
            </p>
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">Positions</p>
            <p className="text-xl font-bold text-foreground">{holdings.length}</p>
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">Realized PnL</p>
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockPnlData}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="hsl(var(--primary))"
                    fill="url(#pnlGradient)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="w-full bg-card border border-border">
            <TabsTrigger value="positions" className="flex-1">
              Active Positions ({holdings.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="mt-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredHoldings.length === 0 ? (
              <Card className="p-12 text-center border-border">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground mb-2">
                  {searchQuery ? "No matching positions" : "No active positions"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? "Try a different search" : "Buy tokens to see them here"}
                </p>
                {!searchQuery && (
                  <Link to="/trade">
                    <Button>Explore Tokens</Button>
                  </Link>
                )}
              </Card>
            ) : (
              /* Desktop: table header */
              <div className="space-y-1">
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 text-xs text-muted-foreground font-medium">
                  <span>Token</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Value</span>
                  <span className="w-20" />
                </div>
                {filteredHoldings.map((h) => {
                  const token = h.token;
                  const actualBalance = h.balance / (10 ** h.decimals);
                  const value = actualBalance * (token?.price_sol || 0);
                  const isThisSelling = sellingMint === h.mint;

                  return (
                    <Card
                      key={h.mint}
                      className="p-3 md:p-4 border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:gap-3">
                        {/* Token info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0 md:flex-none">
                          <div className="h-9 w-9 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0">
                            {token?.image_url ? (
                              <img src={token.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {token?.ticker?.slice(0, 2) || "?"}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate text-sm">{token?.name || "Unknown"}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                ${token?.ticker || "???"}
                              </Badge>
                            </div>
                            <button
                              onClick={() => navigate(`/trade/${h.mint}`)}
                              className="text-[11px] text-muted-foreground hover:text-primary font-mono flex items-center gap-1 transition-colors"
                            >
                              {h.mint.slice(0, 6)}...{h.mint.slice(-4)}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Balance - hidden on mobile, shown on right side */}
                        <div className="hidden md:block text-right">
                          <span className="text-sm font-mono text-foreground">
                            {formatTokenBalance(h.balance, h.decimals)}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="hidden md:block text-right">
                          <span className="text-sm font-mono text-foreground">
                            {formatSol(token?.price_sol || 0)}
                          </span>
                        </div>

                        {/* Value */}
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{formatSol(value)} SOL</p>
                          <p className="text-[11px] text-muted-foreground md:hidden">
                            {formatTokenBalance(h.balance, h.decimals)} tokens
                          </p>
                        </div>

                        {/* Sell button */}
                        <div className="w-20 flex justify-end">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isSelling || isThisSelling}
                            onClick={(e) => {
                              e.preventDefault();
                              handleSell(h);
                            }}
                            className="text-xs h-8 px-3"
                          >
                            {isThisSelling ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Sell"
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <Card className="p-12 text-center border-border">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Trade History</h3>
              <p className="text-sm text-muted-foreground">
                Coming soon — view all your past trades with PnL tracking
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
