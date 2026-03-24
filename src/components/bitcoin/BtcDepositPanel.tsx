import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Wallet, Copy, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface BtcDepositPanelProps {
  walletAddress: string;
  currentBalance: number;
}

export function BtcDepositPanel({ walletAddress, currentBalance }: BtcDepositPanelProps) {
  const [amount, setAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid BTC amount");
      return;
    }

    setDepositing(true);
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-deposit", {
        body: { walletAddress, amountBtc: numAmount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Deposited ${numAmount} BTC successfully`);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["btc-trading-balance"] });
    } catch (e: any) {
      toast.error(e.message || "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success("Wallet address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Deposit BTC</h3>
      </div>

      <div className="bg-muted/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase">Your Balance</span>
          <span className="text-sm font-mono font-bold text-foreground">{currentBalance.toFixed(8)} BTC</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wallet className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{walletAddress}</span>
          <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3 h-3 text-[hsl(var(--success))]" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-muted-foreground mb-1">Amount (BTC)</div>
        <Input
          type="number"
          step="any"
          min="0"
          placeholder="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-mono"
        />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {[0.0001, 0.001, 0.01, 0.1].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            className="text-[10px] py-1 rounded bg-muted/50 hover:bg-muted text-foreground font-mono transition-colors"
          >
            {v} ₿
          </button>
        ))}
      </div>

      <Button
        onClick={handleDeposit}
        disabled={depositing || !amount}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        size="sm"
      >
        {depositing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deposit BTC"}
      </Button>

      <p className="text-[9px] text-muted-foreground text-center">
        Send BTC from UniSat or any wallet. Balance updates instantly.
      </p>
    </div>
  );
}
