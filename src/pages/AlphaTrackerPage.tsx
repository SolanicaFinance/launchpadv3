import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useAlphaTrades } from "@/hooks/useAlphaTrades";
import { Crosshair, ExternalLink, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Link } from "react-router-dom";

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AlphaTrackerPage() {
  const { trades, loading } = useAlphaTrades(100);

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="space-y-0 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Crosshair className="h-4 w-4 text-primary" />
          <h1 className="text-[15px] font-bold text-foreground tracking-tight">Alpha Tracker</h1>
          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
            {trades.length} trades
          </span>
        </div>

        {/* Trade Feed */}
        <div className="divide-y divide-border/20">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
            </div>
          ) : trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Crosshair className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-[13px] font-medium">No trades yet</p>
              <p className="text-[11px] opacity-60">Trades from tracked wallets will appear here in real-time</p>
            </div>
          ) : (
            trades.map((trade) => {
              const isBuy = trade.trade_type === "buy";
              return (
                <div
                  key={trade.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover/30 transition-colors"
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {trade.trader_avatar_url ? (
                      <img src={trade.trader_avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {(trade.trader_display_name || trade.wallet_address)?.slice(0, 2)?.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-foreground truncate">
                        {trade.trader_display_name || `${trade.wallet_address.slice(0, 4)}..${trade.wallet_address.slice(-4)}`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isBuy
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {isBuy ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {trade.token_mint && (
                        <Link
                          to={`/trade/${trade.token_mint}`}
                          className="text-[10px] font-mono text-primary hover:underline truncate"
                        >
                          {trade.token_ticker || trade.token_name || `${trade.token_mint.slice(0, 6)}..`}
                        </Link>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {trade.amount_sol?.toFixed(3)} SOL
                      </span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {timeAgo(trade.created_at)}
                    </span>
                    {trade.tx_hash && (
                      <a
                        href={`https://solscan.io/tx/${trade.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
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
