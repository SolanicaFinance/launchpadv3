import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { toast } from "@/hooks/use-toast";

interface SendTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMint?: string;
  preselectedSymbol?: string;
  preselectedBalance?: number;
  preselectedDecimals?: number;
}

type Step = "form" | "confirm" | "sending" | "success" | "error";

const RECENT_KEY = "moondexo-recent-addresses";
function getRecentAddresses(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5);
  } catch {
    return [];
  }
}
function saveRecentAddress(addr: string) {
  const list = getRecentAddresses().filter((a) => a !== addr);
  list.unshift(addr);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
}

export default function SendTokenModal({
  open,
  onOpenChange,
  preselectedMint = "SOL",
  preselectedSymbol = "SOL",
  preselectedBalance = 0,
  preselectedDecimals = 9,
}: SendTokenModalProps) {
  const { signAndSendTransaction, walletAddress } = useSolanaWalletWithPrivy();
  const [step, setStep] = useState<Step>("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txSig, setTxSig] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const recentAddresses = getRecentAddresses();

  useEffect(() => {
    if (open) {
      setStep("form");
      setRecipient("");
      setAmount("");
      setTxSig("");
      setErrorMsg("");
    }
  }, [open]);

  const isSOL = preselectedMint === "SOL";
  const amountNum = parseFloat(amount) || 0;
  const isValidAddress = (() => {
    try {
      new PublicKey(recipient);
      return recipient.length >= 32;
    } catch {
      return false;
    }
  })();
  const isValidAmount = amountNum > 0 && amountNum <= preselectedBalance;
  const canConfirm = isValidAddress && isValidAmount;

  const handleSend = useCallback(async () => {
    if (!walletAddress || !canConfirm) return;
    setStep("sending");

    try {
      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey = new PublicKey(recipient);

      const tx = new Transaction();
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = fromPubkey;

      if (isSOL) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
          })
        );
      } else {
        const mintPubkey = new PublicKey(preselectedMint);
        const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
        const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

        // Check if recipient ATA exists
        const toAtaInfo = await connection.getAccountInfo(toAta);
        if (!toAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(fromPubkey, toAta, toPubkey, mintPubkey)
          );
        }

        const rawAmount = Math.floor(amountNum * 10 ** preselectedDecimals);
        tx.add(
          createTransferInstruction(fromAta, toAta, fromPubkey, BigInt(rawAmount), [], TOKEN_PROGRAM_ID)
        );
      }

      const result = await signAndSendTransaction(tx);
      setTxSig(result.signature);
      saveRecentAddress(recipient);
      setStep("success");
      toast({ title: "Sent!", description: `${amountNum} ${preselectedSymbol} sent successfully` });
    } catch (e: any) {
      console.error("Send error:", e);
      setErrorMsg(e?.message || "Transaction failed");
      setStep("error");
    }
  }, [walletAddress, canConfirm, recipient, amountNum, isSOL, preselectedMint, preselectedDecimals, preselectedSymbol, signAndSendTransaction]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            Send {preselectedSymbol}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 pt-2">
            {/* Recipient */}
            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Recipient</label>
              <Input
                placeholder="Solana address…"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                className="font-mono text-xs"
              />
              {recentAddresses.length > 0 && !recipient && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {recentAddresses.map((addr) => (
                    <button
                      key={addr}
                      onClick={() => setRecipient(addr)}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md bg-muted/50 hover:bg-muted transition-colors font-mono"
                    >
                      {addr.slice(0, 4)}…{addr.slice(-4)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16 font-mono text-xs"
                  step="any"
                />
                <button
                  onClick={() => setAmount(String(isSOL ? Math.max(0, preselectedBalance - 0.005) : preselectedBalance))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  MAX
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Balance: {preselectedBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {preselectedSymbol}
              </p>
            </div>

            <Button
              onClick={() => setStep("confirm")}
              disabled={!canConfirm}
              className="w-full h-10 rounded-xl font-bold text-sm"
              style={{ background: canConfirm ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))" : undefined }}
            >
              Review
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-foreground">{recipient.slice(0, 6)}…{recipient.slice(-4)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-bold text-foreground">{amountNum} {preselectedSymbol}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="font-mono text-muted-foreground">~0.000005 SOL</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("form")} className="flex-1 h-10 rounded-xl text-xs">
                Back
              </Button>
              <Button onClick={handleSend} className="flex-1 h-10 rounded-xl font-bold text-sm">
                Confirm & Send
              </Button>
            </div>
          </div>
        )}

        {step === "sending" && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Signing & sending…</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <p className="text-sm font-bold text-foreground">Transaction Sent!</p>
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
            <p className="text-sm font-bold text-destructive">Failed</p>
            <p className="text-[11px] text-muted-foreground text-center max-w-[280px]">{errorMsg}</p>
            <Button onClick={() => setStep("form")} variant="outline" className="mt-2 rounded-xl text-xs">
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
