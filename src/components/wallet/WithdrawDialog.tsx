import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpFromLine, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const { toast } = useToast();
  const { walletAddress, getBalance, signAndSendTransaction } = useSolanaWalletWithPrivy();
  const [recipient, setRecipient] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [mode, setMode] = useState<"all" | "custom">("all");

  useEffect(() => {
    if (!open || !walletAddress) return;
    setRecipient("");
    setCustomAmount("");
    setMode("all");
    getBalance().then(setBalance).catch(() => setBalance(null));
  }, [open, walletAddress]);

  const rentExempt = 0.00089; // ~rent-exempt minimum
  const txFee = 0.000005;
  const maxWithdrawable = balance !== null ? Math.max(balance - rentExempt - txFee, 0) : 0;
  const withdrawAmount = mode === "all" ? maxWithdrawable : Math.min(parseFloat(customAmount) || 0, maxWithdrawable);

  const isValidAddress = (() => {
    try {
      if (!recipient || recipient.length < 32) return false;
      new PublicKey(recipient);
      return true;
    } catch {
      return false;
    }
  })();

  const canSubmit = isValidAddress && withdrawAmount > 0 && !loading && recipient !== walletAddress;

  const handleWithdraw = async () => {
    if (!canSubmit || !walletAddress) return;
    setLoading(true);
    try {
      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");

      const lamports = Math.floor(withdrawAmount * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(recipient),
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(walletAddress);

      const result = await signAndSendTransaction(tx);

      toast({
        title: "Withdrawal sent!",
        description: `${withdrawAmount.toFixed(6)} SOL sent. Tx: ${result.signature.slice(0, 8)}...`,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error("[Withdraw] Error:", err);
      toast({
        title: "Withdrawal failed",
        description: err.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowUpFromLine className="w-5 h-5 text-primary" />
            Withdraw SOL
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Balance display */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">Available Balance</p>
            <p className="text-lg font-bold font-mono text-foreground">
              {balance !== null ? `${balance.toFixed(6)} SOL` : "Loading..."}
            </p>
            <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
              Max withdrawable: {maxWithdrawable.toFixed(6)} SOL
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/30 rounded-lg border border-border/30">
            <button
              onClick={() => setMode("all")}
              className={`py-2 rounded-md text-xs font-bold transition-colors ${
                mode === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Withdraw All
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`py-2 rounded-md text-xs font-bold transition-colors ${
                mode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom Amount
            </button>
          </div>

          {/* Custom amount input */}
          {mode === "custom" && (
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Amount (SOL)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={maxWithdrawable}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg bg-muted/40 border border-border/50 text-foreground font-mono text-sm focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => setCustomAmount(maxWithdrawable.toFixed(6))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary hover:text-primary/80"
                >
                  MAX
                </button>
              </div>
            </div>
          )}

          {/* Recipient address */}
          <div>
            <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Recipient Wallet Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              placeholder="Enter Solana wallet address"
              className="w-full px-3 py-2.5 rounded-lg bg-muted/40 border border-border/50 text-foreground font-mono text-sm focus:outline-none focus:border-primary/50"
            />
            {recipient && !isValidAddress && (
              <p className="text-[10px] text-destructive mt-1 font-mono">Invalid Solana address</p>
            )}
            {recipient === walletAddress && (
              <p className="text-[10px] text-destructive mt-1 font-mono">Cannot send to yourself</p>
            )}
          </div>

          {/* Summary */}
          {canSubmit && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Sending</span>
                <span className="text-foreground font-bold">{withdrawAmount.toFixed(6)} SOL</span>
              </div>
              <div className="flex justify-between text-xs font-mono mt-1">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground">{recipient.slice(0, 6)}...{recipient.slice(-4)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono mt-1">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="text-muted-foreground">~0.000005 SOL</span>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-400/80 leading-relaxed">
              Double-check the recipient address. Transactions on Solana are irreversible.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleWithdraw}
            disabled={!canSubmit}
            className="w-full py-3 rounded-lg font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              `Withdraw ${withdrawAmount > 0 ? withdrawAmount.toFixed(6) : ""} SOL`
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
