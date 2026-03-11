import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, Target, Zap, Bot, Wallet, TrendingUp } from "lucide-react";
import { useSaturnTradingAgents, useSaturnTradingAgentLeaderboard } from "@/hooks/useSaturnTradingAgents";
import { TradingAgentCard, TradingAgentCardSkeleton, FearGreedGauge } from "@/components/trading";

export function SaturnTradingSection() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<"active" | "funding" | "top">("active");

  const { data: agents, isLoading } = useSaturnTradingAgents({
    status: "active",
    strategy: selectedStrategy,
    limit: 12,
  });

  const { data: pendingAgents, isLoading: pendingLoading } = useSaturnTradingAgents({
    status: "pending",
    limit: 12,
  });

  const { data: leaderboard } = useSaturnTradingAgentLeaderboard(5);

  const strategies = [
    {
      id: "conservative",
      name: "Conservative",
      icon: Shield,
      color: "hsl(142, 71%, 45%)",
      bgColor: "hsl(142, 71%, 45%, 0.1)",
      borderColor: "hsl(142, 71%, 45%, 0.3)",
      stopLoss: "10%",
      takeProfit: "25%",
      positions: "2 max",
      description: "Lower risk, steady gains. Best for accumulating capital safely.",
    },
    {
      id: "balanced",
      name: "Balanced",
      icon: Target,
      color: "hsl(38, 92%, 50%)",
      bgColor: "hsl(38, 92%, 50%, 0.1)",
      borderColor: "hsl(38, 92%, 50%, 0.3)",
      stopLoss: "20%",
      takeProfit: "50%",
      positions: "3 max",
      description: "Moderate risk-reward. Ideal balance of growth and protection.",
    },
    {
      id: "aggressive",
      name: "Aggressive",
      icon: Zap,
      color: "hsl(var(--saturn-primary))",
      bgColor: "hsl(var(--saturn-primary) / 0.1)",
      borderColor: "hsl(var(--saturn-primary) / 0.3)",
      stopLoss: "30%",
      takeProfit: "100%",
      positions: "5 max",
      description: "High risk, high reward. For those seeking maximum gains. 🪐",
    },
  ];

  const tabs = [
    { id: "active" as const, label: "🪐 Active" },
    { id: "funding" as const, label: "💰 Funding", count: pendingAgents?.length },
    { id: "top" as const, label: "🏆 Top Performers" },
  ];

  const renderAgents = () => {
    if (activeTab === "active") {
      if (isLoading) return Array.from({ length: 6 }).map((_, i) => <TradingAgentCardSkeleton key={i} />);
      if (!agents?.length) return (
        <div className="col-span-2 text-center py-12" style={{ color: "hsl(var(--saturn-muted))" }}>
          <div className="text-3xl mb-2">🪐</div>
          No active trading agents found
        </div>
      );
      return agents.map((a) => <TradingAgentCard key={a.id} agent={a} />);
    }
    if (activeTab === "funding") {
      if (pendingLoading) return Array.from({ length: 4 }).map((_, i) => <TradingAgentCardSkeleton key={i} />);
      if (!pendingAgents?.length) return (
        <div className="col-span-2 text-center py-12" style={{ color: "hsl(var(--saturn-muted))" }}>
          <div className="text-3xl mb-2">🪐</div>
          No agents currently in funding phase
        </div>
      );
      return pendingAgents.map((a) => <TradingAgentCard key={a.id} agent={a} />);
    }
    if (activeTab === "top") {
      return leaderboard?.map((a, i) => <TradingAgentCard key={a.id} agent={a as any} rank={i + 1} />);
    }
    return null;
  };

  return (
    <section className="mb-12">
      <h2 className="saturn-section-title mb-6 flex items-center gap-3">
        <span className="saturn-gradient-text">🪐 Trading Agents</span>
      </h2>

      {/* Hero text */}
      <div className="text-center mb-8">
        <p className="text-base max-w-2xl mx-auto mb-4" style={{ color: "hsl(var(--saturn-muted))" }}>
          Autonomous AI agents that execute trades using machine learning models.
          Each agent analyzes market data, manages risk with internal SL/TP systems,
          and continuously learns from trade outcomes. 🪐
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          <div className="saturn-badge">
            <span className="font-medium" style={{ color: "hsl(var(--saturn-text))" }}>AI Scoring</span> — 0-100 token analysis
          </div>
          <div className="saturn-badge">
            <span className="font-medium" style={{ color: "hsl(var(--saturn-text))" }}>Jupiter DEX</span> — Execution layer
          </div>
          <div className="saturn-badge">
            <span className="font-medium" style={{ color: "hsl(var(--saturn-text))" }}>Internal SL/TP</span> — Risk management
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Agents", value: agents?.length || 0, variant: "red" },
          { label: "Total Profit (SOL)", value: agents?.reduce((s, a) => s + (a.total_profit_sol || 0), 0).toFixed(2) || "0", variant: "teal" },
          { label: "Total Trades", value: agents?.reduce((s, a) => s + (a.total_trades || 0), 0) || 0, variant: "red" },
          { label: "Avg Win Rate", value: `${agents?.length ? (agents.reduce((s, a) => s + (a.win_rate || 0), 0) / agents.length).toFixed(1) : "0"}%`, variant: "teal" },
        ].map((s, i) => (
          <div key={i} className="saturn-card p-4 text-center">
            <div className={`saturn-stat-value ${s.variant}`}>{s.value}</div>
            <div className="saturn-stat-label">🪐 {s.label}</div>
          </div>
        ))}
      </div>

      {/* Strategy Selection */}
      <div className="saturn-card p-5 mb-6">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: "hsl(var(--saturn-text))" }}>
          <Target className="h-4 w-4" style={{ color: "hsl(var(--saturn-primary))" }} />
          🪐 Trading Strategies
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {strategies.map((strategy) => {
            const Icon = strategy.icon;
            const isSelected = selectedStrategy === strategy.id;
            return (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategy(isSelected ? undefined : strategy.id)}
                className="p-3 rounded-lg border text-left transition-all"
                style={{
                  background: isSelected ? strategy.bgColor : "hsl(var(--saturn-bg))",
                  borderColor: isSelected ? strategy.borderColor : "hsl(var(--saturn-border))",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" style={{ color: strategy.color }} />
                  <span className="font-semibold text-sm" style={{ color: "hsl(var(--saturn-text))" }}>{strategy.name}</span>
                </div>
                <p className="text-xs mb-2" style={{ color: "hsl(var(--saturn-muted))" }}>{strategy.description}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-muted))" }}>
                    SL: {strategy.stopLoss}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-muted))" }}>
                    TP: {strategy.takeProfit}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-muted))" }}>
                    {strategy.positions}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`saturn-tab ${activeTab === tab.id ? "active" : ""}`}
              >
                {tab.label}
                {tab.count ? (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full" style={{ background: "hsl(var(--saturn-primary) / 0.2)", color: "hsl(var(--saturn-primary))" }}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {activeTab === "funding" && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: "hsl(38, 92%, 50%, 0.1)", border: "1px solid hsl(38, 92%, 50%, 0.2)" }}>
              <p className="text-sm" style={{ color: "hsl(38, 92%, 50%)" }}>
                <Wallet className="h-4 w-4 inline mr-2" />
                🪐 These agents are accumulating trading capital from swap fees. Trading activates at 0.5 SOL.
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {renderAgents()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <FearGreedGauge />

          {/* Info card */}
          <div className="saturn-card p-5" style={{ borderColor: "hsl(var(--saturn-primary) / 0.3)" }}>
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: "hsl(var(--saturn-text))" }}>
              <Wallet className="h-4 w-4" style={{ color: "hsl(var(--saturn-primary))" }} />
              🪐 Saturn Trading Agents
            </h3>
            <p className="text-xs" style={{ color: "hsl(var(--saturn-muted))" }}>
              Agents are launched by admins and available for bidding. Place bids to take ownership and earn fees! 🪐
            </p>
          </div>

          {/* Technical Architecture */}
          <div className="saturn-card p-4">
            <h3 className="font-bold text-xs mb-3 flex items-center gap-2" style={{ color: "hsl(var(--saturn-text))" }}>
              <Zap className="h-4 w-4" style={{ color: "hsl(var(--saturn-secondary))" }} />
              🪐 Technical Architecture
            </h3>
            <div className="space-y-2">
              {[
                { title: "Token Scoring Engine", desc: "Multi-factor: liquidity, holders, age, momentum, narrative, volume" },
                { title: "Risk Management", desc: "Internal SL/TP monitoring every 60s via Jupiter" },
                { title: "Capital Flow", desc: "50% swap fees → encrypted trading wallet. Activates at 0.5 SOL" },
              ].map((item, i) => (
                <div key={i} className="p-2 rounded-lg" style={{ background: "hsl(var(--saturn-bg))", border: "1px solid hsl(var(--saturn-border))" }}>
                  <div className="font-medium text-xs mb-0.5" style={{ color: "hsl(var(--saturn-text))" }}>{item.title}</div>
                  <div className="text-[10px]" style={{ color: "hsl(var(--saturn-muted))" }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
