import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Loader2, CheckCircle2, AlertCircle, ExternalLink, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendResult {
  success: boolean;
  signature?: string;
  error?: string;
  from?: string;
  to?: string;
  amountSol?: number;
  solscanUrl?: string;
}

const ADMIN_SECRET = "claw-treasury-2024";

export default function ServerSendPanel({ walletAddress }: { walletAddress: string | null }) {
  const [fromWallet, setFromWallet] = useState(walletAddress || "");
  const [toWallet, setToWallet] = useState("");
  const [amountSol, setAmountSol] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [fromBalance, setFromBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch balance when fromWallet changes (debounced)
  useEffect(() => {
    if (!fromWallet || fromWallet.length < 32) {
      setFromBalance(null);
      return;
    }

    let cancelled = false;
    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        const { data } = await supabase.functions.invoke("fetch-sol-balances", {
          body: { wallets: [fromWallet.trim()] },
        });
        if (!cancelled && data?.balances) {
          setFromBalance(data.balances[fromWallet.trim()] ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    };

    const timeout = setTimeout(fetchBalance, 400);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [fromWallet]);

  const handleSend = async () => {
    if (!fromWallet || !toWallet || !amountSol) {
      toast.error("All fields required");
      return;
    }

    const amount = parseFloat(amountSol);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("server-send", {
        body: {
          walletAddress: fromWallet.trim(),
          toAddress: toWallet.trim(),
          amountSol: amount,
          adminSecret: ADMIN_SECRET,
        },
      });

      if (error) {
        setResult({ success: false, error: error.message });
        toast.error("Send failed: " + error.message);
      } else if (data?.error) {
        setResult({ success: false, error: data.error });
        toast.error("Send failed: " + data.error);
      } else {
        setResult(data as SendResult);
        toast.success(`Sent ${amount} SOL → ${toWallet.slice(0, 8)}...`);
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message || "Unknown error" });
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Send className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black font-mono uppercase tracking-wider text-foreground">
          Server-Side Send
        </h3>
        <span className="text-[10px] font-mono bg-destructive/20 text-destructive px-2 py-0.5 rounded">
          ADMIN
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
        Send SOL server-side via Privy without client popup.
      </p>

      <div className="space-y-3">
        <div>
          <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">From Wallet</Label>
          <Input
            value={fromWallet}
            onChange={(e) => setFromWallet(e.target.value)}
            placeholder="Sender wallet address"
            className="font-mono text-xs mt-1 bg-background border-border/40 rounded-sm"
          />
          {fromWallet.length >= 32 && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Wallet className="h-3 w-3 text-muted-foreground" />
              {loadingBalance ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : fromBalance !== null ? (
                <span className="text-[11px] font-mono text-primary font-bold">
                  {fromBalance.toFixed(4)} SOL
                </span>
              ) : (
                <span className="text-[11px] font-mono text-muted-foreground">—</span>
              )}
            </div>
          )}
        </div>

        <div>
          <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">To Wallet</Label>
          <Input
            value={toWallet}
            onChange={(e) => setToWallet(e.target.value)}
            placeholder="Recipient wallet address"
            className="font-mono text-xs mt-1 bg-background border-border/40 rounded-sm"
          />
        </div>

        <div>
          <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Amount (SOL)</Label>
          <Input
            value={amountSol}
            onChange={(e) => setAmountSol(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.001"
            min="0"
            className="font-mono text-xs mt-1 bg-background border-border/40 rounded-sm"
          />
          {fromBalance !== null && (
            <button
              type="button"
              onClick={() => setAmountSol(Math.max(0, fromBalance - 0.005).toFixed(4))}
              className="text-[10px] font-mono text-primary hover:underline mt-1"
            >
              MAX ({Math.max(0, fromBalance - 0.005).toFixed(4)})
            </button>
          )}
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !fromWallet || !toWallet || !amountSol}
          className="w-full h-10 font-mono uppercase tracking-wider text-xs font-bold rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Execute Server Send
            </>
          )}
        </Button>
      </div>

      {result && (
        <div
          className={`rounded-sm border p-3 font-mono text-xs space-y-2 ${
            result.success
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            )}
            <span className={`font-bold uppercase ${result.success ? "text-primary" : "text-destructive"}`}>
              {result.success ? "Success" : "Failed"}
            </span>
          </div>

          {result.error && (
            <p className="text-destructive/80 break-all">{result.error}</p>
          )}

          {result.signature && (
            <div className="space-y-1">
              <p className="text-muted-foreground">
                <span className="text-foreground">From:</span> {result.from?.slice(0, 8)}...{result.from?.slice(-4)}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground">To:</span> {result.to?.slice(0, 8)}...{result.to?.slice(-4)}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground">Amount:</span> {result.amountSol} SOL
              </p>
              <p className="text-muted-foreground break-all">
                <span className="text-foreground">Sig:</span> {result.signature.slice(0, 20)}...{result.signature.slice(-8)}
              </p>
              {result.solscanUrl && (
                <a
                  href={result.solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                >
                  View on Solscan <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
