import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, ArrowDownToLine, ExternalLink } from "lucide-react";
import QRCode from "react-qr-code";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
  chain: "solana" | "bnb";
  getBalance?: () => Promise<number>;
}

async function fetchBnbBalance(address: string): Promise<number> {
  const res = await fetch("https://bsc-dataseed.binance.org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [address, "latest"],
      id: 1,
    }),
  });
  const data = await res.json();
  if (data?.result) {
    return Number(BigInt(data.result)) / 1e18;
  }
  return 0;
}

export function DepositDialog({ open, onOpenChange, address, chain, getBalance }: DepositDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [depositDetected, setDepositDetected] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const openingBalance = useRef<number | null>(null);

  const isBnb = chain === "bnb";
  const currencyLabel = isBnb ? "BNB" : "SOL";
  const chainLabel = isBnb ? "BNB Smart Chain (BEP-20)" : "Solana Network";
  const explorerUrl = isBnb
    ? `https://bscscan.com/address/${address}`
    : `https://solscan.io/account/${address}`;

  const pollBalance = useCallback(async () => {
    try {
      let bal: number;
      if (isBnb) {
        bal = await fetchBnbBalance(address);
      } else if (getBalance) {
        bal = await getBalance();
      } else {
        return;
      }
      setCurrentBalance(bal);
      if (openingBalance.current === null) {
        openingBalance.current = bal;
      } else if (bal > openingBalance.current + 0.0001) {
        setDepositDetected(true);
      }
    } catch {
      // ignore polling errors
    }
  }, [address, isBnb, getBalance]);

  useEffect(() => {
    if (!open || !address) return;
    setDepositDetected(false);
    openingBalance.current = null;
    setCurrentBalance(null);
    pollBalance();
    const interval = setInterval(pollBalance, 3000);
    return () => clearInterval(interval);
  }, [open, address, pollBalance]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(address);
    if (ok) {
      setCopied(true);
      toast({ title: "Address copied", description: `Send ${currencyLabel} to this address` });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/60 bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            Deposit {currencyLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          {/* Deposit detected banner */}
          {depositDetected && (
            <div className="w-full rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-center animate-in fade-in slide-in-from-top-2">
              <Check className="w-6 h-6 text-green-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-400">Deposit received!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Balance: {currentBalance?.toFixed(6)} {currencyLabel}
              </p>
            </div>
          )}

          {/* Chain label */}
          <div className="text-xs font-mono text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/30">
            {chainLabel}
          </div>

          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl shadow-lg">
            <QRCode value={address} size={180} level="M" />
          </div>

          {/* Address */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors group"
          >
            <span className="text-xs font-mono text-foreground truncate flex-1 text-left">
              {address}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
            )}
          </button>

          {/* Balance display */}
          {currentBalance !== null && !depositDetected && (
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Current Balance</p>
              <p className="text-lg font-bold font-mono text-foreground">
                {currentBalance.toFixed(6)} {currencyLabel}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 animate-pulse">
                Waiting for deposit...
              </p>
            </div>
          )}

          {/* Explorer link */}
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            View on {isBnb ? "BscScan" : "Solscan"}
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Warning */}
          <p className="text-[10px] text-destructive/70 text-center max-w-xs">
            Only send {currencyLabel} on {isBnb ? "BNB Smart Chain" : "Solana"} to this address. Sending other tokens or using wrong networks may result in loss.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
