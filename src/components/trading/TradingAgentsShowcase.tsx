import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTradingAgents } from "@/hooks/useTradingAgents";
import { Shield, Target, Zap, Coins, ArrowRight, Lock, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  {
    id: "conservative",
    name: "MoonDexo Guard",
    strategy: "Conservative",
    icon: Shield,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgAccent: "bg-emerald-500/10",
    profitShare: "60%",
    riskLevel: "Low",
  },
  {
    id: "balanced",
    name: "MoonDexo Core",
    strategy: "Balanced",
    icon: Target,
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgAccent: "bg-amber-500/10",
    profitShare: "55%",
    riskLevel: "Medium",
  },
  {
    id: "aggressive",
    name: "MoonDexo Alpha",
    strategy: "Aggressive",
    icon: Zap,
    color: "text-red-400",
    borderColor: "border-red-500/30",
    bgAccent: "bg-red-500/10",
    profitShare: "50%",
    riskLevel: "High",
  },
];

export function TradingAgentsShowcase() {
  const { data: activeAgents } = useTradingAgents({ status: "active", limit: 50 });

  const strategyStats = STRATEGIES.map((s) => {
    const agents = (activeAgents || []).filter((a) => a.strategy_type === s.id);
    return {
      totalProfit: agents.reduce((sum, a) => sum + (a.total_profit_sol || 0), 0),
      capital: agents.reduce((sum, a) => sum + (a.trading_capital_sol || 0), 0),
      winRate: agents.length > 0
        ? agents.reduce((sum, a) => sum + (a.win_rate || 0), 0) / agents.length
        : 0,
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Trading Agents
          </span>
          <span className="text-[10px] text-muted-foreground/50">— Stake & Earn</span>
        </div>
        <Link to="/agents" className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {STRATEGIES.map((s, idx) => {
          const Icon = s.icon;
          const stats = strategyStats[idx];
          const profit = stats.totalProfit;
          const isProfit = profit >= 0;

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-card/40 p-3 transition-all hover:bg-card/60",
                s.borderColor
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", s.bgAccent)}>
                  <Icon className={cn("w-3.5 h-3.5", s.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-foreground truncate">{s.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[9px] font-bold px-1 py-px rounded", s.bgAccent, s.color)}>
                      {s.strategy}
                    </span>
                    <span className="text-[9px] text-muted-foreground">Risk: {s.riskLevel}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-[10px] font-bold font-mono", isProfit ? "text-emerald-400" : "text-red-400")}>
                    {isProfit ? "+" : ""}{profit.toFixed(3)} SOL
                  </div>
                  <div className="text-[8px] text-muted-foreground">P&L</div>
                </div>
              </div>

              {/* Mini stats */}
              <div className="flex items-center gap-2 mb-2 text-[9px]">
                <div className="flex-1 text-center p-1 rounded bg-secondary/40 border border-border/30">
                  <div className="text-muted-foreground">Share</div>
                  <div className={cn("font-bold", s.color)}>{s.profitShare}</div>
                </div>
                <div className="flex-1 text-center p-1 rounded bg-secondary/40 border border-border/30">
                  <div className="text-muted-foreground">Win Rate</div>
                  <div className="font-bold text-foreground">{stats.winRate.toFixed(0)}%</div>
                </div>
                <div className="flex-1 text-center p-1 rounded bg-secondary/40 border border-border/30">
                  <div className="text-muted-foreground">Staked</div>
                  <div className="font-bold text-foreground">{stats.capital.toFixed(1)}</div>
                </div>
              </div>

              {/* Stake CTA */}
              <button
                onClick={() => toast.info("Launching on 14th March")}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg font-bold text-[10px] transition-all bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
              >
                <Coins className="w-3 h-3" />
                Stake SOL
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
