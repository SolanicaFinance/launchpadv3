import { useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BondingCurveProgress, TransactionHistory, TokenComments, QuickTradeButtons, AdvancedOrderForm, PendingOrders } from "@/components/launchpad";
import { TradePanelWithSwap } from "@/components/launchpad/TradePanelWithSwap";
import { WalletSettingsModal } from "@/components/launchpad/WalletSettingsModal";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useSolPrice } from "@/hooks/useSolPrice";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";
import { 
  ExternalLink, 
  Copy, 
  Share2, 
  Globe, 
  Twitter, 
  MessageCircle,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HEADER_LOGO_SRC = "/saturn-logo.png";

export default function TokenDetailPage() {
  const { mintAddress } = useParams<{ mintAddress: string }>();
  const { user, solanaAddress } = useAuth();
  const { solPrice } = useSolPrice();
  const { useToken, useTokenTransactions, useTokenHolders, useUserHoldings } = useLaunchpad();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: token, isLoading: isLoadingToken, refetch: refetchToken } = useToken(mintAddress || '');
  const { data: transactions = [], isLoading: isLoadingTxs, refetch: refetchTxs } = useTokenTransactions(token?.id || '');
  const { data: holders = [], refetch: refetchHolders } = useTokenHolders(token?.id || '');
  const { data: userHoldings, refetch: refetchHoldings } = useUserHoldings(solanaAddress);

  const formatUsd = (marketCapSol: number) => {
    const usdValue = Number(marketCapSol || 0) * Number(solPrice || 0);
    if (!Number.isFinite(usdValue) || usdValue <= 0) return "$0";
    if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
    if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
    return `$${usdValue.toFixed(0)}`;
  };
  // Live pool state for accurate bonding progress - 60s refresh matches server cache
  const { data: livePoolState, refetch: refetchPoolState } = usePoolState({
    mintAddress: mintAddress || '',
    enabled: !!mintAddress && token?.status === 'bonding',
    refetchInterval: 60000, // 60 seconds (was 10s) - matches server cache
  });

  // Real-time subscriptions for live data
  useEffect(() => {
    if (!token?.id) return;

    // Subscribe to token updates
    const tokenChannel = supabase
      .channel(`token-detail-${token.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tokens',
          filter: `id=eq.${token.id}`
        },
        (payload) => {
          refetchToken();
        }
      )
      .subscribe();

    // Subscribe to transactions
    const txChannel = supabase
      .channel(`token-txs-${token.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'launchpad_transactions',
          filter: `token_id=eq.${token.id}`
        },
        (payload) => {
          refetchTxs();
          refetchToken(); // Also refresh token for price updates
        }
      )
      .subscribe();

    // Subscribe to holders
    const holdersChannel = supabase
      .channel(`token-holders-${token.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'token_holdings',
          filter: `token_id=eq.${token.id}`
        },
        (payload) => {
          refetchHolders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tokenChannel);
      supabase.removeChannel(txChannel);
      supabase.removeChannel(holdersChannel);
    };
  }, [token?.id, refetchToken, refetchTxs, refetchHolders]);

  // Subscribe to user's holdings updates
  useEffect(() => {
    if (!solanaAddress) return;

    const userHoldingsChannel = supabase
      .channel(`user-holdings-${solanaAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'token_holdings',
          filter: `wallet_address=eq.${solanaAddress}`
        },
        (payload) => {
          refetchHoldings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userHoldingsChannel);
    };
  }, [solanaAddress, refetchHoldings]);

  const userBalance = userHoldings?.find(h => h.token_id === token?.id)?.balance || 0;

  const copyAddress = () => {
    if (mintAddress) {
      navigator.clipboard.writeText(mintAddress);
      toast({ title: "Address copied!" });
    }
  };

  const shareToken = () => {
    if (navigator.share && token) {
      navigator.share({
        title: `${token.name} ($${token.ticker})`,
        text: `Check out ${token.name} on Saturn Trade!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  const handleRefresh = () => {
    refetchToken();
    refetchTxs();
    refetchHolders();
    refetchPoolState();
    if (solanaAddress) refetchHoldings();
    toast({ title: "Data refreshed!" });
  };
  
  // Use live pool state when available, fallback to database values
  const realSolReserves = livePoolState?.realSolReserves ?? token?.real_sol_reserves ?? 0;
  const graduationThreshold = livePoolState?.graduationThreshold ?? token?.graduation_threshold_sol ?? 85;
  const bondingProgress = livePoolState?.bondingProgress ?? ((realSolReserves / graduationThreshold) * 100);

  if (isLoadingToken) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold">Token not found</h2>
          <p className="text-muted-foreground mt-2">This token doesn't exist or has been removed.</p>
          <Link to="/launchpad" className="mt-4">
            <Button>Back to Launchpad</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <img src={HEADER_LOGO_SRC} alt="Saturn Trade" className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-lg font-bold">Saturn Trade</span>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={token.image_url || undefined} />
              <AvatarFallback className="rounded-lg text-xs font-bold">
                {token.ticker.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-bold">{token.name}</h1>
              <span className="text-xs text-muted-foreground">${token.ticker}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <WalletSettingsModal walletAddress={solanaAddress || undefined} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={shareToken}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Token Info Card */}
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl border-2 border-border mx-auto sm:mx-0">
              <AvatarImage src={token.image_url || undefined} />
              <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/10 text-primary rounded-xl">
                {token.ticker.slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold">{token.name}</h2>
                <Badge variant="secondary" className="text-xs">${token.ticker}</Badge>
                {token.status === 'graduated' && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                    🎓 Graduated
                  </Badge>
                )}
              </div>

              {/* Creator */}
              <Link 
                to={`/profile/${token.profiles?.username || token.creator_wallet}`}
                className="flex items-center justify-center sm:justify-start gap-1.5 text-xs sm:text-sm text-muted-foreground mt-1 hover:text-foreground"
              >
                <span>Created by</span>
                <span className="font-medium text-foreground">
                  {token.profiles?.display_name || `${token.creator_wallet.slice(0, 6)}...`}
                </span>
                {token.profiles?.verified_type && (
                  <VerifiedBadge type={token.profiles.verified_type as 'blue' | 'gold'} />
                )}
              </Link>

              {/* Description */}
              {token.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2">
                  {token.description}
                </p>
              )}

              {/* Social Links */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-3 flex-wrap">
                {token.website_url && (
                  <a href={token.website_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 gap-1 px-2 sm:px-3 text-xs">
                      <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      <span className="hidden sm:inline">Website</span>
                    </Button>
                  </a>
                )}
                {token.twitter_url && (
                  <a href={token.twitter_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto px-0 sm:px-2">
                      <Twitter className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </a>
                )}
                {token.telegram_url && (
                  <a href={token.telegram_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto px-0 sm:px-2">
                      <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  </a>
                )}
                <a 
                  href={`https://solscan.io/token/${token.mint_address}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="h-7 sm:h-8 gap-1 px-2 sm:px-3 text-xs">
                    <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Solscan</span>
                  </Button>
                </a>
                <a
                  href={`https://axiom.trade/meme/${
                    (token.status === "graduated" ? token.damm_pool_address : token.dbc_pool_address) || token.mint_address
                  }?chain=sol`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="h-7 sm:h-8 gap-1 px-2 sm:px-3 text-xs bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0">
                    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="hidden xs:inline">Axiom</span>
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Price Chart - temporarily disabled */}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Market Cap</p>
            <p className="text-sm sm:text-lg font-bold truncate">
              {formatUsd(token.market_cap_sol)}
            </p>
            <p className="text-[10px] text-muted-foreground sm:hidden">USD</p>
          </Card>
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">24h Volume</p>
            <p className="text-sm sm:text-lg font-bold truncate">
              {formatSolAmount(token.volume_24h_sol)}
            </p>
            <p className="text-[10px] text-muted-foreground sm:hidden">SOL</p>
          </Card>
          <Card className="p-2 sm:p-3 text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Holders</p>
            <p className="text-sm sm:text-lg font-bold">
              {token.holder_count}
            </p>
          </Card>
        </div>

        {/* Bonding Curve Progress - Uses live data */}
        {token.status === 'bonding' && (
          <Card className="p-4">
            <BondingCurveProgress
              progress={bondingProgress}
              realSolReserves={realSolReserves}
              graduationThreshold={graduationThreshold}
            />
            {livePoolState && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                🔴 Live from Meteora • Updated every 10s
              </p>
            )}
          </Card>
        )}

        {/* Quick Trade Buttons */}
        <QuickTradeButtons 
          token={token} 
          userBalance={userBalance} 
          onTradeComplete={() => {
            refetchToken();
            refetchHoldings();
            refetchTxs();
          }}
        />

        {/* Trade Panel */}
        <TradePanelWithSwap
          token={token}
          userBalance={userBalance}
        />

        {/* Advanced Orders - Now with "Available Soon" overlay */}
        <AdvancedOrderForm token={token} userBalance={userBalance} />

        {/* Pending Orders - Hidden for now */}
        {/* <PendingOrders tokenId={token.id} /> */}

        {/* Tabs for Transactions, Holders & Discussion */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="transactions">
              Trades
            </TabsTrigger>
            <TabsTrigger value="holders">
              Holders ({holders.length})
            </TabsTrigger>
            <TabsTrigger value="discussion">
              Discussion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            {isLoadingTxs ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <TransactionHistory transactions={transactions} ticker={token.ticker} />
            )}
          </TabsContent>

          <TabsContent value="holders" className="mt-4">
            <div className="space-y-2">
              {holders.map((holder, i) => (
                <Card key={holder.id} className="p-3 flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    #{i + 1}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={holder.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {holder.profiles?.display_name?.slice(0, 2) || holder.wallet_address.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {holder.profiles?.display_name || `${holder.wallet_address.slice(0, 6)}...${holder.wallet_address.slice(-4)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">
                      {formatTokenAmount(holder.balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {((holder.balance / token.total_supply) * 100).toFixed(2)}%
                    </p>
                  </div>
                </Card>
              ))}
              {holders.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No holders yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="discussion" className="mt-4">
            <TokenComments tokenId={token.id} />
          </TabsContent>
        </Tabs>

        {/* Contract Info */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Contract Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Token Address</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-secondary px-2 py-1 rounded">
                  {token.mint_address.slice(0, 8)}...{token.mint_address.slice(-8)}
                </code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyAddress}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Supply</span>
              <span>{formatTokenAmount(token.total_supply)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
