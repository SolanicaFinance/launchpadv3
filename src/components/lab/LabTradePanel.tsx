import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getQuote, type LabPool, type LabTrade } from "@/lib/saturn-curve";
import { ArrowDownUp, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pools: LabPool[];
  trades: LabTrade[];
  onTradeExecuted: () => void;
}

export function LabTradePanel({ pools, trades, onTradeExecuted }: Props) {
  const [selectedPoolId, setSelectedPoolId] = useState<string>(pools[0]?.id || "");
  const [isBuy, setIsBuy] = useState(true);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [loading, setLoading] = useState(false);

  const pool = pools.find((p) => p.id === selectedPoolId);
  const amountNum = parseFloat(amount) || 0;

  const quote = pool && amountNum > 0 ? getQuote(pool, amountNum, isBuy) : null;

  const poolTrades = trades.filter((t) => t.pool_id === selectedPoolId).slice(0, 20);

  async function handleSwap() {
    if (!pool || amountNum <= 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("saturn-curve-swap", {
        body: {
          pool_id: pool.id,
          is_buy: isBuy,
          amount: amountNum,
          slippage_bps: slippage * 100,
          wallet_address: "LAB_TEST_WALLET",
        },
      });
      if (error) throw error;
      toast.success(`${isBuy ? "Bought" : "Sold"} successfully!`);
      setAmount("");
      onTradeExecuted();
    } catch (e: any) {
      toast.error(e.message || "Swap failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trade Form */}
      <div className="space-y-4">
        <div className="p-4 rounded-lg border border-border bg-card space-y-4">
          {/* Pool Selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Select Pool</Label>
            <select
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              className="w-full h-11 rounded-[10px] border border-border bg-secondary/50 px-4 text-sm text-foreground"
            >
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ticker}) — {p.status}
                </option>
              ))}
              {pools.length === 0 && <option disabled>No pools created yet</option>}
            </select>
          </div>

          {/* Buy/Sell Toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setIsBuy(true)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                isBuy ? "bg-green-500/20 text-green-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3 w-3 inline mr-1" /> Buy
            </button>
            <button
              onClick={() => setIsBuy(false)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                !isBuy ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingDown className="h-3 w-3 inline mr-1" /> Sell
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {isBuy ? "SOL Amount" : "Token Amount"}
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={isBuy ? "0.1" : "1000000"}
              min="0"
              step="any"
            />
          </div>

          {/* Slippage */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Slippage: {slippage}%</Label>
            <div className="flex gap-2">
              {[0.5, 1, 2, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md border transition-all",
                    slippage === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Quote Preview */}
          {quote && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">You receive</span>
                <span className="text-foreground font-mono">
                  {isBuy
                    ? `${quote.amountOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens`
                    : `${quote.amountOut.toFixed(6)} SOL`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price impact</span>
                <span className={cn("font-mono", quote.priceImpact > 5 ? "text-red-400" : "text-foreground")}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="text-foreground font-mono">{quote.fee.toFixed(6)} SOL</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSwap}
            disabled={loading || !pool || amountNum <= 0 || pool.status === "graduated"}
            className={cn("w-full", isBuy ? "btn-gradient-green" : "bg-red-500/80 hover:bg-red-500")}
          >
            {loading ? "Processing..." : pool?.status === "graduated" ? "Pool Graduated" : isBuy ? "Buy Tokens" : "Sell Tokens"}
          </Button>
        </div>
      </div>

      {/* Trade History */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-primary" />
          Trade History
        </h4>
        {poolTrades.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trades yet. Create a pool and start trading.</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {poolTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium", t.is_buy ? "text-green-400" : "text-red-400")}>
                    {t.is_buy ? "BUY" : "SELL"}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {t.wallet_address.slice(0, 6)}...
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-foreground font-mono">{t.sol_amount.toFixed(4)} SOL</div>
                  <div className="text-muted-foreground">{t.token_amount.toLocaleString()} tokens</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
