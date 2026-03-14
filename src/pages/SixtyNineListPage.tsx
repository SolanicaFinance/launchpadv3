import { useState } from "react";
import { Crown, Trophy, TrendingUp, Shield, Gem, ExternalLink, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { SATURN_TOKEN_CA } from "@/hooks/useSaturnTokenData";

interface HolderEntry {
  rank: number;
  address: string;
  tokenAmount: number;
  percentage: number;
  solBalance: number;
}

function useTop69Holders() {
  return useQuery({
    queryKey: ["top-69-holders", SATURN_TOKEN_CA],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-token-holders", {
        body: { mintAddress: SATURN_TOKEN_CA },
      });
      if (error) throw error;
      // Take top 69 holders (the edge function already returns top 100 sorted)
      const holders = (data.holders || []).slice(0, 69);
      return {
        holders,
        totalSupply: data.totalSupply,
        count: data.count,
        lastUpdated: new Date().toISOString(),
      };
    },
    staleTime: 1000 * 60 * 55, // ~55 min (refreshes every hour)
    refetchInterval: 1000 * 60 * 60, // 1 hour
  });
}

function shortenAddress(addr: string) {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function formatTokenAmount(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

function getRankStyle(rank: number) {
  if (rank === 1) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]";
  if (rank === 2) return "text-gray-300 drop-shadow-[0_0_6px_rgba(209,213,219,0.4)]";
  if (rank === 3) return "text-amber-600 drop-shadow-[0_0_6px_rgba(217,119,6,0.4)]";
  if (rank <= 10) return "text-emerald-400";
  return "text-muted-foreground";
}

function getRankBg(rank: number) {
  if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30";
  if (rank === 2) return "bg-gray-400/10 border-gray-400/20";
  if (rank === 3) return "bg-amber-600/10 border-amber-600/20";
  if (rank <= 10) return "bg-emerald-500/5 border-emerald-500/15";
  return "bg-card/50 border-border/30";
}

export default function SixtyNineListPage() {
  const { data, isLoading, refetch, isFetching } = useTop69Holders();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--primary)) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(72 100% 50%) 0%, transparent 40%)",
        }} />
        
        <div className="relative max-w-5xl mx-auto px-4 pt-10 pb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="h-10 w-10 text-[hsl(72_100%_50%)] drop-shadow-[0_0_16px_hsl(72_100%_50%/0.6)]" strokeWidth={2.5} />
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              69 <span className="text-[hsl(72_100%_50%)]">Under</span> 69
            </h1>
            <Crown className="h-10 w-10 text-[hsl(72_100%_50%)] drop-shadow-[0_0_16px_hsl(72_100%_50%/0.6)]" strokeWidth={2.5} />
          </div>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed">
            The <span className="text-foreground font-semibold">Saturn List</span> — inspired by Forbes' iconic 30 Under 30.
            <br className="hidden sm:block" />
            {" "}We're rewriting wealth for the onchain generation.
          </p>

          {/* Mission Card */}
          <div className="max-w-3xl mx-auto bg-card/60 backdrop-blur-sm border border-border/40 rounded-lg p-5 sm:p-6 text-left mb-6">
            <div className="flex items-start gap-3 mb-3">
              <Gem className="h-5 w-5 text-[hsl(72_100%_50%)] mt-0.5 flex-shrink-0" />
              <h2 className="font-bold text-foreground text-base sm:text-lg">The Mission Is Simple</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Forbes celebrates founders who build empires before 30. <strong className="text-foreground">Saturn's 69 Under 69</strong> celebrates 
              holders who believe in the ecosystem. Hold <span className="text-[hsl(72_100%_50%)] font-semibold">$SATURN</span>, don't sell, 
              and climb the list to earn <strong className="text-foreground">lifetime passive income</strong> from every token launched on our platform.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-background/60 rounded-md p-3 border border-border/20">
                <div className="text-[hsl(72_100%_50%)] font-black text-xl">69%</div>
                <div className="text-xs text-muted-foreground mt-0.5">of platform fees distributed</div>
              </div>
              <div className="bg-background/60 rounded-md p-3 border border-border/20">
                <div className="text-[hsl(72_100%_50%)] font-black text-xl">1%</div>
                <div className="text-xs text-muted-foreground mt-0.5">fee on every swap</div>
              </div>
              <div className="bg-background/60 rounded-md p-3 border border-border/20">
                <div className="text-[hsl(72_100%_50%)] font-black text-xl">69 SOL</div>
                <div className="text-xs text-muted-foreground mt-0.5">weekly diamond-hand bonus</div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="max-w-3xl mx-auto bg-card/40 border border-border/30 rounded-lg p-5 text-left mb-8">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-[hsl(72_100%_50%)]" />
              How It Works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-[hsl(72_100%_50%)] font-bold mt-px">01</span>
                <span>Top 69 holders scanned every hour (LP wallets excluded)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[hsl(72_100%_50%)] font-bold mt-px">02</span>
                <span>69% of the 1% platform swap fee → split evenly among top 69</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[hsl(72_100%_50%)] font-bold mt-px">03</span>
                <span>Diamond hands who don't sell earn a 69 SOL weekly bonus chance</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[hsl(72_100%_50%)] font-bold mt-px">04</span>
                <span>Lifetime earnings — hold your rank and earn forever</span>
              </div>
            </div>
          </div>

          {/* Refresh info */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
            <span>
              {data?.lastUpdated
                ? `Last scan: ${new Date(data.lastUpdated).toLocaleTimeString()} · Next in ~1h`
                : "Scanning holders..."}
            </span>
            <button onClick={() => refetch()} className="text-[hsl(72_100%_50%)] hover:underline ml-1 font-medium">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Holder List */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[hsl(72_100%_50%)]" />
            The List
          </h2>
          <span className="text-xs text-muted-foreground">
            {data?.count ? `${data.count.toLocaleString()} total holders` : ""}
          </span>
        </div>

        {/* Top 3 Podium */}
        {!isLoading && data?.holders && data.holders.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            {[1, 0, 2].map((idx) => {
              const h = data.holders[idx];
              if (!h) return null;
              const rank = idx + 1;
              const isFirst = rank === 1;
              return (
                <div
                  key={h.address}
                  className={`relative rounded-lg border p-3 sm:p-4 text-center transition-all ${getRankBg(rank)} ${isFirst ? "sm:-mt-2 sm:scale-105" : ""}`}
                >
                  <div className={`text-2xl sm:text-3xl font-black mb-1 ${getRankStyle(rank)}`}>
                    {rank === 1 && <Crown className="h-5 w-5 mx-auto mb-1 text-yellow-400" />}
                    #{rank}
                  </div>
                  <a
                    href={`https://solscan.io/account/${h.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {shortenAddress(h.address)}
                  </a>
                  <div className="text-[hsl(72_100%_50%)] font-bold text-sm sm:text-base mt-2">
                    {formatTokenAmount(h.tokenAmount)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{h.percentage.toFixed(2)}% supply</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rest of the list */}
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_100px_80px_60px] sm:grid-cols-[50px_1fr_120px_100px_80px] gap-2 px-3 py-2 text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <span>Rank</span>
            <span>Address</span>
            <span className="text-right">$SATURN</span>
            <span className="text-right">% Supply</span>
            <span className="text-right">SOL</span>
          </div>

          {isLoading ? (
            Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5">
                <Skeleton className="h-5 w-full" />
              </div>
            ))
          ) : (
            data?.holders?.slice(3).map((h: HolderEntry, i: number) => {
              const rank = i + 4;
              return (
                <div
                  key={h.address}
                  className={`grid grid-cols-[40px_1fr_100px_80px_60px] sm:grid-cols-[50px_1fr_120px_100px_80px] gap-2 px-3 py-2 rounded-md border transition-all hover:bg-surface-hover/50 ${getRankBg(rank)}`}
                >
                  <span className={`font-bold text-sm ${getRankStyle(rank)}`}>#{rank}</span>
                  <a
                    href={`https://solscan.io/account/${h.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                  >
                    {shortenAddress(h.address)}
                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-40" />
                  </a>
                  <span className="text-right text-xs font-semibold text-foreground">
                    {formatTokenAmount(h.tokenAmount)}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {h.percentage.toFixed(2)}%
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {h.solBalance.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center bg-card/40 border border-border/30 rounded-lg p-6">
          <Crown className="h-8 w-8 text-[hsl(72_100%_50%)] mx-auto mb-3 drop-shadow-[0_0_12px_hsl(72_100%_50%/0.5)]" />
          <h3 className="font-bold text-foreground text-lg mb-2">Want to join the list?</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Buy <span className="text-[hsl(72_100%_50%)] font-semibold">$SATURN</span> and hold. 
            The higher your rank, the more you earn. Diamond hands get rewarded.
          </p>
          <a
            href={`/trade/${SATURN_TOKEN_CA}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-bold text-sm bg-[hsl(72_100%_50%)] text-black hover:bg-[hsl(72_100%_60%)] transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            Buy $SATURN
          </a>
        </div>
      </div>
    </div>
  );
}

