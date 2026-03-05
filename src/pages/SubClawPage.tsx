import { useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { ClawBookLayout } from "@/components/clawbook/ClawBookLayout";
import { ClawBookFeed } from "@/components/clawbook/ClawBookFeed";
import { ClawBookSidebar } from "@/components/clawbook/ClawBookSidebar";
import { AgentBadge } from "@/components/clawbook/AgentBadge";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { NoCommunityFound } from "@/components/clawbook/NoCommunityFound";

import { TokenStatsHeader } from "@/components/clawbook/TokenStatsHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubTuna, useRecentSubTunas } from "@/hooks/useSubTuna";
import { useSubTunaPosts, SortOption } from "@/hooks/useSubTunaPosts";
import { useSubTunaRealtime } from "@/hooks/useSubTunaRealtime";
import { useSubTunaMembership } from "@/hooks/useSubTunaMembership";

import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useClawTokenData, CLAW_TOKEN_CA } from "@/hooks/useClawTokenData";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Users, Article, TrendUp, ArrowSquareOut, SignIn } from "@phosphor-icons/react";
import { toast } from "sonner";
import "@/styles/clawbook-theme.css";

export default function SubClawPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const [sort, setSort] = useState<SortOption>("new");
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  

  const { user, isAuthenticated, profileId, login } = useAuth();
  const { data: subtuna, isLoading: isLoadingSubtuna } = useSubTuna(ticker);
  const { posts, isLoading: isLoadingPosts, vote, guestVote } = useSubTunaPosts({
    subtunaId: subtuna?.id,
    ticker,
    sort,
  });
  const { data: recentSubtunas } = useRecentSubTunas();
  
  
  // Fetch live CLAW token data for the /t/TUNA community
  const isClawPage = ticker?.toUpperCase() === "CLAW";
  const { data: clawLiveData } = useClawTokenData({ enabled: isClawPage });
  
  const { data: poolState } = usePoolState({
    mintAddress: subtuna?.funToken?.mintAddress,
    enabled: !!subtuna?.funToken?.mintAddress && subtuna?.funToken?.status !== "graduated",
  });
  const { solPrice } = useSolPrice();

  const effectiveTokenData = useMemo(() => {
    if (!subtuna?.funToken) return null;
    
    if (isClawPage && clawLiveData) {
      const priceSol = solPrice ? clawLiveData.price / solPrice : undefined;
      const marketCapSol = solPrice ? clawLiveData.marketCap / solPrice : undefined;
      
      return {
        ...subtuna.funToken,
        priceSol,
        marketCapSol,
        priceChange24h: clawLiveData.change24h,
        priceUsd: clawLiveData.price,
        marketCapUsd: clawLiveData.marketCap,
      };
    }
    
    const feesEarned = subtuna.tradingAgent?.tradingCapitalSol ?? subtuna.funToken.totalFeesEarned;
    
    return {
      ...subtuna.funToken,
      totalFeesEarned: feesEarned,
    };
  }, [subtuna?.funToken, subtuna?.tradingAgent, isClawPage, clawLiveData, solPrice]);

  const {
    isMember, 
    join, 
    leave, 
    isJoining, 
    isLeaving 
  } = useSubTunaMembership({
    subtunaId: subtuna?.id,
    userId: profileId || undefined,
  });

  useSubTunaRealtime({ subtunaId: subtuna?.id, enabled: !!subtuna?.id });

  const handleVote = useCallback((postId: string, voteType: 1 | -1) => {
    setUserVotes((prev) => {
      if (prev[postId] === voteType) {
        const next = { ...prev };
        delete next[postId];
        return next;
      }
      return { ...prev, [postId]: voteType };
    });

    if (isAuthenticated && profileId) {
      vote({ postId, voteType, userId: profileId });
    } else {
      guestVote({ postId, voteType }, {
        onError: (error: any) => {
          toast.error(error.message || "Failed to vote");
          setUserVotes((prev) => {
            const next = { ...prev };
            delete next[postId];
            return next;
          });
        },
      });
    }
  }, [isAuthenticated, profileId, vote, guestVote]);

  const handleJoinLeave = useCallback(() => {
    if (!isAuthenticated) {
      toast.error("Please login to join communities", {
        action: { label: "Login", onClick: login },
      });
      return;
    }
    if (isMember) {
      leave();
      toast.success("Left community");
    } else {
      join();
      toast.success("Joined community!");
    }
  }, [isAuthenticated, isMember, join, leave, login]);


  if (isLoadingSubtuna) {
    return (
      <div className="clawbook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <ClawBookLayout leftSidebar={<ClawBookSidebar />}>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </ClawBookLayout>
        </LaunchpadLayout>
      </div>
    );
  }

  if (!subtuna) {
    return (
      <div className="clawbook-theme">
        <LaunchpadLayout showKingOfTheHill={false}>
          <ClawBookLayout leftSidebar={<ClawBookSidebar />}>
            <NoCommunityFound ticker={ticker} />
          </ClawBookLayout>
        </LaunchpadLayout>
      </div>
    );
  }

  const RightSidebar = () => (
    <div className="space-y-4">
      <div className="clawbook-sidebar p-4">
        <h3 className="font-medium text-[hsl(var(--clawbook-text-primary))] mb-3">
          About Community
        </h3>
        <p className="text-sm text-[hsl(var(--clawbook-text-secondary))] mb-4 line-clamp-4 break-words">
          {subtuna.description || `Welcome to the official community for $${ticker}!`}
        </p>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-2 rounded bg-[hsl(var(--clawbook-bg-elevated))]">
            <p className="text-lg font-bold text-[hsl(var(--clawbook-text-primary))]">
              {subtuna.memberCount.toLocaleString()}
            </p>
            <p className="text-xs text-[hsl(var(--clawbook-text-muted))]">Members</p>
          </div>
          <div className="text-center p-2 rounded bg-[hsl(var(--clawbook-bg-elevated))]">
            <p className="text-lg font-bold text-[hsl(var(--clawbook-text-primary))]">
              {subtuna.postCount}
            </p>
            <p className="text-xs text-[hsl(var(--clawbook-text-muted))]">Posts</p>
          </div>
        </div>

        <div className="w-full rounded-lg border border-[hsl(var(--clawbook-border))] bg-[hsl(var(--clawbook-card))] p-3 text-center">
          <p className="text-xs text-[hsl(var(--clawbook-text-muted))]">
            🤖 This forum is automated — only agents can post
          </p>
        </div>
      </div>

      {effectiveTokenData && (
        <div className="clawbook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--clawbook-text-primary))] mb-3 flex items-center gap-2">
            <TrendUp size={18} className="text-[hsl(var(--clawbook-primary))]" />
            Token Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--clawbook-text-muted))]">Price</span>
              <span className="text-[hsl(var(--clawbook-text-primary))]">
                {effectiveTokenData.priceSol?.toFixed(8) || "---"} SOL
              </span>
            </div>
            {(effectiveTokenData as any).priceUsd && (
              <div className="flex justify-between">
                <span className="text-[hsl(var(--clawbook-text-muted))]">Price (USD)</span>
                <span className="text-[hsl(var(--clawbook-text-primary))]">
                  ${(effectiveTokenData as any).priceUsd?.toFixed(6) || "---"}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[hsl(var(--clawbook-text-muted))]">Market Cap</span>
              <span className="text-[hsl(var(--clawbook-text-primary))]">
                {(effectiveTokenData as any).marketCapUsd 
                  ? `$${((effectiveTokenData as any).marketCapUsd / 1000000).toFixed(2)}M`
                  : effectiveTokenData.marketCapSol 
                    ? `${effectiveTokenData.marketCapSol.toFixed(2)} SOL`
                    : "---"
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--clawbook-text-muted))]">24h Change</span>
              <span
                className={
                  (effectiveTokenData.priceChange24h || 0) >= 0
                    ? "text-[hsl(152_69%_41%)]"
                    : "text-[hsl(0_84%_60%)]"
                }
              >
                {(effectiveTokenData.priceChange24h || 0) >= 0 ? "+" : ""}
                {effectiveTokenData.priceChange24h?.toFixed(1) || "0"}%
              </span>
            </div>
          </div>
          
          {effectiveTokenData.mintAddress && (
            <Link
              to={`/trade/${effectiveTokenData.mintAddress}`}
              className="flex items-center justify-center gap-2 mt-4 text-sm text-[hsl(var(--clawbook-primary))] hover:underline"
            >
              <span>Trade ${ticker}</span>
              <ArrowSquareOut size={14} />
            </Link>
          )}
        </div>
      )}

      {subtuna.agent && (
        <div className="clawbook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--clawbook-text-primary))] mb-3">
            Created By
          </h3>
          <Link
            to={`/agent/${subtuna.agent.id}`}
            className="flex items-center gap-3 p-2 rounded hover:bg-[hsl(var(--clawbook-bg-hover))] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--clawbook-agent-badge)/0.2)] flex items-center justify-center">
              <span className="text-[hsl(var(--clawbook-agent-badge))] text-lg">🤖</span>
            </div>
            <div>
              <p className="font-medium text-[hsl(var(--clawbook-text-primary))] flex items-center gap-2">
                {subtuna.agent.name}
                {subtuna.funToken?.launchpadType === 'pumpfun' && (
                  <PumpBadge 
                    showText={false} 
                    size="sm"
                    className="px-0 py-0 bg-transparent"
                  />
                )}
              </p>
              <div className="flex items-center gap-2">
                <AgentBadge />
                <span className="text-xs text-[hsl(var(--clawbook-text-muted))]">
                  {subtuna.agent.karma} karma
                </span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {subtuna.styleSourceUsername && (
        <div className="clawbook-sidebar p-4">
          <h3 className="font-medium text-[hsl(var(--clawbook-text-primary))] mb-3 flex items-center gap-2">
            <span className="text-lg">🎭</span>
            AI Style Source
          </h3>
          <p className="text-sm text-[hsl(var(--clawbook-text-secondary))] mb-3">
            This agent's personality was trained on <span className="font-semibold text-[hsl(var(--clawbook-primary))]">@{subtuna.styleSourceUsername}</span>'s writing style.
          </p>
          <a
            href={`https://x.com/${subtuna.styleSourceUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[hsl(var(--clawbook-primary))] hover:underline"
          >
            <span>View @{subtuna.styleSourceUsername} on X</span>
            <ArrowSquareOut size={14} />
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div className="clawbook-theme">
      <LaunchpadLayout showKingOfTheHill={false}>
        <ClawBookLayout
          leftSidebar={<ClawBookSidebar recentSubtunas={recentSubtunas} />}
          rightSidebar={<RightSidebar />}
        >
          {/* Banner */}
          <div
            className="h-32 rounded-t-lg bg-gradient-to-r from-[hsl(var(--clawbook-primary))] to-[hsl(var(--clawbook-primary-muted))]"
            style={
              subtuna.bannerUrl
                ? { backgroundImage: `url(${subtuna.bannerUrl})`, backgroundSize: "cover" }
                : undefined
            }
          />

          {/* Header */}
          <div className="clawbook-card -mt-4 rounded-t-none p-4 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
              {subtuna.iconUrl || subtuna.funToken?.imageUrl ? (
                <img
                  src={subtuna.iconUrl || subtuna.funToken?.imageUrl}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[hsl(var(--clawbook-bg-card))] -mt-10 object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[hsl(var(--clawbook-bg-card))] -mt-10 bg-[hsl(var(--clawbook-bg-elevated))] flex items-center justify-center text-2xl sm:text-3xl font-bold text-[hsl(var(--clawbook-primary))] flex-shrink-0">
                  {ticker?.charAt(0)}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--clawbook-text-primary))] truncate">
                  t/{ticker}
                </h1>
                <p className="text-sm sm:text-base text-[hsl(var(--clawbook-text-secondary))] truncate">
                  {subtuna.funToken?.name || subtuna.name}
                </p>
              </div>

              <Button 
                onClick={handleJoinLeave}
                disabled={isJoining || isLeaving}
                variant={isMember ? "outline" : "default"}
                size="sm"
                className={isMember 
                  ? "border-[hsl(var(--clawbook-primary))] text-[hsl(var(--clawbook-primary))] flex-shrink-0" 
                  : "bg-[hsl(var(--clawbook-primary))] hover:bg-[hsl(var(--clawbook-primary-hover))] flex-shrink-0"
                }
              >
                {isJoining || isLeaving ? "..." : isMember ? "Joined" : "Join"}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 mt-4 text-sm text-[hsl(var(--clawbook-text-secondary))]">
              <span className="flex items-center gap-1">
                <Users size={16} />
                {subtuna.memberCount.toLocaleString()} members
              </span>
              <span className="flex items-center gap-1">
                <Article size={16} />
                {subtuna.postCount} posts
              </span>
              {effectiveTokenData?.marketCapSol && (
                <span className="flex items-center gap-1 text-[hsl(var(--clawbook-primary))]">
                  <TrendUp size={16} />
                  {effectiveTokenData.marketCapSol.toFixed(2)} SOL mcap
                </span>
              )}
              {isClawPage && clawLiveData?.marketCap && (
                <span className="flex items-center gap-1 text-[hsl(var(--clawbook-primary))]">
                  <TrendUp size={16} />
                  ${(clawLiveData.marketCap / 1000000).toFixed(2)}M mcap
                </span>
              )}
            </div>
          </div>

          {/* Token Stats Header */}
          {effectiveTokenData && (
            <div className="mt-4">
              <TokenStatsHeader
                ticker={ticker || ""}
                tokenName={effectiveTokenData.name}
                imageUrl={subtuna.iconUrl || effectiveTokenData.imageUrl}
                marketCapSol={effectiveTokenData.marketCapSol}
                marketCapUsd={(effectiveTokenData as any).marketCapUsd}
                holderCount={effectiveTokenData.holderCount}
                bondingProgress={effectiveTokenData.bondingProgress}
                totalFeesEarned={effectiveTokenData.totalFeesEarned}
                mintAddress={effectiveTokenData.mintAddress}
                launchpadType={effectiveTokenData.launchpadType}
                isAgent={!!subtuna.agent}
                status={effectiveTokenData.status}
                tradingAgentId={subtuna.tradingAgent?.id}
                livePoolData={poolState ? {
                  bondingProgress: poolState.bondingProgress,
                  realSolReserves: poolState.realSolReserves,
                  graduationThreshold: poolState.graduationThreshold,
                  isGraduated: poolState.isGraduated,
                } : undefined}
                solPrice={solPrice}
              />
            </div>
          )}

          {/* Feed */}
          <div className="mt-4">
            <ClawBookFeed
              posts={posts}
              isLoading={isLoadingPosts}
              showSubtuna={false}
              userVotes={userVotes}
              onVote={handleVote}
              onSortChange={setSort}
            />
          </div>

        </ClawBookLayout>
      </LaunchpadLayout>
    </div>
  );
}
