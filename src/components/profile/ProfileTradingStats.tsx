import { TradingStats } from "@/hooks/useUserProfile";
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";

interface Props {
  stats: TradingStats;
}

export function ProfileTradingStats({ stats }: Props) {
  const totalTxns = stats.totalBuys + stats.totalSells;
  const pnlPositive = stats.realizedPnl >= 0;
  const maxDistCount = Math.max(...stats.pnlDistribution.map((d) => d.count), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
      {/* Balance Card */}
      <div className="border border-border/30 rounded-lg bg-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Balance</span>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">Total Bought</p>
            <p className="text-sm font-bold font-mono text-foreground">{stats.totalBuySol.toFixed(4)} SOL</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">Total Sold</p>
            <p className="text-sm font-bold font-mono text-foreground">{stats.totalSellSol.toFixed(4)} SOL</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">Unrealized</p>
            <p className="text-xs font-mono text-muted-foreground">—</p>
          </div>
        </div>
      </div>

      {/* Performance Card */}
      <div className="border border-border/30 rounded-lg bg-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <div className={`w-5 h-5 rounded flex items-center justify-center ${pnlPositive ? "bg-green-500/10" : "bg-red-500/10"}`}>
            {pnlPositive ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Performance</span>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">Total PnL</p>
            <p className={`text-sm font-bold font-mono ${pnlPositive ? "text-green-400" : "text-red-400"}`}>
              {pnlPositive ? "+" : ""}{stats.totalPnl.toFixed(4)} SOL
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">Realized PnL</p>
            <p className={`text-sm font-bold font-mono ${pnlPositive ? "text-green-400" : "text-red-400"}`}>
              {pnlPositive ? "+" : ""}{stats.realizedPnl.toFixed(4)} SOL
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-mono uppercase">Total TXNs</p>
            <p className="text-sm font-bold font-mono text-foreground">
              {totalTxns}{" "}
              <span className="text-[10px] font-normal">
                (<span className="text-green-400">{stats.totalBuys} <ArrowUpRight className="w-2.5 h-2.5 inline" /></span>
                {" / "}
                <span className="text-red-400">{stats.totalSells} <ArrowDownRight className="w-2.5 h-2.5 inline" /></span>)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* PnL Distribution Card */}
      <div className="border border-border/30 rounded-lg bg-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center">
            <BarChart3 className="w-3 h-3 text-accent-foreground" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">PnL Distribution</span>
        </div>
        <div className="space-y-1.5">
          {stats.pnlDistribution.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-muted-foreground w-14 text-right shrink-0">{bucket.label}</span>
              <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${bucket.color} rounded-sm transition-all`}
                  style={{ width: `${(bucket.count / maxDistCount) * 100}%`, minWidth: bucket.count > 0 ? "4px" : "0" }}
                />
              </div>
              <span className="text-[9px] font-mono text-foreground/60 w-5 text-right">{bucket.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
