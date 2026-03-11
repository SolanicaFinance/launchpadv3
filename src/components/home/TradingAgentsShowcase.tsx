import { Link } from "react-router-dom";
import { Shield, Target, Zap, ArrowRight, Bot } from "lucide-react";
import { useTradingAgents } from "@/hooks/useTradingAgents";

const strategies = [
  {
    id: "conservative",
    name: "Saturn Guard",
    badge: "Conservative",
    badgeColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
    icon: Shield,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    riskLevel: "Low",
    share: "60%",
    profitShareColor: "text-emerald-400",
  },
  {
    id: "balanced",
    name: "Saturn Core",
    badge: "Balanced",
    badgeColor: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    borderColor: "border-amber-500/20 hover:border-amber-500/40",
    icon: Target,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    riskLevel: "Medium",
    share: "55%",
    profitShareColor: "text-amber-400",
  },
  {
    id: "aggressive",
    name: "Saturn Alpha",
    badge: "Aggressive",
    badgeColor: "text-red-400 bg-red-500/15 border-red-500/30",
    borderColor: "border-red-500/20 hover:border-red-500/40",
    icon: Zap,
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    riskLevel: "High",
    share: "50%",
    profitShareColor: "text-red-400",
  },
];

export default function TradingAgentsShowcase() {
  const { data: agents } = useTradingAgents({ status: "active", limit: 50 });

  // Aggregate stats per strategy
  const strategyStats = strategies.map((s) => {
    const matched = (agents || []).filter((a: any) => a.strategy === s.id);
    const winRate = matched.length
      ? (matched.reduce((sum: number, a: any) => sum + (a.win_rate || 0), 0) / matched.length).toFixed(0)
      : "0";
    const totalStaked = matched.reduce((sum: number, a: any) => sum + (a.capital_sol || 0), 0);
    const totalPnl = matched.reduce((sum: number, a: any) => sum + (a.total_profit_sol || 0), 0);
    return { ...s, winRate, totalStaked, totalPnl };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            TRADING AGENTS
            <span className="text-muted-foreground font-normal ml-2 text-sm">— Stake & Earn</span>
          </h2>
        </div>
        <Link
          to="/agents"
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {strategyStats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={`rounded-xl border bg-card/50 p-4 transition-all ${s.borderColor}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${s.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate mb-1">{s.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${s.badgeColor}`}>
                        {s.badge}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Risk: {s.riskLevel}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold font-mono ${s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.totalPnl >= 0 ? "+" : ""}{s.totalPnl.toFixed(3)} SOL
                  </span>
                  <p className="text-[9px] text-muted-foreground">P&L</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[10px] text-muted-foreground">Share</p>
                  <p className={`text-sm font-bold ${s.profitShareColor}`}>{s.share}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[10px] text-muted-foreground">Win Rate</p>
                  <p className="text-sm font-bold text-foreground">{s.winRate}%</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[10px] text-muted-foreground">Staked</p>
                  <p className="text-sm font-bold text-foreground">{s.totalStaked.toFixed(1)}</p>
                </div>
              </div>

              {/* CTA */}
              <Link
                to="/agents"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-xs font-bold transition-colors bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
              >
                <Target className="h-3.5 w-3.5" />
                Stake SOL →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
