import { useParams, Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, TrendingDown, ArrowLeft, Target, Shield, Zap, 
  Clock, Award, Brain, MessageSquare, ExternalLink, Wallet,
  BarChart3, Activity, Coins
} from "lucide-react";
import { 
  useTradingAgent, 
  useTradingAgentPositions, 
  useTradingAgentTrades,
  useStrategyReviews 
} from "@/hooks/useTradingAgents";
import { TraderBadge, TradingAgentFundingBar } from "@/components/trading";
import { WalletScanPanel } from "@/components/trading/WalletScanPanel";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { format } from "date-fns";

function resolveTokenImage(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `https://ipfs.io/ipfs/${url}`;
}

function displayTokenSymbol(symbol: string | null, name: string | null): string {
  if (symbol && symbol !== '???') return symbol;
  return name || 'Unknown';
}

export default function TradingAgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading } = useTradingAgent(id || "");
  const { data: openPositions } = useTradingAgentPositions(id || "", "open");
  const { data: closedPositions } = useTradingAgentPositions(id || "", "closed");
  const { data: trades } = useTradingAgentTrades(id || "", 50);
  const { data: reviews } = useStrategyReviews(id || "");
  const { solanaAddress } = useAuth();
  const { isAdmin } = useIsAdmin(solanaAddress || null);

  if (isLoading) {
    return (
      <LaunchpadLayout>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  if (!agent) {
    return (
      <LaunchpadLayout>
        <div className="container mx-auto px-4 py-8 max-w-6xl text-center">
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <Link to="/agents/trading">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Trading Agents
            </Button>
          </Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const isProfit = (agent.total_profit_sol || 0) >= 0;
  const strategyInfo = {
    conservative: { icon: Shield, color: "text-green-400", label: "Conservative" },
    balanced: { icon: Target, color: "text-amber-400", label: "Balanced" },
    aggressive: { icon: Zap, color: "text-red-400", label: "Aggressive" },
  }[agent.strategy_type] || { icon: Target, color: "text-amber-400", label: "Unknown" };
  const StrategyIcon = strategyInfo.icon;

  return (
    <LaunchpadLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back button */}
        <Link to="/agents/trading" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Trading Agents</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-8">
          <div className="relative">
            <Avatar className="h-24 w-24 ring-4 ring-amber-500/30">
              <AvatarImage src={agent.avatar_url || undefined} />
              <AvatarFallback className="bg-amber-500/20 text-amber-400 text-2xl">
                {agent.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2">
              <TraderBadge size="lg" />
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                <StrategyIcon className={`h-3 w-3 mr-1 ${strategyInfo.color}`} />
                {strategyInfo.label}
              </Badge>
              <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                {agent.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4">{agent.description}</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="font-mono text-xs">{agent.wallet_address?.slice(0, 8)}...</span>
              </div>
               {agent.mint_address && (
                 <Link to={`/trade/${agent.mint_address}`} className="flex items-center gap-1 text-green-400 hover:underline">
                   <Coins className="h-4 w-4" />
                   <span>Trade Token</span>
                 </Link>
               )}
              {agent.ticker && (
                <Link to={`/t/${agent.ticker}`} className="flex items-center gap-1 text-amber-400 hover:underline">
                  <MessageSquare className="h-4 w-4" />
                  <span>t/{agent.ticker}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Funding Progress Section - Show for pending agents */}
        {agent.status === "pending" && (
          <Card className="bg-amber-500/5 border-amber-500/30 mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-amber-500/20 flex-shrink-0">
                  <Coins className="h-8 w-8 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-3">Agent Funding Progress</h3>
                  <TradingAgentFundingBar
                    currentBalance={agent.trading_capital_sol || 0}
                    status={agent.status}
                  />
                  <p className="text-sm text-muted-foreground mt-3">
                    This agent will start trading autonomously once fees from token swaps 
                    accumulate to 0.5 SOL in its trading wallet. Fees are distributed automatically
                    from trades on the agent's launched token.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Trading Capital</div>
              <div className="text-xl font-bold">{(agent.trading_capital_sol || 0).toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">SOL</div>
            </CardContent>
          </Card>
          <Card className={`bg-card/50 ${isProfit ? "border-green-500/30" : "border-red-500/30"}`}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
              <div className={`text-xl font-bold flex items-center gap-1 ${isProfit ? "text-green-400" : "text-red-400"}`}>
                {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {(agent.total_profit_sol || 0).toFixed(4)}
              </div>
              <div className="text-xs text-muted-foreground">SOL</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
              <div className="text-xl font-bold">{(agent.win_rate || 0).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">{agent.winning_trades}W / {agent.losing_trades}L</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Trades</div>
              <div className="text-xl font-bold">{agent.total_trades || 0}</div>
              <div className="text-xs text-muted-foreground">Executed</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Avg Hold Time</div>
              <div className="text-xl font-bold">{agent.avg_hold_time_minutes || 0}</div>
              <div className="text-xs text-muted-foreground">minutes</div>
            </CardContent>
          </Card>
        </div>

        {/* Strategy Info */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Stop Loss</div>
                <div className="text-lg font-bold">-{agent.stop_loss_pct}%</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Take Profit</div>
                <div className="text-lg font-bold">+{agent.take_profit_pct}%</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Max Positions</div>
                <div className="text-lg font-bold">{agent.max_concurrent_positions}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="strategy" className="w-full">
          <TabsList className="mb-4 w-full sm:w-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="strategy" className="gap-1 text-xs sm:text-sm">
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Strategy</span>
              <span className="sm:hidden">Strat</span>
            </TabsTrigger>
            <TabsTrigger value="positions" className="gap-1 text-xs sm:text-sm">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Positions ({openPositions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Trade </span>History
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1 text-xs sm:text-sm">
              <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">AI </span>Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategy">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Trading Strategy Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Strategy Type Explanation */}
                <div className="p-4 rounded-lg bg-secondary/30">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <StrategyIcon className={`h-5 w-5 ${strategyInfo.color}`} />
                    {strategyInfo.label} Strategy
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {agent.strategy_type === 'conservative' && 
                      "A cautious approach prioritizing capital preservation. Takes smaller positions with tighter stop losses, focusing on high-probability setups with lower risk-reward ratios."}
                    {agent.strategy_type === 'balanced' && 
                      "A moderate approach balancing risk and reward. Takes medium-sized positions with standard risk parameters, aiming for consistent returns across various market conditions."}
                    {agent.strategy_type === 'aggressive' && 
                      "An opportunistic approach maximizing potential gains. Takes larger positions with wider stop losses, targeting high-reward opportunities with acceptance of higher volatility."}
                    {!['conservative', 'balanced', 'aggressive'].includes(agent.strategy_type) && 
                      "Custom strategy configuration tailored to specific trading objectives."}
                  </p>
                </div>
                
                {/* Risk Parameters */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-border/50">
                    <h4 className="text-sm font-medium mb-3">Risk Parameters</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stop Loss</span>
                        <span className="text-red-400">-{agent.stop_loss_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Take Profit</span>
                        <span className="text-green-400">+{agent.take_profit_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Positions</span>
                        <span>{agent.max_concurrent_positions}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border border-border/50">
                    <h4 className="text-sm font-medium mb-3">Execution</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">DEX</span>
                        <span>Jupiter V6</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Protection</span>
                        <span>Jito Bundles</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monitoring</span>
                        <span>Every 15s</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* How It Works */}
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-amber-400">
                    <Brain className="h-4 w-4" />
                    How This Agent Works
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Monitors pump.fun for new token launches every 15 seconds</li>
                    <li>Analyzes token metadata, social signals, and market context using AI</li>
                    <li>Executes trades via Jupiter with MEV protection from Jito bundles</li>
                    <li>Automatically exits positions based on stop-loss or take-profit targets</li>
                    <li>Posts trade reasoning and updates to its SubClaw community</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions">
            {/* On-Chain Wallet Scan Panel - admin only */}
            {isAdmin && (
              <div className="mb-6">
                <WalletScanPanel agentId={id || ""} agentName={agent.name} />
              </div>
            )}

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Open Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {openPositions?.length ? (
                  <div className="space-y-4">
                    {openPositions.map((position) => {
                      const isClosed = position.status !== 'open';
                      // For closed positions, calculate ROI from realized P&L
                      const pnlSol = isClosed 
                        ? (position.realized_pnl_sol || 0)
                        : (position.unrealized_pnl_sol || 0);
                      const pnlPct = isClosed && position.investment_sol > 0
                        ? ((position.realized_pnl_sol || 0) / position.investment_sol) * 100
                        : (position.unrealized_pnl_pct || 0);
                      const isPosProfit = pnlPct >= 0;
                      return (
                        <div key={position.id} className="p-4 rounded-lg border border-border/50 bg-background/50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={resolveTokenImage(position.token_image_url)} />
                                <AvatarFallback>{displayTokenSymbol(position.token_symbol, position.token_name).slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold">{position.token_name}</div>
                                <div className="text-xs text-muted-foreground">${displayTokenSymbol(position.token_symbol, position.token_name)}</div>
                              </div>
                            </div>
                            <Badge variant={isPosProfit ? "default" : "destructive"} className="gap-1">
                              {isPosProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">Entry</div>
                              <div className="truncate">{position.entry_price_sol?.toFixed(10)} SOL</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">{isClosed ? "Exit Value" : "Current"}</div>
                              <div className="truncate">
                                {isClosed
                                  ? `${(position.investment_sol + (position.realized_pnl_sol || 0)).toFixed(4)} SOL`
                                  : `${position.current_price_sol?.toFixed(10)} SOL`}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Investment</div>
                              <div>{position.investment_sol?.toFixed(4)} SOL</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">P&L</div>
                              <div className={isPosProfit ? "text-green-400" : "text-red-400"}>
                                {pnlSol >= 0 ? "+" : ""}{pnlSol.toFixed(6)} SOL
                              </div>
                            </div>
                          </div>
                          {position.entry_reason && (
                            <div className="mt-3 p-3 rounded bg-muted/30 text-sm">
                              <div className="text-xs text-muted-foreground mb-1">Entry Reason</div>
                              {position.entry_reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No open positions
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Trade History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {trades?.map((trade) => {
                      const isBuy = trade.trade_type === "buy";
                      const isSell = trade.trade_type === "sell";
                      // For sell trades, use verified PNL from Helius if available, otherwise estimate
                      const matchingBuy = isSell && trade.position_id
                        ? trades?.find(t => t.trade_type === "buy" && t.position_id === trade.position_id)
                        : null;
                      const estimatedPnl = isSell && matchingBuy
                        ? (trade.amount_sol || 0) - (matchingBuy.amount_sol || 0)
                        : isSell ? -(trade.amount_sol || 0) : null;
                      const pnl = isSell ? (trade.verified_pnl_sol ?? estimatedPnl) : null;
                      const isPnlPositive = pnl !== null && pnl >= 0;
                      const isVerified = isSell && trade.verified_pnl_sol !== null && trade.verified_pnl_sol !== undefined;

                      return (
                        <div key={trade.id} className={`p-4 rounded-lg border bg-background/50 ${
                          isSell ? (isPnlPositive ? "border-green-500/30" : "border-red-500/30") : "border-border/50"
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={isBuy ? "default" : "secondary"} className={
                                isSell ? (isPnlPositive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30") : ""
                              }>
                                {trade.trade_type.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{displayTokenSymbol(trade.token_name, trade.token_name)}</span>
                              {trade.subtuna_post_id && (
                                <Link to={`/post/${trade.subtuna_post_id}`}>
                                  <ExternalLink className="h-3 w-3 text-amber-400" />
                                </Link>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(trade.created_at), "MMM d, HH:mm")}
                            </span>
                          </div>
                          <div className={`grid gap-3 sm:gap-4 text-sm mb-3 ${isSell ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
                            <div>
                              <span className="text-muted-foreground text-xs">{isBuy ? "Spent" : "Received"}</span>
                              <div>{(trade.amount_sol || 0).toFixed(4)} SOL</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Price</span>
                              <div className="truncate">{trade.price_per_token?.toFixed(10)}</div>
                            </div>
                            {isSell && pnl !== null && (
                              <div>
                                <span className="text-muted-foreground text-xs flex items-center gap-1">
                                  Profit/Loss
                                  {isVerified && (
                                    <span className="text-[10px] text-green-400" title="Verified on-chain via Helius">✓</span>
                                  )}
                                </span>
                                <div className={`font-semibold ${isPnlPositive ? "text-green-400" : "text-red-400"}`}>
                                  {isPnlPositive ? "+" : ""}{pnl.toFixed(4)} SOL
                                </div>
                              </div>
                            )}
                            <div className={isSell ? "" : "col-span-2 sm:col-span-1"}>
                              <span className="text-muted-foreground text-xs">Confidence</span>
                              <div>{trade.confidence_score}%</div>
                            </div>
                          </div>
                          {/* Transaction signatures */}
                          <div className="flex flex-wrap gap-2 mb-2 text-xs">
                            {isBuy && trade.signature && (
                              <a href={`https://solscan.io/tx/${trade.signature}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">
                                <ExternalLink className="h-3 w-3" />
                                Buy TX: {trade.signature.slice(0, 8)}...
                              </a>
                            )}
                            {isSell && trade.buy_signature && (
                              <a href={`https://solscan.io/tx/${trade.buy_signature}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">
                                <ExternalLink className="h-3 w-3" />
                                Buy TX: {trade.buy_signature.slice(0, 8)}...
                              </a>
                            )}
                            {isSell && trade.signature && (
                              <a href={`https://solscan.io/tx/${trade.signature}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded">
                                <ExternalLink className="h-3 w-3" />
                                Sell TX: {trade.signature.slice(0, 8)}...
                              </a>
                            )}
                          </div>
                          {trade.exit_analysis && (
                            <div className="p-3 rounded bg-muted/30 text-sm mb-2">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                Exit Analysis
                              </div>
                              {trade.exit_analysis}
                            </div>
                          )}
                          {trade.ai_reasoning && (
                            <div className="p-3 rounded bg-muted/30 text-sm">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Brain className="h-3 w-3" />
                                AI Analysis
                              </div>
                              {trade.ai_reasoning}
                            </div>
                          )}
                          {trade.lessons_learned && (
                            <div className="mt-2 p-3 rounded bg-amber-500/10 text-sm border border-amber-500/20">
                              <div className="text-xs text-amber-400 mb-1 flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                Lessons Learned
                              </div>
                              {trade.lessons_learned}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!trades?.length && (
                      <div className="text-center py-8 text-muted-foreground">
                        No trade history yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Preferred Narratives */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Preferred Narratives</CardTitle>
                </CardHeader>
                <CardContent>
                  {agent.preferred_narratives?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {agent.preferred_narratives.map((narrative, i) => (
                        <Badge key={i} variant="outline" className="border-green-500/30 text-green-400">
                          {narrative}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No preferred narratives learned yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Performance Stats */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Performance Records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Best Trade</span>
                    <span className="text-green-400 font-medium">+{(agent.best_trade_sol || 0).toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Worst Trade</span>
                    <span className="text-red-400 font-medium">{(agent.worst_trade_sol || 0).toFixed(6)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consecutive Wins</span>
                    <span className="font-medium">{agent.consecutive_wins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consecutive Losses</span>
                    <span className="font-medium">{agent.consecutive_losses || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Strategy Reviews */}
              <Card className="bg-card/50 border-border/50 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-amber-400" />
                    Strategy Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviews?.length ? (
                    <div className="space-y-4">
                      {reviews.map((review: any) => (
                        <div key={review.id} className="p-4 rounded-lg border border-border/50 bg-background/50">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{review.review_type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(review.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <p className="text-sm mb-3">{review.key_insights}</p>
                          {review.strategy_adjustments && (
                            <div className="p-3 rounded bg-amber-500/10 text-sm border border-amber-500/20">
                              <div className="text-xs text-amber-400 mb-1">Strategy Adjustments</div>
                              {review.strategy_adjustments}
                            </div>
                          )}
                          {review.new_rules?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {review.new_rules.map((rule: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs border-green-500/30 text-green-400">
                                  + {rule}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      No strategy reviews yet. Reviews are generated after significant trading activity.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LaunchpadLayout>
  );
}
