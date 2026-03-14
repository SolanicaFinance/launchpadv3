import { useState, useEffect, useCallback, useRef } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { Copy, Check, Loader2 } from "lucide-react";

interface LaunchpadDepositPromptProps {
  walletAddress: string;
  onReady: () => void;
  minSol?: number;
}

export function LaunchpadDepositPrompt({ walletAddress, onReady, minSol = 0.05 }: LaunchpadDepositPromptProps) {
  const [balance, setBalance] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const initialBalanceRef = useRef<number | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const { url } = getRpcUrl();
      const connection = new Connection(url, "confirmed");
      const lamports = await connection.getBalance(new PublicKey(walletAddress));
      const sol = lamports / LAMPORTS_PER_SOL;
      setBalance(sol);

      if (initialBalanceRef.current === null) {
        initialBalanceRef.current = sol;
      }

      if (sol >= minSol) {
        setIsReady(true);
        onReady();
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch (e) {
      console.error("[DepositPrompt] Balance fetch error:", e);
    }
  }, [walletAddress, minSol, onReady]);

  useEffect(() => {
    fetchBalance();
    pollRef.current = setInterval(fetchBalance, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchBalance]);

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isReady) {
    return (
      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-2">
        <div className="text-2xl">✅</div>
        <p className="text-sm font-semibold text-primary">Ready to Launch!</p>
        <p className="text-xs text-muted-foreground">{balance.toFixed(4)} SOL available</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs font-semibold text-foreground">Fund Your Wallet</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Send at least <span className="font-bold text-foreground">{minSol} SOL</span> to the address below to launch your token.
      </p>
      <div
        onClick={handleCopy}
        className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/40 transition-colors"
      >
        <span className="text-[10px] font-mono text-foreground/80 flex-1 break-all select-all">
          {walletAddress}
        </span>
        {copied ? (
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Current balance:</span>
        <span className="font-mono text-foreground/70">{balance.toFixed(4)} SOL</span>
      </div>
      <div className="text-[9px] text-muted-foreground/60 text-center">
        Checking every 3 seconds...
      </div>
    </div>
  );
}
