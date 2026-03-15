import { useState } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Wallet } from "lucide-react";
import type { HyperliquidMarket } from "@/hooks/useHyperliquidMarkets";
import type { HlAccountInfo } from "@/hooks/useHyperliquidAccount";
import { toast } from "@/hooks/use-toast";

interface Props {
  market: HyperliquidMarket | undefined;
  isConnected: boolean;
  account: HlAccountInfo | null;
  onPlaceOrder: (params: any) => Promise<any>;
  onChangeLeverage: (symbol: string, leverage: number) => Promise<any>;
  onOpenDeposit: () => void;
}

export function LeverageTradePanel({ market, isConnected, account, onPlaceOrder, onChangeLeverage, onOpenDeposit }: Props) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [leverage, setLeverage] = useState(10);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxLeverage = market?.maxLeverage || 50;
  const currentPrice = parseFloat(market?.lastPrice || "0");
  const availableBalance = parseFloat(account?.availableBalance || "0");

  // Calculate max size based on available balance and leverage
  const effectivePrice = orderType === "LIMIT" && price ? parseFloat(price) : currentPrice;
  const maxSize = effectivePrice > 0 ? (availableBalance * leverage) / effectivePrice : 0;

  const handleQuickSize = (pct: number) => {
    if (maxSize <= 0) return;
    const sz = maxSize * (pct / 100);
    setQuantity(sz.toFixed(market?.szDecimals || 4));
  };

  const handleSubmit = async () => {
    if (!market || !quantity) return;
    setSubmitting(true);
    try {
      await onChangeLeverage(market.symbol, leverage);
      
      const limitPx = orderType === "LIMIT" ? parseFloat(price) : currentPrice;
      await onPlaceOrder({
        coin: market.symbol,
        isBuy: side === "BUY",
        sz: parseFloat(quantity),
        limitPx,
        orderType: orderType === "MARKET" 
          ? { limit: { tif: "Ioc" } }
          : { limit: { tif: "Gtc" } },
        reduceOnly: false,
        assetIndex: market.assetIndex,
        szDecimals: market.szDecimals,
      });
      setQuantity("");
      setPrice("");
    } catch (err: any) {
      console.error("Order failed:", err);
      toast({
        title: "Order failed",
        description: err.message || "Failed to place order",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <p className="text-sm text-muted-foreground text-center">Connect your wallet to start trading on Hyperliquid.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      {/* Balance + Deposit */}
      <div className="flex items-center justify-between p-2 bg-secondary rounded-sm border border-border/50">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Wallet className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Available</span>
          <span className="text-foreground font-medium tabular-nums">{availableBalance.toFixed(2)} USDC</span>
        </div>
        <button
          onClick={onOpenDeposit}
          className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
        >
          Deposit
        </button>
      </div>

      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary rounded-sm">
        <button
          onClick={() => setSide("BUY")}
          className={cn(
            "py-2 rounded-sm font-bold transition-colors text-xs",
            side === "BUY" ? "bg-green-500 text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Long
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={cn(
            "py-2 rounded-sm font-bold transition-colors text-xs",
            side === "SELL" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Short
        </button>
      </div>

      {/* Order type */}
      <div className="flex gap-2">
        {(["MARKET", "LIMIT"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              "text-[11px] font-medium pb-0.5 border-b-2 transition-colors",
              orderType === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Leverage */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-muted-foreground">Leverage</span>
          <span className="font-bold text-primary">{leverage}x</span>
        </div>
        <Slider
          value={[leverage]}
          onValueChange={([v]) => setLeverage(v)}
          min={1}
          max={maxLeverage}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>1x</span>
          <span>{maxLeverage}x</span>
        </div>
      </div>

      {/* Price (limit only) */}
      {orderType === "LIMIT" && (
        <div>
          <label className="text-muted-foreground mb-1 block">Price (USDC)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={currentPrice.toString()}
            className="w-full px-2.5 py-2 bg-secondary border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs tabular-nums"
          />
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="text-muted-foreground mb-1 block">
          Size ({market?.baseAsset || "—"})
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0.00"
          className="w-full px-2.5 py-2 bg-secondary border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs tabular-nums"
        />
      </div>

      {/* Quick size buttons */}
      <div className="grid grid-cols-4 gap-1">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            onClick={() => handleQuickSize(pct)}
            className="py-1 text-[10px] font-medium rounded-sm bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border border-border/50"
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Order value */}
      {quantity && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Est. Value</span>
          <span className="text-foreground tabular-nums">
            ${(parseFloat(quantity || "0") * effectivePrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !quantity || parseFloat(quantity) <= 0}
        className={cn(
          "w-full py-2.5 rounded-sm font-bold text-xs transition-colors disabled:opacity-40",
          side === "BUY"
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
        )}
      >
        {submitting ? "Placing..." : `${side === "BUY" ? "Long" : "Short"} ${market?.baseAsset || ""}`}
      </button>

      {/* Market info */}
      {market && (
        <div className="space-y-1 pt-2 border-t border-border">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Mark Price</span>
            <span className="text-foreground tabular-nums">${parseFloat(market.markPrice).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Funding Rate</span>
            <span className={cn(parseFloat(market.fundingRate) >= 0 ? "text-green-400" : "text-red-400")}>
              {(parseFloat(market.fundingRate) * 100).toFixed(4)}%
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">24h Volume</span>
            <span className="text-foreground tabular-nums">${parseFloat(market.quoteVolume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Open Interest</span>
            <span className="text-foreground tabular-nums">${parseFloat(market.openInterest).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
