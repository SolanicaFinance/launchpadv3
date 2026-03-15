import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Repeat, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { VersionedTransaction } from "@solana/web3.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface SwapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "form" | "swapping" | "success" | "error";

export default function SwapModal({ open, onOpenChange }: SwapModalProps) {
  const { getQuote, executeSwap, isLoading } = useJupiterSwap();
  const { signAndSendTransaction, walletAddress } = useSolanaWalletWithPrivy();

  const [inputMint, setInputMint] = useState(SOL_MINT);
  const [outputMint, setOutputMint] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [txSig, setTxSig] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [quotePreview, setQuotePreview] = useState<{ outAmount: string; priceImpact: string } | null>(null);

  const handleGetQuote = useCallback(async () => {
    if (!outputMint || !amount || parseFloat(amount) <= 0) return;
    setQuotePreview(null);
    const quote = await getQuote(inputMint, outputMint, parseFloat(amount));
    if (quote) {
      setQuotePreview({
        outAmount: (parseInt(quote.outAmount) / 1e9).toFixed(6),
        priceImpact: quote.priceImpactPct,
      });
    } else {
      setErrorMsg("No swap route found for this token. It may only be tradeable on its bonding curve.");
      setStep("error");
    }
  }, [inputMint, outputMint, amount, getQuote]);

  const handleSwap = useCallback(async () => {
    if (!walletAddress || !outputMint || !amount) return;
    setStep("swapping");

    try {
      const signAndSendTx = async (tx: VersionedTransaction) => {
        return signAndSendTransaction(tx);
      };

      const result = await executeSwap(inputMint, outputMint, parseFloat(amount), walletAddress, 9, 500, signAndSendTx);

      if (result.success && result.signature) {
        setTxSig(result.signature);
        setStep("success");
      } else {
        throw new Error("Swap failed");
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Swap failed");
      setStep("error");
    }
  }, [walletAddress, inputMint, outputMint, amount, executeSwap, signAndSendTransaction]);

  const handleReset = () => {
    setStep("form");
    setQuotePreview(null);
    setTxSig("");
    setErrorMsg("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) handleReset(); }}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            Swap Tokens
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">From (Mint)</label>
              <Input
                value={inputMint}
                onChange={(e) => setInputMint(e.target.value.trim())}
                placeholder="SOL mint address"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">To (Mint)</label>
              <Input
                value={outputMint}
                onChange={(e) => setOutputMint(e.target.value.trim())}
                placeholder="Output token mint"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono text-xs"
                step="any"
              />
            </div>

            {quotePreview && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Estimated Output</span>
                  <span className="font-mono text-foreground">{quotePreview.outAmount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className="font-mono text-foreground">{parseFloat(quotePreview.priceImpact).toFixed(3)}%</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleGetQuote}
                disabled={!outputMint || !amount || isLoading}
                className="flex-1 h-10 rounded-xl text-xs"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Get Quote"}
              </Button>
              <Button
                onClick={handleSwap}
                disabled={!outputMint || !amount || parseFloat(amount) <= 0}
                className="flex-1 h-10 rounded-xl font-bold text-sm"
              >
                Swap
              </Button>
            </div>
          </div>
        )}

        {step === "swapping" && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Executing swap…</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-bold text-foreground">Swap Complete!</p>
            <a
              href={`https://solscan.io/tx/${txSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline font-mono"
            >
              {txSig.slice(0, 12)}…{txSig.slice(-8)}
            </a>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="mt-2 rounded-xl text-xs">
              Close
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-bold text-destructive">Swap Failed</p>
            <p className="text-[11px] text-muted-foreground text-center">{errorMsg}</p>
            <Button onClick={handleReset} variant="outline" className="mt-2 rounded-xl text-xs">
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
