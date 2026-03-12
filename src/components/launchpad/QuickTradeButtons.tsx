import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Token, formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealSwap } from "@/hooks/useRealSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";

interface QuickTradeButtonsProps {
  token: Token;
  userBalance?: number;
  onTradeComplete?: () => void;
}

const QUICK_BUY_AMOUNTS = [0.1, 0.5, 1, 5];
const QUICK_SELL_PERCENTAGES = [25, 50, 75, 100];

export function QuickTradeButtons({ token, userBalance = 0, onTradeComplete }: QuickTradeButtonsProps) {
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { executeRealSwap } = useRealSwap();
  const { getTokenBalance } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [onChainTokenBalance, setOnChainTokenBalance] = useState<number | null>(null);

  const isGraduated = token.status === 'graduated';

  // Fetch on-chain token balance for display
  useEffect(() => {
    if (isAuthenticated && solanaAddress && token.mint_address && tradeType === 'sell') {
      getTokenBalance(token.mint_address)
        .then(bal => setOnChainTokenBalance(bal))
        .catch(() => setOnChainTokenBalance(null));
    }
  }, [isAuthenticated, solanaAddress, token.mint_address, getTokenBalance, tradeType]);

  const displayBalance = (onChainTokenBalance !== null && onChainTokenBalance > 0) ? onChainTokenBalance : userBalance;

  const handleQuickBuy = async (solAmount: number, index: number) => {
    if (!isAuthenticated) {
      login();
      return;
    }

    if (!solanaAddress) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }

    setLoadingIndex(index);
    try {
      const result = await executeRealSwap(token, solAmount, true);

      toast({
        title: "Buy successful!",
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>Bought {token.ticker} for {solAmount} SOL</span>
            {result.signature && (
              <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View TX ↗
              </a>
            )}
          </div>
        ),
      });

      if (result.graduated) {
        toast({
          title: "🎓 Token Graduated!",
          description: "This token has reached the graduation threshold!",
        });
      }

      onTradeComplete?.();
    } catch (error) {
      console.error('Quick buy error:', error);
      toast({
        title: "Trade failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingIndex(null);
    }
  };

  const handleQuickSell = async (percentage: number, index: number) => {
    if (!isAuthenticated) {
      login();
      return;
    }

    if (!solanaAddress) {
      toast({ title: "Please connect your wallet", variant: "destructive" });
      return;
    }

    setLoadingIndex(index + 10);

    try {
      // Fetch real on-chain balance instead of using stale DB value
      let onChainBalance = 0;
      try {
        onChainBalance = await getTokenBalance(token.mint_address);
      } catch (e) {
        console.warn("[QuickSell] Failed to fetch on-chain balance, falling back to DB:", e);
      }

      const effectiveBalance = onChainBalance > 0 ? onChainBalance : userBalance;
      console.log(`[QuickSell] DB balance: ${userBalance}, On-chain balance: ${onChainBalance}, Using: ${effectiveBalance}`);

      const tokenAmount = (effectiveBalance * percentage) / 100;
      if (tokenAmount <= 0) {
        toast({ title: "No tokens to sell", variant: "destructive" });
        setLoadingIndex(null);
        return;
      }
      const result = await executeRealSwap(token, tokenAmount, false);

      toast({
        title: "Sell successful!",
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>Sold {formatTokenAmount(tokenAmount)} {token.ticker}</span>
            {result.signature && (
              <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View TX ↗
              </a>
            )}
          </div>
        ),
      });

      onTradeComplete?.();
    } catch (error) {
      console.error('Quick sell error:', error);
      toast({
        title: "Trade failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingIndex(null);
    }
  };

  if (isGraduated) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Trade Type Toggle */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 h-8",
            tradeType === 'buy' && "bg-green-500/20 text-green-500 hover:bg-green-500/30"
          )}
          onClick={() => setTradeType('buy')}
        >
          <Zap className="h-3.5 w-3.5 mr-1" />
          Quick Buy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex-1 h-8",
            tradeType === 'sell' && "bg-red-500/20 text-red-500 hover:bg-red-500/30"
          )}
          onClick={() => setTradeType('sell')}
        >
          <Zap className="h-3.5 w-3.5 mr-1" />
          Quick Sell
        </Button>
      </div>

      {/* Quick Trade Buttons */}
      {tradeType === 'buy' ? (
        <div className="grid grid-cols-4 gap-2">
          {QUICK_BUY_AMOUNTS.map((amount, index) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              className="h-12 flex-col gap-0.5 hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-500"
              onClick={() => handleQuickBuy(amount, index)}
              disabled={loadingIndex !== null}
            >
              {loadingIndex === index ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="font-bold">{amount}</span>
                  <span className="text-[10px] text-muted-foreground">SOL</span>
                </>
              )}
            </Button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {QUICK_SELL_PERCENTAGES.map((percentage, index) => (
            <Button
              key={percentage}
              variant="outline"
              size="sm"
              className="h-12 flex-col gap-0.5 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500"
              onClick={() => handleQuickSell(percentage, index)}
              disabled={loadingIndex !== null || displayBalance <= 0}
            >
              {loadingIndex === index + 10 ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="font-bold">{percentage}%</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTokenAmount((displayBalance * percentage) / 100)}
                  </span>
                </>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Balance Info */}
      {tradeType === 'sell' && (
        <p className="text-xs text-center text-muted-foreground">
          Balance: {formatTokenAmount(displayBalance)} {token.ticker}
        </p>
      )}
    </div>
  );
}
