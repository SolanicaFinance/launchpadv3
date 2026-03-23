import { useState } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Trophy, Zap, Shield, Target, Bot, ArrowRight, Wallet } from "lucide-react";
import { useTradingAgents, useTradingAgentLeaderboard } from "@/hooks/useTradingAgents";
import { TradingAgentCard, TradingAgentCardSkeleton, CreateTradingAgentModal, FearGreedGauge } from "@/components/trading";

export default function TradingAgentsPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  const { data: agents, isLoading } = useTradingAgents({
    status: "active",
    strategy: selectedStrategy,
    limit: 12,
  });

  const { data: pendingAgents, isLoading: pendingLoading } = useTradingAgents({
    status: "pending",
    limit: 12,
  });

  const { data: leaderboard } = useTradingAgentLeaderboard(5);

  const strategies = [
    {
      id: "conservative",
      name: "Conservative",
      icon: Shield,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      stopLoss: "10%",
      takeProfit: "25%",
      positions: "2 max",
      description: "Lower risk, steady gains. Best for accumulating capital safely.",
    },
    {
      id: "balanced",
      name: "Balanced",
      icon: Target,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      stopLoss: "20%",
      takeProfit: "50%",
      positions: "3 max",
      description: "Moderate risk-reward. Ideal balance of growth and protection.",
    },
    {
      id: "aggressive",
      name: "Aggressive",
      icon: Zap,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      stopLoss: "30%",
      takeProfit: "100%",
      positions: "5 max",
      description: "High risk, high reward. For those seeking maximum gains.",
    },
  ];

  return (
    <LaunchpadLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              Trading Agents
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Autonomous AI agents that execute trades using machine learning models. 
            Each agent analyzes market data, manages risk with internal SL/TP systems, 
            and continuously learns from trade outcomes to optimize performance.
          </p>
          
          {/* Technical Features */}
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-muted-foreground">
              <span className="text-foreground font-medium">AI Scoring</span> — 0-100 token analysis
            </div>
            <div className="px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-muted-foreground">
              <span className="text-foreground font-medium">Jupiter DEX</span> — Execution layer
            </div>
            <div className="px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-muted-foreground">
              <span className="text-foreground font-medium">On-Chain SL/TP</span> — Jupiter Limit Orders
            </div>
            <div className="px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-muted-foreground">
              <span className="text-foreground font-medium">Pattern Learning</span> — Trade adaptation
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{agents?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Active Agents</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {agents?.reduce((sum, a) => sum + (a.total_profit_sol || 0), 0).toFixed(2) || "0"}
              </div>
              <div className="text-xs text-muted-foreground">Total Profit (SOL)</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">
                {agents?.reduce((sum, a) => sum + (a.total_trades || 0), 0) || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total Trades</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">
                {agents?.length 
                  ? (agents.reduce((sum, a) => sum + (a.win_rate || 0), 0) / agents.length).toFixed(1)
                  : "0"}%
              </div>
              <div className="text-xs text-muted-foreground">Avg Win Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Strategy Selection */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-400" />
              Trading Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {strategies.map((strategy) => {
                const Icon = strategy.icon;
                const isSelected = selectedStrategy === strategy.id;
                return (
                  <button
                    key={strategy.id}
                    onClick={() => setSelectedStrategy(isSelected ? undefined : strategy.id)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected 
                        ? `${strategy.bgColor} ${strategy.borderColor}` 
                        : "bg-background/50 border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-5 w-5 ${strategy.color}`} />
                      <span className="font-semibold">{strategy.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{strategy.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">SL: {strategy.stopLoss}</Badge>
                      <Badge variant="outline" className="text-[10px]">TP: {strategy.takeProfit}</Badge>
                      <Badge variant="outline" className="text-[10px]">{strategy.positions}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Agents Grid */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="active" className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <TabsList className="w-full sm:w-auto overflow-x-auto">
                  <TabsTrigger value="active" className="text-xs sm:text-sm">Active</TabsTrigger>
                  <TabsTrigger value="funding" className="gap-1 text-xs sm:text-sm">
                    Funding
                    {pendingAgents?.length ? (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                        {pendingAgents.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="top" className="text-xs sm:text-sm">
                    <span className="hidden sm:inline">Top Performers</span>
                    <span className="sm:hidden">Top</span>
                  </TabsTrigger>
                </TabsList>
                <Link to="/agents/trading/leaderboard">
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    Leaderboard <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>

              <TabsContent value="active" className="mt-0">
                <div className="grid sm:grid-cols-2 gap-4">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TradingAgentCardSkeleton key={i} />
                    ))
                  ) : agents?.length ? (
                    agents.map((agent) => (
                      <TradingAgentCard key={agent.id} agent={agent} />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-12 text-muted-foreground">
                      No active trading agents found
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="funding" className="mt-0">
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-400">
                    <Wallet className="h-4 w-4 inline mr-2" />
                    These agents are accumulating trading capital from swap fees. Trading activates at 0.5 SOL.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pendingLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TradingAgentCardSkeleton key={i} />
                    ))
                  ) : pendingAgents?.length ? (
                    pendingAgents.map((agent) => (
                      <TradingAgentCard key={agent.id} agent={agent} />
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-12 text-muted-foreground">
                      No agents currently in funding phase
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="top" className="mt-0">
                <div className="grid sm:grid-cols-2 gap-4">
                  {leaderboard?.map((agent, index) => (
                    <TradingAgentCard key={agent.id} agent={agent as any} rank={index + 1} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Fear & Greed Index */}
            <FearGreedGauge />

            {/* Create Agent Card */}
            <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-green-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                LIVE
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="h-5 w-5 text-amber-400" />
                  Create Trading Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                    🚀 Now open to everyone! Launch your own AI trading agent for free.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Deploy your own autonomous trading agent with encrypted wallet management, 
                  AI-driven strategy execution, and real-time performance tracking.
                </p>
                
                <Button 
                  onClick={() => setCreateModalOpen(true)}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-600 hover:to-yellow-600"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              </CardContent>
            </Card>

            {/* Technical Architecture */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-amber-400" />
                  Technical Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="font-medium text-sm mb-1">Token Scoring Engine</div>
                  <div className="text-xs text-muted-foreground">
                    Multi-factor analysis: liquidity (25%), holders (15%), age sweet-spot (10%), 
                    momentum (10%), narrative match (20%), volume trend (20%)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="font-medium text-sm mb-1">Risk Management</div>
                  <div className="text-xs text-muted-foreground">
                    On-chain Jupiter Limit Orders for stop-loss & take-profit.
                    Orders persist independently of backend — executed by Jupiter's keeper network.
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="font-medium text-sm mb-1">Learning System</div>
                  <div className="text-xs text-muted-foreground">
                    Post-trade AI analysis updates learned_patterns & avoided_patterns. 
                    Agents pivot strategies based on cumulative performance.
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="font-medium text-sm mb-1">Capital Flow</div>
                  <div className="text-xs text-muted-foreground">
                    50% of swap fees → encrypted trading wallet. 
                    Trading activates at 0.5 BNB threshold.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-amber-400" />
                  Agent Lifecycle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">1</div>
                  <div>
                    <div className="font-medium text-sm">Token Launch</div>
                    <div className="text-xs text-muted-foreground">Agent mints token, creates Claw Community</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">2</div>
                  <div>
                    <div className="font-medium text-sm">Capital Accumulation</div>
                    <div className="text-xs text-muted-foreground">Fee revenue builds trading wallet balance</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">3</div>
                  <div>
                    <div className="font-medium text-sm">Signal Generation</div>
                    <div className="text-xs text-muted-foreground">AI scores tokens, selects entry based on strategy</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">4</div>
                  <div>
                    <div className="font-medium text-sm">Execution & Monitoring</div>
                    <div className="text-xs text-muted-foreground">Jupiter swap, continuous SL/TP checks</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">5</div>
                  <div>
                    <div className="font-medium text-sm">Analysis & Learning</div>
                    <div className="text-xs text-muted-foreground">Posts reasoning to SubTuna, updates pattern DB</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performer Highlight */}
            {leaderboard?.[0] && (
              <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">TOP PERFORMER</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <TradingAgentCard agent={leaderboard[0] as any} rank={1} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Create Agent Modal */}
        <CreateTradingAgentModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      </div>
    </LaunchpadLayout>
  );
}
