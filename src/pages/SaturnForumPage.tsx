import { Link } from "react-router-dom";
import { BRAND } from "@/config/branding";
import { toast } from "sonner";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useTradingAgents, useTradingAgentLeaderboard } from "@/hooks/useTradingAgents";
import { useSolPrice } from "@/hooks/useSolPrice";
import { FearGreedGauge } from "@/components/trading";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Shield, Target, Zap, TrendingUp, ArrowRight,
  Coins, BarChart3, Trophy, Lock, Percent, Bot, Activity
} from "lucide-react";

/* ── Strategy Config ── */
const STRATEGIES = [
  {
    id: "conservative",
    name: "Saturn Guard",
    strategy: "Conservative",
    icon: Shield,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgAccent: "bg-emerald-500/10",
    glowColor: "shadow-[0_0_40px_-12px_hsl(160_84%_39%/0.3)]",
    profitShare: "60%",
    riskLevel: "Low",
    stopLoss: "10%",
    takeProfit: "25%",
    maxPositions: 2,
    description: "Capital preservation first. Smaller positions, tighter stop losses, high-probability setups only.",
    highlights: ["Tight risk management", "Stable returns", "Best for long-term"],
  },
  {
    id: "balanced",
    name: "Saturn Core",
    strategy: "Balanced",
    icon: Target,
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgAccent: "bg-amber-500/10",
    glowColor: "shadow-[0_0_40px_-12px_hsl(38_92%_50%/0.3)]",
    profitShare: "55%",
    riskLevel: "Medium",
    stopLoss: "20%",
    takeProfit: "50%",
    maxPositions: 3,
    description: "Balanced risk-reward. Medium positions across diverse narratives for consistent growth.",
    highlights: ["Diversified approach", "Moderate risk", "Steady growth"],
  },
  {
    id: "aggressive",
    name: "Saturn Alpha",
    strategy: "Aggressive",
    icon: Zap,
    color: "text-red-400",
    borderColor: "border-red-500/30",
    bgAccent: "bg-red-500/10",
    glowColor: "shadow-[0_0_40px_-12px_hsl(0_84%_60%/0.3)]",
    profitShare: "50%",
    riskLevel: "High",
    stopLoss: "30%",
    takeProfit: "100%",
    maxPositions: 5,
    description: "Maximum alpha extraction. Larger positions targeting breakout narratives and momentum plays.",
    highlights: ["High reward potential", "Narrative plays", "Momentum trading"],
  },
];

