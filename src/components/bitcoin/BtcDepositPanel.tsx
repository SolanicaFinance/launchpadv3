import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface BtcDepositPanelProps {
  walletAddress: string;
  currentBalance: number;
}

export function BtcDepositPanel({ walletAddress, currentBalance }: BtcDepositPanelProps) {
  const [txid, setTxid] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch platform deposit address on mount
  useEffect(() => {
    supabase.functions.invoke("btc-meme-deposit", { body: {} })
      .then(({ data }) => {
        if (data?.depositAddress) setDepositAddress(data.depositAddress);
      })
      .catch(() => {});
  }, []);

  const handleVerifyDeposit = async () => {
    const cleanTxid = txid.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(cleanTxid)) {
      toast.error("Enter a valid 64-character transaction ID");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-deposit", {
        body: { walletAddress, txid: cleanTxid },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Verified! ${data.credited} BTC credited to your balance`);
      setTxid("");
      queryClient.invalidateQueries({ queryKey: ["btc-trading-balance"] });
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const copyDepositAddress = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    toast.success("Deposit address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Deposit BTC</h3>
      </div>

      {/* Current balance + deposit address */}
      <div className="bg-muted/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase">Your Balance</span>
          <span className="text-sm font-mono font-bold text-foreground">{currentBalance.toFixed(8)} BTC</span>
        </div>

        <div className="border-t border-border/50 pt-2">
          <span className="text-[10px] text-muted-foreground uppercase">Step 1: Send BTC to this address</span>
          {depositAddress ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-mono text-primary truncate flex-1">{depositAddress}</span>
              <button onClick={copyDepositAddress} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                {copied ? <Check className="w-3 h-3 text-[hsl(var(--chart-2))]" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground mt-1">Loading deposit address...</div>
          )}
        </div>
      </div>

      {/* Step 2: Submit txid */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1">Step 2: Paste your transaction ID</div>
        <Input
          type="text"
          placeholder="e.g. a1b2c3d4e5f6..."
          value={txid}
          onChange={(e) => setTxid(e.target.value)}
          className="font-mono text-xs"
          maxLength={64}
        />
        <p className="text-[9px] text-muted-foreground mt-1">
          Find your txid in your wallet history or on{" "}
          <a href="https://mempool.space" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
            mempool.space <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </p>
      </div>

      <Button
        onClick={handleVerifyDeposit}
        disabled={verifying || txid.trim().length !== 64}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        size="sm"
      >
        {verifying ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Verifying on-chain...</>
        ) : (
          <><ShieldCheck className="w-4 h-4 mr-1.5" /> Verify &amp; Credit Deposit</>
        )}
      </Button>

      <div className="flex items-start gap-1.5 bg-muted/10 rounded p-2">
        <ShieldCheck className="w-3 h-3 text-[hsl(var(--chart-2))] shrink-0 mt-0.5" />
        <p className="text-[9px] text-muted-foreground leading-tight">
          Deposits are verified on-chain via mempool.space. Requires ≥1 confirmation. Each tx can only be claimed once.
        </p>
      </div>
    </div>
  );
}
