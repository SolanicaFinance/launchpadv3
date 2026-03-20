import { getProgress, getCurrentPrice, getMarketCap, isKingOfTheHill, type LabPool } from "@/lib/saturn-curve";
import { Crown, Users, TrendingUp, BarChart3, Clock, Lock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Props {
  pools: LabPool[];
}

export function LabPoolState({ pools }: Props) {
  if (pools.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No pools created yet. Go to the Create Pool tab to launch one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pools.map((pool) => (
        <PoolCard key={pool.id} pool={pool} />
      ))}
    </div>
  );
}

function PoolCard({ pool }: { pool: LabPool }) {
  const progress = getProgress(pool);
  const price = getCurrentPrice(pool);
  const mcap = getMarketCap(pool);
  const koth = isKingOfTheHill(pool);
  const isGraduated = pool.status === "graduated";

  const timeAgo = getTimeAgo(pool.created_at);

  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {pool.image_url ? (
            <img src={pool.image_url} alt={pool.name} className="w-10 h-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {pool.ticker.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{pool.name}</h3>
              <span className="text-xs text-muted-foreground font-mono">${pool.ticker}</span>
              {koth && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400">
                  <Crown className="h-3 w-3" /> KOTH
                </span>
              )}
              {isGraduated && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">
                  GRADUATED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {timeAgo}
              {pool.lp_locked && (
                <span className="flex items-center gap-0.5 text-green-400">
                  <Lock className="h-3 w-3" /> LP Locked
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={cn(
          "px-2 py-1 rounded text-[10px] font-medium",
          isGraduated ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary"
        )}>
          {isGraduated ? "Graduated" : "Active"}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Bonding Progress</span>
          <span className="text-foreground font-mono">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{pool.real_sol_reserves.toFixed(4)} SOL raised</span>
          <span>{pool.graduation_threshold_sol} SOL target</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={TrendingUp} label="Price" value={`${price.toFixed(10)} SOL`} />
        <MetricCard icon={Coins} label="Market Cap" value={`${mcap.toFixed(2)} SOL`} />
        <MetricCard icon={BarChart3} label="Volume" value={`${pool.volume_total_sol.toFixed(4)} SOL`} />
        <MetricCard icon={Users} label="Holders" value={pool.holder_count.toString()} />
      </div>

      {/* Reserves */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded bg-muted/50 space-y-1">
          <div className="text-[10px] text-muted-foreground font-medium">Virtual Reserves</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SOL</span>
            <span className="font-mono text-foreground">{pool.virtual_sol_reserves}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-mono text-foreground">{(pool.virtual_token_reserves / 1e6).toFixed(0)}M</span>
          </div>
        </div>
        <div className="p-3 rounded bg-muted/50 space-y-1">
          <div className="text-[10px] text-muted-foreground font-medium">Real Reserves</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SOL</span>
            <span className="font-mono text-foreground">{pool.real_sol_reserves.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-mono text-foreground">{(pool.real_token_reserves / 1e6).toFixed(0)}M</span>
          </div>
        </div>
      </div>

      {/* LP Lock Info (post-graduation) */}
      {isGraduated && (
        <div className="p-3 rounded bg-green-500/5 border border-green-500/20 space-y-1 text-xs">
          <div className="font-medium text-green-400 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Post-Graduation Info
          </div>
          {pool.damm_pool_address && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">DAMM V2 Pool</span>
              <span className="font-mono text-foreground">{pool.damm_pool_address.slice(0, 8)}...</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">LP Status</span>
            <span className={cn("font-medium", pool.lp_locked ? "text-green-400" : "text-yellow-400")}>
              {pool.lp_locked ? "100% Locked Forever" : "Pending Lock"}
            </span>
          </div>
          {pool.lp_lock_tx && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lock TX</span>
              <span className="font-mono text-foreground">{pool.lp_lock_tx.slice(0, 8)}...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-muted/50 space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xs font-mono text-foreground truncate">{value}</div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
