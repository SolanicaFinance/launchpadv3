import { cn } from "@/lib/utils";
import type { AsterPosition, AsterOpenOrder } from "@/hooks/useAsterAccount";
import { useState } from "react";

interface Props {
  positions: AsterPosition[];
  openOrders: AsterOpenOrder[];
  onCancelOrder: (symbol: string, orderId: number) => void;
  hasApiKey: boolean | null;
}

export function LeveragePositions({ positions, openOrders, onCancelOrder, hasApiKey }: Props) {
  const [tab, setTab] = useState<"positions" | "orders">("positions");

  const activePositions = positions.filter((p) => parseFloat(p.positionAmt) !== 0);

  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-6">
        Connect API key to view positions
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Tab header */}
      <div className="flex gap-4 px-3 border-b border-border">
        <button
          onClick={() => setTab("positions")}
          className={cn(
            "py-2 text-xs font-medium border-b-2 transition-colors",
            tab === "positions" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Positions ({activePositions.length})
        </button>
        <button
          onClick={() => setTab("orders")}
          className={cn(
            "py-2 text-xs font-medium border-b-2 transition-colors",
            tab === "orders" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Open Orders ({openOrders.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "positions" ? (
          activePositions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">No open positions</div>
          ) : (
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
                {activePositions.map((p) => {
                  const pnl = parseFloat(p.unRealizedProfit);
                  const amt = parseFloat(p.positionAmt);
                  const isLong = amt > 0;
                  return (
                    <tr key={p.symbol + p.positionSide} className="border-b border-border/30 hover:bg-surface-hover/50">
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{p.symbol.replace("USDT", "")}</span>
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
          )
        ) : (
          openOrders.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">No open orders</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
                  <th className="text-left px-3 py-1.5">Symbol</th>
                  <th className="text-left px-2 py-1.5">Type</th>
                  <th className="text-left px-2 py-1.5">Side</th>
                  <th className="text-right px-2 py-1.5">Price</th>
                  <th className="text-right px-2 py-1.5">Qty</th>
                  <th className="text-right px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {openOrders.map((o) => (
                  <tr key={o.orderId} className="border-b border-border/30 hover:bg-surface-hover/50">
                    <td className="px-3 py-2 font-medium text-foreground">{o.symbol.replace("USDT", "")}</td>
                    <td className="px-2 py-2 text-muted-foreground">{o.type}</td>
                    <td className={cn("px-2 py-2 font-medium", o.side === "BUY" ? "text-green-400" : "text-red-400")}>{o.side}</td>
                    <td className="text-right px-2 py-2 text-foreground tabular-nums">${parseFloat(o.price).toLocaleString()}</td>
                    <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{o.origQty}</td>
                    <td className="text-right px-3 py-2">
                      <button
                        onClick={() => onCancelOrder(o.symbol, o.orderId)}
                        className="text-red-400 hover:text-red-300 text-[10px] font-medium"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