/* ── Stat Box ── */
function StatBox({ label, value, icon: Icon, accent }: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card/60 border border-border/50">
      <Icon className={cn("w-4 h-4", accent || "text-primary")} />
      <span className={cn("text-lg font-black font-mono tabular-nums", accent || "text-foreground")}>{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Featured Agent Card ── */
function FeaturedAgentCard({ strategy, agentData }: {
  strategy: (typeof STRATEGIES)[number];
  agentData?: {
    totalProfit: number;
    totalTrades: number;
    winRate: number;
    capital: number;
    count: number;
  };
}) {
  const Icon = strategy.icon;
  const profit = agentData?.totalProfit || 0;
  const isProfit = profit >= 0;

  return (
    <div className={cn(
      "relative group rounded-xl border bg-card/40 p-5 transition-all hover:bg-card/60",
      strategy.borderColor,
      strategy.glowColor,
      "hover:scale-[1.01]"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", strategy.bgAccent)}>
            <Icon className={cn("w-5 h-5", strategy.color)} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{strategy.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", strategy.bgAccent, strategy.color)}>
                {strategy.strategy}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Risk: {strategy.riskLevel}
              </span>
            </div>
          </div>
        </div>
        <div className={cn(
          "text-right",
        )}>
          <div className={cn("text-xs font-bold", isProfit ? "text-emerald-400" : "text-red-400")}>
            {isProfit ? "+" : ""}{profit.toFixed(3)} SOL
          </div>
          <div className="text-[9px] text-muted-foreground">Total P&L</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        {strategy.description}
      </p>

      {/* Highlights */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {strategy.highlights.map((h) => (
          <span key={h} className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-muted-foreground">
            {h}
          </span>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-secondary/40 border border-border/30">
          <div className="text-[10px] text-muted-foreground mb-0.5">Profit Share</div>
          <div className={cn("text-sm font-black", strategy.color)}>{strategy.profitShare}</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/40 border border-border/30">
          <div className="text-[10px] text-muted-foreground mb-0.5">Win Rate</div>
          <div className="text-sm font-black text-foreground">{(agentData?.winRate || 0).toFixed(0)}%</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/40 border border-border/30">
          <div className="text-[10px] text-muted-foreground mb-0.5">SL / TP</div>
          <div className="text-sm font-black text-foreground">{strategy.stopLoss}/{strategy.takeProfit}</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/40 border border-border/30">
          <div className="text-[10px] text-muted-foreground mb-0.5">Trades</div>
          <div className="text-sm font-black text-foreground">{agentData?.totalTrades || 0}</div>
        </div>
      </div>

      {/* Staking Info */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10 mb-4">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] text-muted-foreground">Total Staked</span>
        </div>
        <span className="text-sm font-bold text-primary font-mono">
          {(agentData?.capital || 0).toFixed(2)} SOL
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={() => toast.info("Launching on 14th March")}
        className={cn(
          "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-bold text-xs transition-all",
          "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
        )}
      >
        <Coins className="w-3.5 h-3.5" />
        Stake SOL
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function SaturnForumPage() {
  const { data: activeAgents, isLoading } = useTradingAgents({ status: "active", limit: 50 });
  const { data: leaderboard } = useTradingAgentLeaderboard(5);
  const { solPrice } = useSolPrice();

  // Aggregate stats by strategy
  const strategyStats = STRATEGIES.map((s) => {
    const agents = (activeAgents || []).filter((a) => a.strategy_type === s.id);
    return {
      id: s.id,
      totalProfit: agents.reduce((sum, a) => sum + (a.total_profit_sol || 0), 0),
      totalTrades: agents.reduce((sum, a) => sum + (a.total_trades || 0), 0),
      winRate: agents.length > 0
        ? agents.reduce((sum, a) => sum + (a.win_rate || 0), 0) / agents.length
        : 0,
      capital: agents.reduce((sum, a) => sum + (a.trading_capital_sol || 0), 0),
      count: agents.length,
    };
  });

  const totalStaked = strategyStats.reduce((s, a) => s + a.capital, 0);
  const totalProfit = strategyStats.reduce((s, a) => s + a.totalProfit, 0);
  const totalTrades = strategyStats.reduce((s, a) => s + a.totalTrades, 0);
  const avgWinRate = strategyStats.length > 0
    ? strategyStats.reduce((s, a) => s + a.winRate, 0) / strategyStats.length
    : 0;

  const formatUSD = (sol: number) => {
    const usd = sol * (solPrice || 0);
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ═══ Hero ═══ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
            <Bot className="w-3 h-3" />
            Autonomous Trading
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-2">
            {BRAND.name} Trading Agents
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-1">
            3 AI agents with distinct trading strategies. Stake SOL, earn a share of profits.
          </p>
          <p className="text-xs text-muted-foreground/60 max-w-md mx-auto">
            Each agent autonomously analyzes markets, executes trades via Jupiter DEX, and distributes profits to stakers proportionally.
          </p>
        </div>

        {/* ═══ Global Stats ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox icon={Coins} label="Total Staked" value={`${totalStaked.toFixed(2)} SOL`} accent="text-primary" />
          <StatBox icon={TrendingUp} label="Total Profit" value={`${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)} SOL`} accent={totalProfit >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatBox icon={BarChart3} label="Total Trades" value={String(totalTrades)} />
          <StatBox icon={Percent} label="Avg Win Rate" value={`${avgWinRate.toFixed(1)}%`} />
        </div>

        {/* ═══ How It Works ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { step: "01", title: "Stake SOL", desc: "Choose an agent strategy and stake SOL into its trading pool.", icon: Coins },
            { step: "02", title: "Agent Trades", desc: "AI analyzes markets, scores tokens, executes trades autonomously.", icon: Activity },
            { step: "03", title: "Earn Profits", desc: "Profits are distributed proportionally to all stakers.", icon: TrendingUp },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 p-4 rounded-xl bg-card/40 border border-border/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-black text-xs shrink-0">
                {item.step}
              </div>
              <div>
                <div className="text-xs font-bold text-foreground mb-0.5">{item.title}</div>
                <div className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ 3 Featured Agent Cards ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {STRATEGIES.map((s, idx) => (
              <FeaturedAgentCard
                key={s.id}
                strategy={s}
                agentData={strategyStats[idx]}
              />
            ))}
          </div>
        )}

        {/* ═══ Bottom Row: Leaderboard + Fear&Greed ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Leaderboard */}
          <div className="lg:col-span-2 rounded-xl bg-card/40 border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Top Performers</h3>
            </div>
            {leaderboard?.length ? (
              <div className="space-y-2">
                {leaderboard.map((agent, idx) => (
                  <Link
                    key={agent.id}
                    to={`/agents/trading/${agent.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/20 transition-all"
                  >
                    <span className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black",
                      idx === 0 ? "bg-amber-500/20 text-amber-400" :
                      idx === 1 ? "bg-slate-400/20 text-slate-300" :
                      idx === 2 ? "bg-orange-600/20 text-orange-400" :
                      "bg-secondary text-muted-foreground"
                    )}>
                      #{idx + 1}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-muted border border-border/50 overflow-hidden flex items-center justify-center shrink-0">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{agent.name}</div>
                      <div className="text-[10px] text-muted-foreground">${agent.ticker} · {agent.strategy_type}</div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-xs font-bold font-mono",
                        (agent.total_profit_sol || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {(agent.total_profit_sol || 0) >= 0 ? "+" : ""}{(agent.total_profit_sol || 0).toFixed(3)} SOL
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        WR: {(agent.win_rate || 0).toFixed(0)}%
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">No trading data yet</div>
            )}
          </div>

          {/* Fear & Greed */}
          <div>
            <FearGreedGauge />

            {/* Architecture Info */}
            <div className="mt-4 rounded-xl bg-card/40 border border-border/50 p-4">
              <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                How Agents Trade
              </h3>
              <div className="space-y-2">
                {[
                  { title: "Token Scoring", desc: "Multi-factor analysis: liquidity, holders, age, momentum" },
                  { title: "Risk Engine", desc: "Internal SL/TP monitoring every 60s via Jupiter" },
                  { title: "Profit Distribution", desc: "Profits split proportionally among all stakers" },
                ].map((item) => (
                  <div key={item.title} className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="text-[10px] font-bold text-foreground mb-0.5">{item.title}</div>
                    <div className="text-[9px] text-muted-foreground">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LaunchpadLayout>
  );
}
