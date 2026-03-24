import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowUpFromLine, ExternalLink, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface BtcWithdrawPanelProps {
  walletAddress: string;
  currentBalance: number;
}

export function BtcWithdrawPanel({ walletAddress, currentBalance }: BtcWithdrawPanelProps) {
  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const queryClient = useQueryClient();

  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid BTC amount");
      return;
    }
    if (numAmount > currentBalance) {
      toast.error("Amount exceeds your balance");
      return;
    }
    if (numAmount < 0.00005) {
      toast.error("Minimum withdrawal is 0.00005 BTC (5,000 sats)");
      return;
    }

    // Two-step confirmation
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setWithdrawing(true);
    setLastTxid(null);
    setConfirmStep(false);
    try {
      const { data, error } = await supabase.functions.invoke("btc-withdraw", {
        body: { walletAddress, amountBtc: numAmount },
      });
      if (error) {
        const msg = data?.error || error.message || "Withdrawal failed";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      setLastTxid(data.txid);
      toast.success("Withdrawal sent!", {
        description: `${numAmount} BTC → your wallet. Confirms in ~10-30 min.`,
      });
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["btc-trading-balance"] });
      queryClient.invalidateQueries({ queryKey: ["btc-onchain-balance"] });
    } catch (e: any) {
      toast.error(e.message || "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  const cancelConfirm = () => {
    setConfirmStep(false);
  };

  const setMax = () => {
    const max = Math.max(0, currentBalance - 0.00001);
    setAmount(max > 0 ? max.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") : "0");
    setConfirmStep(false);
  };

  if (currentBalance <= 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowUpFromLine className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-bold text-foreground">Withdraw BTC</h3>
      </div>

      <div className="bg-muted/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase">Available</span>
          <span className="text-sm font-mono font-bold text-foreground">{currentBalance.toFixed(8)} BTC</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Amount (BTC)</span>
          <button onClick={setMax} className="text-primary hover:text-primary/80 underline font-semibold">Max</button>
        </div>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="0.0005"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setConfirmStep(false); }}
          className="font-mono"
          disabled={withdrawing}
        />
      </div>

      {confirmStep ? (
        <div className="space-y-2">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-center">
            <ShieldCheck className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-xs font-semibold text-destructive">
              Confirm withdrawal of {parseFloat(amount).toFixed(8)} BTC?
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              This will send real BTC to your wallet. This action cannot be undone.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={cancelConfirm} variant="outline" size="sm" disabled={withdrawing}>
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="bg-destructive hover:bg-destructive/90 text-white"
              size="sm"
            >
              {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Send"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleWithdraw}
          disabled={withdrawing || !amount}
          className="w-full bg-destructive hover:bg-destructive/90 text-white"
          size="sm"
        >
          {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Withdraw to Wallet"}
        </Button>
      )}

      {lastTxid && (
        <a
          href={`https://mempool.space/tx/${lastTxid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View on mempool.space ↗
        </a>
      )}

      <p className="text-[9px] text-muted-foreground text-center">
        Real BTC on-chain withdrawal. Min: 5,000 sats · Max: 3/hr · 60s cooldown
      </p>
    </div>
  );
}
