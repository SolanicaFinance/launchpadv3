import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Shield, Target, Zap, ArrowRight, Bot } from "lucide-react";
import { useTradingAgents } from "@/hooks/useTradingAgents";
import { cn } from "@/lib/utils";

const strategies = [
  {
    id: "conservative",
    name: "MoonDexo Guard",
    badge: "Conservative",
    badgeColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
    glowColor: "hover:shadow-[0_0_30px_hsl(160_84%_39%/0.12)]",
    gradientFrom: "from-emerald-500/5",
    icon: Shield,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    riskLevel: "Low",
    share: "60%",
    profitShareColor: "text-emerald-400",
  },
  {
    id: "balanced",
    name: "MoonDexo Core",
    badge: "Balanced",
    badgeColor: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    borderColor: "border-amber-500/20 hover:border-amber-500/40",
    glowColor: "hover:shadow-[0_0_30px_hsl(38_92%_50%/0.12)]",
    gradientFrom: "from-amber-500/5",
    icon: Target,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    riskLevel: "Medium",
    share: "55%",
    profitShareColor: "text-amber-400",
  },
  {
    id: "aggressive",
    name: "MoonDexo Alpha",
    badge: "Aggressive",
    badgeColor: "text-red-400 bg-red-500/15 border-red-500/30",
    borderColor: "border-red-500/20 hover:border-red-500/40",
    glowColor: "hover:shadow-[0_0_30px_hsl(0_62%_50%/0.12)]",
    gradientFrom: "from-red-500/5",
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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
            TRADING AGENTS
            <span className="text-muted-foreground font-normal ml-2 text-xs normal-case tracking-normal">— Stake & Earn</span>
          </h2>
        </div>
        <Link
          to="/agents"
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-semibold
                     px-3 py-1.5 rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        >
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {strategyStats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={cn(
                "group relative rounded-xl border backdrop-blur-sm p-5 transition-all duration-300 h-full flex flex-col",
                "bg-gradient-to-b to-card/40 hover:scale-[1.02]",
                s.gradientFrom,
                s.borderColor,
                s.glowColor,
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110", s.iconBg)}>
                    <Icon className={cn("h-5 w-5", s.iconColor)} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate mb-1">{s.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap", s.badgeColor)}>
                        {s.badge}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Risk: {s.riskLevel}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn("text-xs font-bold font-mono", s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {s.totalPnl >= 0 ? "+" : ""}{s.totalPnl.toFixed(3)} SOL
                  </span>
                  <p className="text-[9px] text-muted-foreground">P&L</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Share", value: s.share, color: s.profitShareColor },
                  { label: "Win Rate", value: `${s.winRate}%`, color: "text-foreground" },
                  { label: "Staked", value: s.totalStaked.toFixed(1), color: "text-foreground" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-2 rounded-lg bg-background/40 border border-border/20">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{stat.label}</p>
                    <p className={cn("text-sm font-bold font-mono", stat.color)}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => toast.info("Launching on 14th March")}
                className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-xs font-bold transition-all duration-300
                           bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40
                           hover:shadow-[0_0_16px_hsl(var(--primary)/0.15)]"
              >
                <Target className="h-3.5 w-3.5" />
                Stake SOL →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
