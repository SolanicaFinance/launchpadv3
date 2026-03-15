import { useState } from "react";
import { useWalletTransactions, WalletTransaction } from "@/hooks/useWalletTransactions";
import { ArrowUpRight, ArrowDownLeft, Repeat, HelpCircle, ExternalLink, Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  walletAddress: string | null;
  pageSize?: number;
}

const typeConfig: Record<string, { icon: typeof ArrowUpRight; label: string; color: string }> = {
  send: { icon: ArrowUpRight, label: "Sent", color: "text-destructive" },
  receive: { icon: ArrowDownLeft, label: "Received", color: "text-emerald-400" },
  swap: { icon: Repeat, label: "Swap", color: "text-primary" },
  fee_payout: { icon: Coins, label: "Fee Payout", color: "text-amber-400" },
  unknown: { icon: HelpCircle, label: "Transaction", color: "text-muted-foreground" },
};

function formatTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WalletTransactionHistory({ walletAddress, pageSize }: Props) {
  const { data: transactions = [], isLoading } = useWalletTransactions(walletAddress);
  const [page, setPage] = useState(1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">No transactions yet</p>
    );
  }

  const usePagination = !!pageSize;
  const totalPages = usePagination ? Math.ceil(transactions.length / pageSize!) : 1;
  const visibleTxs = usePagination
    ? transactions.slice((page - 1) * pageSize!, page * pageSize!)
    : transactions;

  return (
    <div className="space-y-1">
      {visibleTxs.map((tx) => {
        const cfg = typeConfig[tx.type] || typeConfig.unknown;
        const Icon = cfg.icon;
        return (
          <a
            key={tx.signature}
            href={`https://solscan.io/tx/${tx.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-accent/10 group"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.color} bg-muted/50 shrink-0`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">
                {tx.label || cfg.label}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {tx.tokenName
                  ? `${tx.tokenName}`
                  : tx.description?.slice(0, 60) || tx.signature.slice(0, 16) + "…"}
              </p>
            </div>
            <div className="text-right flex items-center gap-1.5">
              {tx.amount !== undefined && (
                <span className={`text-xs font-mono font-semibold ${cfg.color}`}>
                  {tx.type === "send" ? "-" : tx.type === "receive" ? "+" : ""}
                  {tx.amount < 0.001 ? tx.amount.toExponential(1) : tx.amount.toFixed(4)}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">{formatTime(tx.timestamp)}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        );
      })}
      {usePagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] font-mono"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground">{page} / {totalPages}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] font-mono"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
