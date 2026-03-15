import { cn } from "@/lib/utils";
import type { HlPosition, HlOpenOrder, HlOrderHistory, HlTradeHistory, HlAccountInfo } from "@/hooks/useHyperliquidAccount";
import { useState } from "react";
import { RefreshCw, ArrowDownUp } from "lucide-react";

type BottomTab = "positions" | "orders" | "order_history" | "trade_history" | "assets";

interface Props {
  positions: HlPosition[];
  openOrders: HlOpenOrder[];
  orderHistory: HlOrderHistory[];
  tradeHistory: HlTradeHistory[];
  account: HlAccountInfo | null;
  onCancelOrder: (symbol: string, orderId: number) => void;
  onFetchOrderHistory: (symbol?: string) => void;
  onFetchTradeHistory: (symbol?: string) => void;
  onRefreshAccount: () => void;
  onOpenDeposit: () => void;
  hasApiKey: boolean | null;
  symbol: string;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LeveragePositions({
  positions, openOrders, orderHistory, tradeHistory, account,
  onCancelOrder, onFetchOrderHistory, onFetchTradeHistory, onRefreshAccount, onOpenDeposit,
  hasApiKey, symbol,
}: Props) {
  const [tab, setTab] = useState<BottomTab>("positions");

  const activePositions = positions.filter((p) => parseFloat(p.positionAmt) !== 0);

  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-6">
        Connect wallet to view positions & account
      </div>
    );
  }

  const tabs: { key: BottomTab; label: string; count?: number }[] = [
    { key: "positions", label: "Positions", count: activePositions.length },
    { key: "orders", label: "Open Orders", count: openOrders.length },
    { key: "trade_history", label: "Trade History" },
    { key: "assets", label: "Account" },
  ];

  return (
    <div className="flex h-full text-xs">
      {/* Left: Tabbed content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab header */}
        <div className="flex items-center gap-4 px-3 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key === "trade_history") onFetchTradeHistory();
              }}
              className={cn(
                "py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {tab === "positions" && <PositionsTable positions={activePositions} />}
          {tab === "orders" && <OrdersTable orders={openOrders} onCancel={onCancelOrder} />}
          {tab === "trade_history" && <TradeHistoryTable trades={tradeHistory} />}
          {tab === "assets" && <AccountSummary account={account} />}
        </div>
      </div>

      {/* Right: Account summary panel */}
      <div className="w-[240px] flex-shrink-0 border-l border-border bg-card/30 p-3 overflow-y-auto hidden lg:block">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-foreground">Account</span>
          <div className="flex items-center gap-1">
            <button onClick={onOpenDeposit} className="p-1 rounded hover:bg-accent text-primary hover:text-primary/80 transition-colors" title="Deposit/Withdraw">
              <ArrowDownUp className="h-3 w-3" />
            </button>
            <button onClick={onRefreshAccount} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Account Equity */}
        <div className="space-y-0.5 mb-3">
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Account Equity</span>
          <AccountRow label="Account Value" value={account?.totalWalletBalance} suffix=" USDC" />
          <AccountRow label="Unrealized PnL" value={account?.totalUnrealizedProfit} isPnl />
          <AccountRow label="Margin Balance" value={account?.totalMarginBalance} suffix=" USDC" />
          <AccountRow label="Available" value={account?.availableBalance} suffix=" USDC" highlight />
        </div>

        {/* Margin */}
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Margin</span>
          <AccountRow label="Initial Margin" value={account?.totalInitialMargin} suffix=" USDC" />
          <AccountRow label="Withdrawable" value={account?.withdrawable} suffix=" USDC" highlight />
          {account?.totalMarginBalance && account?.totalMaintMargin && (
            <div className="flex justify-between text-[10px] py-0.5">
              <span className="text-muted-foreground">Margin Ratio</span>
              <span className={cn(
                "font-medium",
                parseFloat(account.totalMaintMargin) / parseFloat(account.totalMarginBalance) > 0.8 ? "text-red-400" : "text-green-400"
              )}>
                {((parseFloat(account.totalMaintMargin) / Math.max(parseFloat(account.totalMarginBalance), 0.001)) * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountRow({ label, value, suffix, isPnl, highlight }: { label: string; value?: string; suffix?: string; isPnl?: boolean; highlight?: boolean }) {
  const num = parseFloat(value || "0");
  const display = value ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";
  return (
    <div className="flex justify-between text-[10px] py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "tabular-nums",
        isPnl ? (num >= 0 ? "text-green-400" : "text-red-400") : highlight ? "text-primary font-medium" : "text-foreground"
      )}>
        {isPnl && num > 0 ? "+" : ""}{display}{suffix || ""}
      </span>
    </div>
  );
}

function PositionsTable({ positions }: { positions: HlPosition[] }) {
  if (positions.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No open positions</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-right px-2 py-1.5">Size</th>
          <th className="text-right px-2 py-1.5">Entry</th>
          <th className="text-right px-2 py-1.5">Mark</th>
          <th className="text-right px-2 py-1.5">PnL</th>
          <th className="text-right px-2 py-1.5">Liq. Price</th>
          <th className="text-right px-3 py-1.5">Lev</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const pnl = parseFloat(p.unRealizedProfit);
          const amt = parseFloat(p.positionAmt);
          const isLong = amt > 0;
          return (
            <tr key={p.symbol + p.positionSide} className="border-b border-border/30 hover:bg-accent/50">
              <td className="px-3 py-2">
                <span className="font-medium text-foreground">{p.symbol}</span>
                <span className={cn("ml-1 text-[10px] font-bold", isLong ? "text-green-400" : "text-red-400")}>
                  {isLong ? "LONG" : "SHORT"}
                </span>
              </td>
              <td className="text-right px-2 py-2 text-foreground tabular-nums">{Math.abs(amt)}</td>
              <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">${parseFloat(p.entryPrice).toLocaleString()}</td>
              <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">${parseFloat(p.markPrice).toLocaleString()}</td>
              <td className={cn("text-right px-2 py-2 font-medium tabular-nums", pnl >= 0 ? "text-green-400" : "text-red-400")}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </td>
              <td className="text-right px-2 py-2 text-foreground/50 tabular-nums">${parseFloat(p.liquidationPrice).toLocaleString()}</td>
              <td className="text-right px-3 py-2 text-primary font-medium">{p.leverage}x</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OrdersTable({ orders, onCancel }: { orders: HlOpenOrder[]; onCancel: (symbol: string, orderId: number) => void }) {
  if (orders.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No open orders</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-left px-2 py-1.5">Type</th>
          <th className="text-left px-2 py-1.5">Side</th>
          <th className="text-right px-2 py-1.5">Price</th>
          <th className="text-right px-2 py-1.5">Qty</th>
          <th className="text-right px-2 py-1.5">Time</th>
          <th className="text-right px-3 py-1.5"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.orderId} className="border-b border-border/30 hover:bg-accent/50">
            <td className="px-3 py-2 font-medium text-foreground">{o.symbol}</td>
            <td className="px-2 py-2 text-muted-foreground">{o.type}</td>
            <td className={cn("px-2 py-2 font-medium", o.side === "BUY" ? "text-green-400" : "text-red-400")}>{o.side}</td>
            <td className="text-right px-2 py-2 text-foreground tabular-nums">${parseFloat(o.price).toLocaleString()}</td>
            <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{o.origQty}</td>
            <td className="text-right px-2 py-2 text-muted-foreground tabular-nums">{formatTime(o.time)}</td>
            <td className="text-right px-3 py-2">
              <button onClick={() => onCancel(o.symbol, o.orderId)} className="text-red-400 hover:text-red-300 text-[10px] font-medium">Cancel</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TradeHistoryTable({ trades }: { trades: HlTradeHistory[] }) {
  if (trades.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No trade history</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-left px-2 py-1.5">Side</th>
          <th className="text-right px-2 py-1.5">Price</th>
          <th className="text-right px-2 py-1.5">Qty</th>
          <th className="text-right px-2 py-1.5">Realized PnL</th>
          <th className="text-right px-2 py-1.5">Fee</th>
          <th className="text-right px-3 py-1.5">Time</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => {
          const pnl = parseFloat(t.realizedPnl);
          return (
            <tr key={t.id} className="border-b border-border/30 hover:bg-accent/50">
              <td className="px-3 py-2 font-medium text-foreground">{t.symbol}</td>
              <td className={cn("px-2 py-2 font-medium", t.side === "BUY" ? "text-green-400" : "text-red-400")}>{t.side}</td>
              <td className="text-right px-2 py-2 text-foreground tabular-nums">${parseFloat(t.price).toLocaleString()}</td>
              <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{t.qty}</td>
              <td className={cn("text-right px-2 py-2 font-medium tabular-nums", pnl >= 0 ? "text-green-400" : "text-red-400")}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)}
              </td>
              <td className="text-right px-2 py-2 text-muted-foreground tabular-nums">{parseFloat(t.commission).toFixed(4)}</td>
              <td className="text-right px-3 py-2 text-muted-foreground tabular-nums">{formatTime(t.time)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AccountSummary({ account }: { account: HlAccountInfo | null }) {
  if (!account) return <div className="flex items-center justify-center py-8 text-muted-foreground">No account data</div>;
  return (
    <div className="p-4 space-y-2">
      <AccountRow label="Account Value" value={account.totalWalletBalance} suffix=" USDC" highlight />
      <AccountRow label="Unrealized PnL" value={account.totalUnrealizedProfit} isPnl />
      <AccountRow label="Available Balance" value={account.availableBalance} suffix=" USDC" />
      <AccountRow label="Withdrawable" value={account.withdrawable} suffix=" USDC" />
      <AccountRow label="Margin Used" value={account.totalInitialMargin} suffix=" USDC" />
    </div>
  );
}
