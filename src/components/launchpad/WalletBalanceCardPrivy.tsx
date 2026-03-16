import { useEffect, useState } from "react";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { Button } from "@/components/ui/button";
import { Wallet, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletBalanceCardPrivyProps {
  minRequired?: number;
  className?: string;
}

// Component that uses Privy wallet hooks - ONLY rendered when privyAvailable is true
export default function WalletBalanceCardPrivy({ minRequired, className = "" }: WalletBalanceCardPrivyProps) {
  const { walletAddress: defaultWalletAddress, isWalletReady, getBalance, getBalanceStrict } = useSolanaWalletWithPrivy();
  const { activeAddress, activeWallet, refreshBalances } = useMultiWallet();
  // Use the multi-wallet active address (respects rotation/switch), fallback to default
  const walletAddress = activeAddress || defaultWalletAddress;
  const { toast } = useToast();

  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Sync balance from multi-wallet if available
  useEffect(() => {
    if (activeWallet?.balance !== null && activeWallet?.balance !== undefined) {
      setBalance(activeWallet.balance);
    }
  }, [activeWallet?.balance]);

  const fetchBalance = async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    setBalanceError(null);

    try {
      // If multi-wallet has refreshBalances, use it for the active wallet
      if (refreshBalances) {
        await refreshBalances();
      } else {
        const bal = getBalanceStrict ? await getBalanceStrict() : await getBalance();
        setBalance(bal);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to fetch balance";
      setBalanceError(msg);
      console.error("Failed to fetch balance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch balance on mount and every 10 seconds
  useEffect(() => {
    if (!walletAddress) return;

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const handleCopy = async () => {
    if (!walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const hasEnough = minRequired === undefined || (balance !== null && balance >= minRequired);

  // Loading / missing-wallet state
  if (!walletAddress) {
    return (
      <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm">Embedded Wallet</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-8 bg-muted/50 rounded animate-pulse" />
          <div className="h-9 bg-muted/50 rounded animate-pulse" />
        </div>

        <p className="text-xs mt-3 text-muted-foreground">Loading your embedded Solana wallet…</p>
      </div>
    );
  }

  return (
    <div className={`bg-secondary/50 rounded-xl p-4 border border-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-sm">Embedded Wallet</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchBalance} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Address & Actions */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-background/50 rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground truncate">
          {truncateAddress(walletAddress)}
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Balance */}
      <div className="mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {isLoading ? (
              <span className="inline-block h-8 w-20 bg-muted/50 rounded animate-pulse" />
            ) : balance !== null ? (
              balance.toFixed(4)
            ) : (
              "0.0000"
            )}
          </span>
          <span className="text-muted-foreground font-medium">SOL</span>
        </div>

        {balanceError && <p className="text-xs mt-1 text-destructive">{balanceError}</p>}

        {minRequired !== undefined && (
          <p className={`text-xs mt-1 ${hasEnough ? "text-muted-foreground" : "text-destructive"}`}>
            {hasEnough ? `✓ Sufficient for launch (min ${minRequired} SOL)` : `⚠ Need at least ${minRequired} SOL to launch`}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Copy your address above to send SOL from an exchange or another wallet</p>
    </div>
  );
}
