import { Link } from "react-router-dom";
import { useAlphaTrades, type AlphaTrade, type PositionSummary } from "@/hooks/useAlphaTrades";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { timeAgo, formatTokenAmt } from "@/lib/tradeUtils";

/* ── Status Pill ── */
function StatusPill({ status }: { status: "HOLDING" | "PARTIAL" | "SOLD" }) {
  const c = {
    HOLDING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PARTIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    SOLD: "bg-red-500/10 text-red-400 border-red-500/20",
  }[status];
  return (
    <span className={`px-1.5 py-px rounded border text-[8px] font-bold tracking-wide ${c}`}>
      {status}
    </span>
  );
}

function AlphaTradeRow({ trade, position }: { trade: AlphaTrade; position?: PositionSummary }) {
  const isBuy = trade.trade_type === "buy";
  return (
    <Link
      to={`/trade/${trade.token_mint}`}
      className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300
                 bg-card/30 backdrop-blur-sm border border-border/20
                 hover:border-primary/30 hover:bg-card/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.06)] hover:scale-[1.01]"
    >
      <div className="h-8 w-8 rounded-full bg-muted/50 border border-border/30 overflow-hidden flex items-center justify-center shrink-0
                       group-hover:ring-1 group-hover:ring-primary/20 transition-all">
        {trade.token_image_url ? (
          <img src={trade.token_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[7px] font-bold text-muted-foreground">
            {(trade.token_ticker || "??").slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-foreground truncate">
            ${trade.token_ticker || trade.token_name || "???"}
          </span>
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md",
            isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}>
            {isBuy ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {isBuy ? "BUY" : "SELL"}
          </span>
          {position && <StatusPill status={position.status} />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-muted-foreground font-mono truncate">
            {trade.trader_display_name || `${trade.wallet_address.slice(0, 4)}...${trade.wallet_address.slice(-4)}`}
          </span>
          <span className="text-border">·</span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {formatTokenAmt(trade.amount_tokens)} tokens
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn("text-[11px] font-bold font-mono tabular-nums", isBuy ? "text-emerald-400" : "text-red-400")}>
          {isBuy ? "+" : "-"}{trade.amount_sol.toFixed(3)} SOL
        </div>
        <div className="text-[9px] text-muted-foreground font-mono">
          {timeAgo(trade.created_at)}
        </div>
      </div>
    </Link>
  );
}

export default function AlphaSection() {
  const { trades: alphaTrades, loading: alphaLoading, positions: alphaPositions } = useAlphaTrades(10);

  if (alphaLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
      {alphaTrades.slice(0, 10).map((t) => (
        <AlphaTradeRow key={t.id} trade={t} position={alphaPositions.get(`${t.wallet_address}::${t.token_mint}`)} />
      ))}
    </div>
  );
}
