import { useState } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Radar, RefreshCw, AlertTriangle, Activity, Users } from "lucide-react";
import { useKolTweets } from "@/hooks/useKolTweets";
import { useKolScanStatus } from "@/hooks/useKolScanStatus";
import { KolTweetCard } from "@/components/x-tracker/KolTweetCard";
import { AddKolDialog } from "@/components/x-tracker/AddKolDialog";
import { RecentlyAddedKols } from "@/components/x-tracker/RecentlyAddedKols";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

type ChainFilter = "all" | "solana" | "evm";
type TabType = "tweets" | "recently-added";

export default function XTrackerPage() {
  const [chain, setChain] = useState<ChainFilter>("all");
  const [tab, setTab] = useState<TabType>("tweets");
  const { data: tweets, isLoading, refetch, isFetching } = useKolTweets(chain);
  const { latestRun, errors } = useKolScanStatus();
  const [manualRunning, setManualRunning] = useState(false);

  const handleManualScan = async () => {
    setManualRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-kol-tweets");
      console.log("[X Tracker] Manual scan result:", data, error);
    } catch (e) {
      console.error("[X Tracker] Manual scan failed:", e);
    } finally {
      setManualRunning(false);
      refetch();
    }
  };

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
          <div className="flex items-center gap-2">
            <AddKolDialog />
            <button
              onClick={handleManualScan}
              disabled={manualRunning}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {manualRunning ? "Scanning..." : "Run Scan"}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-md hover:bg-secondary transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isFetching && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Scanner Status Panel */}
        {latestRun && (
          <div className="mb-5 p-3 rounded-xl border border-border bg-card/50">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Scanner Status</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="text-muted-foreground">Last Run</div>
                <div className="font-bold text-foreground">
                  {formatDistanceToNow(new Date(latestRun.created_at), { addSuffix: true })}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="text-muted-foreground">Accounts</div>
                <div className="font-bold text-foreground">{latestRun.accounts_scanned}</div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="text-muted-foreground">Tweets</div>
                <div className="font-bold text-foreground">{latestRun.tweets_fetched}</div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="text-muted-foreground">CAs Found</div>
                <div className="font-bold text-foreground">{latestRun.cas_detected}</div>
              </div>
              <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                <div className="text-muted-foreground">Inserted</div>
                <div className="font-bold text-foreground">{latestRun.tweets_inserted}</div>
              </div>
            </div>
            {latestRun.errors_count > 0 && errors.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                  <span className="text-[10px] font-bold text-destructive">{latestRun.errors_count} errors</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {errors.slice(0, 5).map((e) => (
                    <div key={e.id} className="text-[10px] text-muted-foreground">
                      <span className="font-mono text-destructive">@{e.kol_username}</span>: {e.error_message.substring(0, 150)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-5 border-b border-border/30 pb-2">
          <button
            onClick={() => setTab("tweets")}
            className={cn(
              "flex items-center gap-1.5 px-1 pb-2 text-sm font-medium transition-colors border-b-2 -mb-[10px]",
              tab === "tweets"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Radar className="w-3.5 h-3.5" />
            KOL Tweets
          </button>
          <button
            onClick={() => setTab("recently-added")}
            className={cn(
              "flex items-center gap-1.5 px-1 pb-2 text-sm font-medium transition-colors border-b-2 -mb-[10px]",
              tab === "recently-added"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Recently Added KOLs
          </button>
        </div>

        {tab === "tweets" ? (
          <>
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
                      : "bg-transparent text-muted-foreground border-border hover:bg-secondary"
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
                  {latestRun && latestRun.tweets_fetched === 0
                    ? "Scanner is running but no tweets are being extracted — check the status panel above for API response details."
                    : latestRun && latestRun.cas_detected === 0
                      ? "Tweets are being fetched but no contract addresses were detected in recent posts."
                      : "No KOL tweets with contract addresses found yet."
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The scanner runs every 15 minutes. Use "Run Scan" to trigger manually.
                </p>
              </div>
            )}
          </>
        ) : (
          <RecentlyAddedKols />
        )}
      </div>
    </LaunchpadLayout>
  );
}
