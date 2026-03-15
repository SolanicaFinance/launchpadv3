import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useAlphaTrades, PositionSummary } from "@/hooks/useAlphaTrades";
import { useChain } from "@/contexts/ChainContext";
import { Crosshair, ExternalLink, ArrowUpRight, ArrowDownRight, Search, X, Filter } from "lucide-react";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { formatTokenAmt, formatMcap } from "@/lib/tradeUtils";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

/** Live-updating time ago — re-renders driven by parent tick */
function liveTimeAgo(dateStr: string, _tick: number) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function StatusPill({ status }: { status: PositionSummary["status"] }) {
  const c = {
    HOLDING: "bg-green-500/10 text-green-400 border-green-500/20",
    PARTIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    SOLD: "bg-red-500/10 text-red-400 border-red-500/20",
  }[status];
  return (
    <span className={`px-1.5 py-px rounded border text-[8px] font-bold tracking-wide ${c}`}>
      {status}
    </span>
  );
}

type TradeTypeFilter = "all" | "buy" | "sell";
type HoldingFilter = "all" | "HOLDING" | "PARTIAL" | "SOLD";

export default function AlphaTrackerPage() {
  const { chain, chainConfig } = useChain();
  const { solPrice } = useSolPrice();

  const { trades, loading, positions } = useAlphaTrades(100);
  const [searchToken, setSearchToken] = useState("");
  const [searchWallet, setSearchWallet] = useState("");
  const [tradeTypeFilter, setTradeTypeFilter] = useState<TradeTypeFilter>("all");
  const [holdingFilter, setHoldingFilter] = useState<HoldingFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [tick, setTick] = useState(0);

  // Re-render every second to update relative timestamps
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const hasActiveFilters = searchToken || searchWallet || tradeTypeFilter !== "all" || holdingFilter !== "all";

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (searchToken) {
        const q = searchToken.toLowerCase();
        if (!(t.token_ticker?.toLowerCase().includes(q)) && !(t.token_name?.toLowerCase().includes(q)) && !t.token_mint.toLowerCase().includes(q)) return false;
      }
      if (searchWallet) {
        const q = searchWallet.toLowerCase();
        if (!t.wallet_address.toLowerCase().includes(q) && !(t.trader_display_name?.toLowerCase().includes(q))) return false;
      }
      if (tradeTypeFilter !== "all" && t.trade_type !== tradeTypeFilter) return false;
      if (holdingFilter !== "all") {
        const pos = positions.get(`${t.wallet_address}::${t.token_mint}`);
        if (!pos || pos.status !== holdingFilter) return false;
      }
      return true;
    });
  }, [trades, searchToken, searchWallet, tradeTypeFilter, holdingFilter, positions]);

  const clearFilters = () => { setSearchToken(""); setSearchWallet(""); setTradeTypeFilter("all"); setHoldingFilter("all"); };

  const getExplorerTxUrl = (txHash: string, tradeChain?: string | null) => {
    if (tradeChain === 'bnb') return `https://bscscan.com/tx/${txHash}`;
    return `https://solscan.io/tx/${txHash}`;
  };

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          <h1 className="text-[13px] font-bold text-foreground tracking-tight">Alpha Tracker</h1>
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase ml-1">{chainConfig.shortName}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
              {filteredTrades.length}/{trades.length}
            </span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 rounded transition-colors ${showFilters || hasActiveFilters ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Filter className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 py-2 border-b border-border/30 bg-muted/10 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <input type="text" placeholder="Token..." value={searchToken} onChange={(e) => setSearchToken(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 rounded bg-background border border-border/50 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40" />
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <input type="text" placeholder="Wallet..." value={searchWallet} onChange={(e) => setSearchWallet(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 rounded bg-background border border-border/50 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40" />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[8px] text-muted-foreground uppercase tracking-widest">Type</span>
              {(["all", "buy", "sell"] as TradeTypeFilter[]).map((v) => (
                <button key={v} onClick={() => setTradeTypeFilter(v)}
                  className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${tradeTypeFilter === v ? (v === "buy" ? "bg-green-500/20 text-green-400" : v === "sell" ? "bg-red-500/20 text-red-400" : "bg-primary/15 text-primary") : "text-muted-foreground/60 hover:text-foreground"}`}>
                  {v.toUpperCase()}
                </button>
              ))}
              <span className="text-border/40">|</span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-widest">Status</span>
              {(["all", "HOLDING", "PARTIAL", "SOLD"] as HoldingFilter[]).map((v) => (
                <button key={v} onClick={() => setHoldingFilter(v)}
                  className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${holdingFilter === v ? (v === "HOLDING" ? "bg-green-500/20 text-green-400" : v === "PARTIAL" ? "bg-yellow-500/20 text-yellow-400" : v === "SOLD" ? "bg-red-500/20 text-red-400" : "bg-primary/15 text-primary") : "text-muted-foreground/60 hover:text-foreground"}`}>
                  {v === "all" ? "ALL" : v}
                </button>
              ))}
              {hasActiveFilters && (
                <button onClick={clearFilters} className="ml-auto text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                  <X className="h-2.5 w-2.5" /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_1fr_60px_70px_72px_80px_64px_56px_60px] gap-1.5 px-4 py-1.5 border-b border-border/20 text-[8px] text-muted-foreground/50 uppercase tracking-widest font-medium sticky top-0 z-20 bg-background">
          <span>Token</span>
          <span>Trader</span>
          <span>Type</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Tokens</span>
          <span className="text-right">MCap</span>
          <span className="text-center">Status</span>
          <span className="text-right">Time</span>
          <span className="text-right">TX</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/10">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Crosshair className="h-6 w-6 mb-2 opacity-20" />
              <p className="text-[11px] font-medium">{hasActiveFilters ? "No matching trades" : "No trades yet"}</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-1 text-[10px] text-primary hover:underline">Clear filters</button>
              )}
            </div>
          ) : (
            filteredTrades.map((trade) => {
              const isBuy = trade.trade_type === "buy";
              const posKey = `${trade.wallet_address}::${trade.token_mint}`;
              const position = positions.get(posKey);
              // Derive price from trade data when explicit price is missing
              const derivedPriceSol = (trade.amount_tokens > 0 && trade.amount_sol > 0) 
                ? (trade.amount_sol / trade.amount_tokens) 
                : null;
              const effectivePriceSol = trade.price_sol ?? derivedPriceSol;
              const mcapSol = effectivePriceSol != null ? effectivePriceSol * 1_000_000_000 : null;
              const mcapUsd = trade.price_usd != null 
                ? trade.price_usd * 1_000_000_000 
                : (mcapSol != null && solPrice ? mcapSol * solPrice : null);
              const nativeSymbol = trade.chain === 'bnb' ? 'BNB' : 'SOL';

              return (
                <div
                  key={trade.id}
                  className="grid grid-cols-[1fr_1fr_60px_70px_72px_80px_64px_56px_60px] gap-1.5 px-4 py-1.5 items-center hover:bg-muted/20 transition-colors group"
                >
                  {/* Token: icon + ticker */}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-muted border border-border/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                      <OptimizedTokenImage
                        src={trade.token_image_url}
                        fallbackSrc={trade.token_image_fallbacks}
                        fallbackText={(trade.token_ticker || "??").slice(0, 2).toUpperCase()}
                        alt=""
                        size={24}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <Link
                      to={`/trade/${trade.token_mint}`}
                      className="text-[10px] font-semibold text-primary/90 hover:text-primary hover:underline leading-none truncate font-mono"
                    >
                      ${trade.token_ticker || trade.token_mint?.slice(0, 6)}
                    </Link>
                  </div>

                  {/* Trader: avatar + name/address */}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-muted border border-border/50 overflow-hidden flex items-center justify-center flex-shrink-0">
                     <img src={trade.trader_avatar_url || "/saturn-logo.png"} alt="" className="h-full w-full object-cover" />
                    </div>
                    <Link
                      to={`/profile/${trade.wallet_address}`}
                      className="text-[10px] font-medium text-foreground/80 truncate leading-none hover:text-primary hover:underline transition-colors"
                    >
                      {trade.trader_display_name || trade.wallet_address.slice(0, 5)}
                    </Link>
                  </div>

                  {/* Type Badge */}
                  <div>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${isBuy ? "bg-green-500/12 text-green-400" : "bg-red-500/12 text-red-400"}`}>
                      {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                      {isBuy ? "BUY" : "SELL"}
                    </span>
                  </div>

                  {/* SOL/BNB Amount */}
                  <span className={`text-[10px] font-mono text-right tabular-nums ${isBuy ? "text-green-400/90" : "text-red-400/90"}`}>
                    {isBuy ? "+" : "-"}{trade.amount_sol?.toFixed(3)} {nativeSymbol}
                  </span>

                  {/* Token Amount */}
                  <span className="text-[10px] font-mono text-right text-foreground/60 tabular-nums">
                    {formatTokenAmt(trade.amount_tokens)}
                  </span>

                  {/* MCap */}
                  <div className="text-right">
                    {mcapUsd != null ? (
                      <span className="text-[10px] font-mono text-foreground/50 tabular-nums">
                        ${formatMcap(mcapUsd)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    {position ? (
                      <StatusPill status={position.status} />
                    ) : (
                      <span className="text-[8px] text-muted-foreground/30">—</span>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-[9px] font-mono text-right text-muted-foreground/50 tabular-nums" title={format(new Date(trade.created_at), "MMM d, h:mm:ss a")}>
                    {liveTimeAgo(trade.created_at, tick)}
                  </span>

                  {/* TX */}
                  <div className="text-right">
                    {trade.tx_hash ? (
                      <a
                        href={getExplorerTxUrl(trade.tx_hash, trade.chain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-mono text-muted-foreground/40 hover:text-primary transition-colors inline-flex items-center gap-0.5 justify-end"
                      >
                        {trade.tx_hash.slice(0, 4)}..
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/20">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </LaunchpadLayout>
  );
}
