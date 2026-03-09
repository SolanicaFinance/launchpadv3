import { AlphaTradeRecord } from "@/hooks/useUserProfile";
import { PositionSummary } from "@/lib/tradeUtils";
import { TokenHolding } from "@/hooks/useWalletHoldings";
import { Link } from "react-router-dom";
import { ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { timeAgo, formatTokenAmt, formatMcap } from "@/lib/tradeUtils";
import { useMemo } from "react";

interface MergedPosition {
  token_mint: string;
  token_ticker: string | null;
  token_image_url: string | null;
  status: string;
  total_bought_sol: number;
  net_tokens: number;
  realized_pnl_sol: number;
  wallet_address: string;
  hasAlphaData: boolean;
}

interface PositionsTabProps {
  alphaTrades: AlphaTradeRecord[];
  positions: Map<string, PositionSummary>;
  loading: boolean;
  onChainHoldings?: TokenHolding[];
  holdingsLoading?: boolean;
}

export function ProfilePositionsTab({ alphaTrades, positions, loading, onChainHoldings = [], holdingsLoading = false }: PositionsTabProps) {
  const mergedPositions = useMemo(() => {
    const result: MergedPosition[] = [];
    const seenMints = new Set<string>();

    // First add all alpha positions that are active
    for (const pos of positions.values()) {
      if (pos.status === "HOLDING" || pos.status === "PARTIAL") {
        seenMints.add(pos.token_mint);
        const trade = alphaTrades.find((t) => t.token_mint === pos.token_mint);
        result.push({
          token_mint: pos.token_mint,
          token_ticker: pos.token_ticker,
          token_image_url: trade?.token_image_url ?? null,
          status: pos.status,
          total_bought_sol: pos.total_bought_sol,
          net_tokens: pos.net_tokens,
          realized_pnl_sol: pos.realized_pnl_sol,
          wallet_address: pos.wallet_address,
          hasAlphaData: true,
        });
      }
    }

    // Then add on-chain holdings not already covered by alpha
    for (const h of onChainHoldings) {
      if (!seenMints.has(h.mint)) {
        seenMints.add(h.mint);
        result.push({
          token_mint: h.mint,
          token_ticker: null,
          token_image_url: null,
          status: "HOLDING",
          total_bought_sol: 0,
          net_tokens: h.balance,
          realized_pnl_sol: 0,
          wallet_address: "",
          hasAlphaData: false,
        });
      }
    }

    return result;
  }, [positions, alphaTrades, onChainHoldings]);

  if (loading || holdingsLoading) {
    return <div className="p-6 flex justify-center"><div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin" /></div>;
  }

  if (mergedPositions.length === 0) {
    return <p className="p-6 text-center text-muted-foreground text-sm font-mono">No active positions</p>;
  }

  return (
    <div className="divide-y divide-border/20">
      {/* Header */}
      <div className="grid grid-cols-[1fr_60px_70px_70px_56px_40px] gap-2 px-4 py-1.5 text-[8px] text-muted-foreground/50 uppercase tracking-widest font-medium">
        <span>Token</span>
        <span>Status</span>
        <span className="text-right">Bought</span>
        <span className="text-right">Tokens</span>
        <span className="text-right">PnL</span>
        <span></span>
      </div>
      {mergedPositions.map((pos) => {
        const pnlPositive = pos.realized_pnl_sol >= 0;

        return (
          <div key={pos.token_mint} className="grid grid-cols-[1fr_60px_70px_70px_56px_40px] gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors">
            {/* Token */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded-full bg-muted border border-border/50 overflow-hidden flex items-center justify-center shrink-0">
                {pos.token_image_url ? (
                  <img src={pos.token_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[7px] font-bold text-muted-foreground">
                    {(pos.token_ticker || "??").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <Link to={`/trade/${pos.token_mint}`} className="text-[11px] font-semibold text-foreground hover:text-primary truncate block">
                  {pos.token_ticker ? `$${pos.token_ticker}` : `${pos.token_mint.slice(0, 6)}...`}
                </Link>
                <span className="text-[9px] text-muted-foreground/50 font-mono">{pos.token_mint.slice(0, 4)}..{pos.token_mint.slice(-4)}</span>
              </div>
            </div>

            {/* Status */}
            <span className={`px-1.5 py-px rounded border text-[8px] font-bold tracking-wide text-center ${
              pos.status === "HOLDING" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
            }`}>
              {pos.status}
            </span>

            {/* Bought SOL */}
            <span className="text-[10px] font-mono text-right text-foreground tabular-nums">
              {pos.hasAlphaData ? `${pos.total_bought_sol.toFixed(3)} SOL` : "—"}
            </span>

            {/* Net Tokens */}
            <span className="text-[10px] font-mono text-right text-foreground/60 tabular-nums">
              {formatTokenAmt(pos.net_tokens)}
            </span>

            {/* PnL */}
            <span className={`text-[10px] font-mono text-right tabular-nums ${pos.hasAlphaData ? (pnlPositive ? "text-green-400" : "text-red-400") : "text-muted-foreground"}`}>
              {pos.hasAlphaData ? `${pnlPositive ? "+" : ""}${pos.realized_pnl_sol.toFixed(3)}` : "—"}
            </span>

            {/* Explorer */}
            <div className="text-right">
              <a
                href={`https://solscan.io/account/${pos.token_mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/40 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3 inline" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ActivityTabProps {
  alphaTrades: AlphaTradeRecord[];
  loading: boolean;
}

export function ProfileActivityTab({ alphaTrades, loading }: ActivityTabProps) {
  if (loading) {
    return <div className="p-6 flex justify-center"><div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin" /></div>;
  }

  if (alphaTrades.length === 0) {
    return <p className="p-6 text-center text-muted-foreground text-sm font-mono">No alpha activity</p>;
  }

  return (
    <div className="divide-y divide-border/20">
      <div className="grid grid-cols-[32px_1fr_60px_70px_70px_56px_40px] gap-1.5 px-4 py-1.5 text-[8px] text-muted-foreground/50 uppercase tracking-widest font-medium">
        <span></span>
        <span>Token</span>
        <span>Type</span>
        <span className="text-right">SOL</span>
        <span className="text-right">Tokens</span>
        <span className="text-right">Time</span>
        <span></span>
      </div>
      {alphaTrades.map((trade) => {
        const isBuy = trade.trade_type === "buy";
        return (
          <div key={trade.id} className="grid grid-cols-[32px_1fr_60px_70px_70px_56px_40px] gap-1.5 px-4 py-2 items-center hover:bg-muted/20 transition-colors">
            <div className="h-6 w-6 rounded-full bg-muted border border-border/50 overflow-hidden flex items-center justify-center shrink-0">
              {trade.token_image_url ? (
                <img src={trade.token_image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[7px] font-bold text-muted-foreground">
                  {(trade.token_ticker || "??").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <Link to={`/trade/${trade.token_mint}`} className="text-[10px] font-semibold text-foreground hover:text-primary truncate">
              ${trade.token_ticker || trade.token_mint.slice(0, 6)}
            </Link>
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold w-fit ${isBuy ? "bg-green-500/12 text-green-400" : "bg-red-500/12 text-red-400"}`}>
              {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
              {isBuy ? "BUY" : "SELL"}
            </span>
            <span className={`text-[10px] font-mono text-right tabular-nums ${isBuy ? "text-green-400/90" : "text-red-400/90"}`}>
              {isBuy ? "+" : "-"}{trade.amount_sol.toFixed(3)}
            </span>
            <span className="text-[10px] font-mono text-right text-foreground/60 tabular-nums">
              {formatTokenAmt(trade.amount_tokens)}
            </span>
            <span className="text-[9px] font-mono text-right text-muted-foreground/50 tabular-nums">
              {timeAgo(trade.created_at)}
            </span>
            <div className="text-right">
              {trade.tx_hash && (
                <a href={`https://solscan.io/tx/${trade.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/40 hover:text-primary">
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
