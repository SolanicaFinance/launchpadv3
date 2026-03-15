import { useLaunchpad, formatTokenAmount, formatSolAmount, Token } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { useChain } from "@/contexts/ChainContext";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { useJupiterPrices } from "@/hooks/useJupiterPrices";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { TrendingUp, Coins, ArrowRight, Plus } from "lucide-react";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
  } | null;
}

export default function PanelPortfolioTab() {
  const { solanaAddress } = useAuth();
  const { chain, chainConfig } = useChain();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { useUserTokens, useUserEarnings } = useLaunchpad();

  const activeAddress = chain === 'solana' ? solanaAddress : evmAddress;
  const currencySymbol = chainConfig.nativeCurrency.symbol;

  // Fetch on-chain holdings
  const { data: onChainHoldings = [], isLoading: isLoadingHoldings } = useWalletHoldings(activeAddress);
  const heldMints = useMemo(() => onChainHoldings.map(h => h.mint).filter(Boolean), [onChainHoldings]);
  
  // Fetch live Jupiter prices + metadata + DB fallback
  const { data: jupiterPrices = {} } = useJupiterPrices(heldMints);
  const { data: tokenMetaMap = {} } = useTokenMetadata(heldMints);
  const { data: dbPriceMap } = useQuery({
    queryKey: ['panel-portfolio-db-prices', heldMints.sort().join(',')],
    queryFn: async () => {
      if (heldMints.length === 0) return new Map<string, { name: string; ticker: string; image_url: string | null; price_sol: number }>();
      const [t1, t2] = await Promise.all([
        supabase.from('tokens').select('mint_address, name, ticker, image_url, price_sol').in('mint_address', heldMints),
        supabase.from('fun_tokens').select('mint_address, name, ticker, image_url, price_sol').in('mint_address', heldMints),
      ]);
      const map = new Map<string, { name: string; ticker: string; image_url: string | null; price_sol: number }>();
      for (const t of (t1.data || [])) { if (t.mint_address) map.set(t.mint_address, t as any); }
      for (const t of (t2.data || [])) { if (t.mint_address && !map.has(t.mint_address)) map.set(t.mint_address, t as any); }
      return map;
    },
    enabled: heldMints.length > 0,
    staleTime: 30_000,
  });

  // Build unified holdings with live prices
  const holdings = useMemo(() => {
    return onChainHoldings.map(h => {
      const meta = tokenMetaMap[h.mint];
      const db = dbPriceMap?.get(h.mint);
      const jup = jupiterPrices[h.mint];
      const decimals = h.decimals || meta?.decimals || 6;
      const uiBalance = h.balance / Math.pow(10, decimals);
      const livePriceSol = jup?.priceSol || db?.price_sol || 0;
      return {
        id: h.mint,
        token_id: h.mint,
        wallet_address: activeAddress || '',
        balance: uiBalance,
        tokens: {
          id: h.mint,
          mint_address: h.mint,
          name: db?.name || meta?.name || h.mint.slice(0, 6),
          ticker: db?.ticker || meta?.symbol || h.mint.slice(0, 4).toUpperCase(),
          image_url: db?.image_url || meta?.image || null,
          price_sol: livePriceSol,
          status: 'active',
        },
      } as HoldingWithToken;
    }).filter(h => h.balance > 0);
  }, [onChainHoldings, tokenMetaMap, dbPriceMap, jupiterPrices, activeAddress]);

  const { data: createdTokens = [], isLoading: isLoadingCreated } = useUserTokens(activeAddress);
  const { data: earnings } = useUserEarnings(activeAddress, undefined);

  const portfolioStats = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => {
      if (!h.tokens) return sum;
      return sum + (h.balance * h.tokens.price_sol);
    }, 0);
    const totalTokens = holdings.length;
    const unclaimedEarnings = earnings?.earnings?.reduce(
      (sum: number, e: { unclaimed_sol: number }) => sum + (e.unclaimed_sol || 0),
      0
    ) || 0;
    return { totalValue, totalTokens, unclaimedEarnings };
  }, [holdings, earnings]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center bg-white/5 border-white/10">
          <p className="text-[10px] text-muted-foreground mb-0.5">Total Value</p>
          <p className="text-sm font-bold" style={{ color: "#4ade80" }}>{formatSolAmount(portfolioStats.totalValue)} {currencySymbol}</p>
        </Card>
        <Card className="p-3 text-center bg-white/5 border-white/10">
          <p className="text-[10px] text-muted-foreground mb-0.5">Holdings</p>
          <p className="text-sm font-bold">{portfolioStats.totalTokens}</p>
        </Card>
        <Card className="p-3 text-center bg-white/5 border-white/10">
          <p className="text-[10px] text-muted-foreground mb-0.5">Unclaimed</p>
          <p className="text-sm font-bold text-green-500">{formatSolAmount(portfolioStats.unclaimedEarnings)} {currencySymbol}</p>
        </Card>
      </div>

      <Tabs defaultValue="holdings" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="holdings" className="flex-1">Holdings</TabsTrigger>
          <TabsTrigger value="created" className="flex-1">Created ({createdTokens.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings" className="mt-4">
          {isLoadingHoldings ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (holdings as HoldingWithToken[]).length === 0 ? (
            <div className="text-center py-12">
              <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No holdings yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Start trading to build your portfolio</p>
              <Link to="/"><Button className="gap-2"><TrendingUp className="h-4 w-4" />Explore Tokens</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {(holdings as HoldingWithToken[]).map((holding) => {
                if (!holding.tokens) return null;
                const value = holding.balance * holding.tokens.price_sol;
                return (
                  <Link key={holding.id} to={`/trade/${holding.tokens.mint_address}`}>
                    <Card className="p-3 flex items-center gap-3 hover:bg-white/5 transition-colors bg-white/[0.02] border-white/10">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage src={holding.tokens.image_url || undefined} />
                        <AvatarFallback className="rounded-lg text-xs font-bold">{holding.tokens.ticker.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{holding.tokens.name}</p>
                          <Badge variant="secondary" className="text-xs">${holding.tokens.ticker}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{formatTokenAmount(holding.balance)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatSolAmount(value)} {currencySymbol}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="created" className="mt-4">
          {isLoadingCreated ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : createdTokens.length === 0 ? (
            <div className="text-center py-12">
              <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No tokens created</h3>
              <Link to="/"><Button className="gap-2"><Plus className="h-4 w-4" />Launch Token</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {createdTokens.map((token: Token) => (
                <Link key={token.id} to={`/trade/${token.mint_address}`}>
                  <Card className="p-3 flex items-center gap-3 hover:bg-white/5 transition-colors bg-white/[0.02] border-white/10">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarImage src={token.image_url || undefined} />
                      <AvatarFallback className="rounded-lg text-xs font-bold">{token.ticker.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{token.name}</p>
                      <p className="text-sm text-muted-foreground">MC: {formatSolAmount(token.market_cap_sol)} {currencySymbol}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
