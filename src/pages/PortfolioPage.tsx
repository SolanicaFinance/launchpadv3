import { useState, useMemo, useEffect } from "react";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { useAuth } from "@/hooks/useAuth";
import { useLaunchpad, formatTokenAmount, formatSolAmount, type Token } from "@/hooks/useLaunchpad";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useTurboSwap } from "@/hooks/useTurboSwap";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import {
  Wallet, TrendingUp, Search, ExternalLink,
  Loader2, BarChart3, Coins
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface HoldingWithToken {
  id: string;
  token_id: string;
  wallet_address: string;
  balance: number;
  tokens: {
    id: string;
    mint_address: string;
    name: string;
    ticker: string;
    image_url: string | null;
    price_sol: number;
    status: string;
    dbc_pool_address: string | null;
    virtual_sol_reserves: number;
    virtual_token_reserves: number;
    real_sol_reserves: number;
    real_token_reserves: number;
    total_supply: number;
    graduation_threshold_sol: number;
    market_cap_sol: number;
    volume_24h_sol: number;
    holder_count: number;
    bonding_curve_progress: number;
  } | null;
}

// Mock PnL chart data
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
  const { useUserHoldings, useUserTokens } = useLaunchpad();
  const { executeTurboSwap, isLoading: isSelling } = useTurboSwap();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sellingMint, setSellingMint] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const { data: holdings = [], isLoading } = useUserHoldings(solanaAddress);
  const { data: createdTokens = [] } = useUserTokens(solanaAddress);

  // Fetch SOL balance
  useEffect(() => {
    if (!solanaAddress || !getBalance) return;
    let cancelled = false;
    getBalance().then(b => { if (!cancelled) setSolBalance(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [solanaAddress, getBalance]);

  const typedHoldings = holdings as HoldingWithToken[];

  const filteredHoldings = useMemo(() => {
    if (!searchQuery.trim()) return typedHoldings;
    const q = searchQuery.toLowerCase();
    return typedHoldings.filter(h =>
      h.tokens?.name?.toLowerCase().includes(q) ||
      h.tokens?.ticker?.toLowerCase().includes(q)
    );
  }, [typedHoldings, searchQuery]);

  const totalValue = useMemo(() =>
    typedHoldings.reduce((sum, h) => {
      if (!h.tokens) return sum;
      return sum + (h.balance * h.tokens.price_sol);
    }, 0),
    [typedHoldings]
  );

  const handleSell = async (holding: HoldingWithToken) => {
    if (!holding.tokens) return;
    setSellingMint(holding.tokens.mint_address);
    try {
      const result = await executeTurboSwap(
        {
          ...holding.tokens,
          mint_address: holding.tokens.mint_address,
        } as any,
        holding.balance / 1_000_000_000, // Convert from raw to actual
        false,
        500,
      );
      toast({
        title: "Sold!",
        description: `${holding.tokens.ticker} sold successfully`,
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
      <LaunchpadLayout hideFooter>
        <div className="flex flex-col items-center justify-center py-20">
          <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-foreground">Connect Wallet</h2>
          <p className="text-muted-foreground mb-4 text-center">Connect your wallet to view your portfolio</p>
          <Button onClick={() => login()}>Connect Wallet</Button>
        </div>
      </LaunchpadLayout>
    );
  }

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Portfolio</h1>
          <div className="text-sm font-mono text-muted-foreground">
            {solanaAddress ? `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}` : ""}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-xl font-bold text-foreground">{formatSolAmount(totalValue)} SOL</p>
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">SOL Balance</p>
            <p className="text-xl font-bold text-foreground">
              {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : "—"}
            </p>
          </Card>
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground mb-1">Positions</p>
            <p className="text-xl font-bold text-foreground">{typedHoldings.length}</p>
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
              Active Positions ({typedHoldings.length})
            </TabsTrigger>
            <TabsTrigger value="created" className="flex-1">
              Created ({createdTokens.length})
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
                <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
              <div className="space-y-1">
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 text-xs text-muted-foreground font-medium">
                  <span>Token</span>
                  <span className="text-right">Balance</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Value</span>
                  <span className="w-20" />
                </div>
                {filteredHoldings.map((holding) => {
                  if (!holding.tokens) return null;
                  const value = holding.balance * holding.tokens.price_sol;
                  const pct = (holding.balance / 1_000_000_000) * 100;
                  const isThisSelling = sellingMint === holding.tokens.mint_address;

                  return (
                    <Card
                      key={holding.id}
                      className="p-3 md:p-4 border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:gap-3">
                        {/* Token info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0 md:flex-none">
                          <div className="h-9 w-9 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0">
                            {holding.tokens.image_url ? (
                              <img src={holding.tokens.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {holding.tokens.ticker.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate text-sm">{holding.tokens.name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                ${holding.tokens.ticker}
                              </Badge>
                            </div>
                            <button
                              onClick={() => navigate(`/trade/${holding.tokens!.mint_address}`)}
                              className="text-[11px] text-muted-foreground hover:text-primary font-mono flex items-center gap-1 transition-colors"
                            >
                              {holding.tokens.mint_address.slice(0, 6)}...{holding.tokens.mint_address.slice(-4)}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Balance */}
                        <div className="hidden md:block text-right">
                          <span className="text-sm font-mono text-foreground">
                            {formatTokenAmount(holding.balance)}
                          </span>
                          <p className="text-[10px] text-muted-foreground">{pct.toFixed(4)}%</p>
                        </div>

                        {/* Price */}
                        <div className="hidden md:block text-right">
                          <span className="text-sm font-mono text-foreground">
                            {formatSolAmount(holding.tokens.price_sol)}
                          </span>
                        </div>

                        {/* Value */}
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">{formatSolAmount(value)} SOL</p>
                          <p className="text-[11px] text-muted-foreground md:hidden">
                            {formatTokenAmount(holding.balance)} tokens
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
                              handleSell(holding);
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

          <TabsContent value="created" className="mt-3">
            {createdTokens.length === 0 ? (
              <Card className="p-12 text-center border-border">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No tokens created</h3>
                <p className="text-sm text-muted-foreground mb-4">Launch your own token and earn fees from trading</p>
                <Link to="/launch">
                  <Button>Launch Token</Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-2">
                {createdTokens.map((token: Token) => (
                  <Link key={token.id} to={`/trade/${token.mint_address}`}>
                    <Card className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors border-border">
                      <div className="h-9 w-9 rounded-lg bg-muted border border-border overflow-hidden flex-shrink-0">
                        {token.image_url ? (
                          <img src={token.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {token.ticker.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground truncate text-sm">{token.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">${token.ticker}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          MC: {formatSolAmount(token.market_cap_sol)} SOL • {token.holder_count} holders
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">{formatSolAmount(token.price_sol)} SOL</p>
                      </div>
                    </Card>
                  </Link>
                ))}
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
    </LaunchpadLayout>
  );
}
