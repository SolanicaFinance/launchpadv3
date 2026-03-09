import { useState } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Radar, RefreshCw } from "lucide-react";
import { useKolTweets } from "@/hooks/useKolTweets";
import { KolTweetCard } from "@/components/x-tracker/KolTweetCard";
import { cn } from "@/lib/utils";

type ChainFilter = "all" | "solana" | "evm";

export default function XTrackerPage() {
  const [chain, setChain] = useState<ChainFilter>("all");
  const { data: tweets, isLoading, refetch, isFetching } = useKolTweets(chain);

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-7xl mx-auto px-4 py-6 pb-20">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Radar className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-foreground">X Tracker</h1>
                <p className="text-xs text-muted-foreground">
                  Live KOL tweets with contract addresses
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-md hover:bg-surface-hover transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isFetching && "animate-spin")} />
            </button>
          </div>

          {/* Chain filter */}
          <div className="flex items-center gap-2 mb-5">
            {(["all", "solana", "evm"] as ChainFilter[]).map((c) => (
              <button
                key={c}
                onClick={() => setChain(c)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  chain === c
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-transparent text-muted-foreground border-border hover:bg-surface-hover"
                )}
              >
                {c === "all" ? "All Chains" : c === "solana" ? "Solana" : "EVM"}
              </button>
            ))}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-[14px] bg-card border border-border animate-pulse"
                />
              ))}
            </div>
          ) : tweets && tweets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tweets.map((t) => (
                <KolTweetCard key={t.id} tweet={t} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No KOL tweets with contract addresses found yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The scanner runs every 5 minutes — check back soon.
              </p>
            </div>
          )}
        </div>
    </LaunchpadLayout>
  );
}
