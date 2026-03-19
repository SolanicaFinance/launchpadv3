import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Token, calculateBuyQuote, calculateSellQuote, formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDown, Loader2, Wallet, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";

interface TradePanelProps {
  token: Token;
  userBalance?: number;
  userSolBalance?: number;
  onTrade?: (type: 'buy' | 'sell', amount: number) => Promise<void>;
}

export function TradePanel({ token, userBalance = 0, userSolBalance = 0, onTrade }: TradePanelProps) {
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { getTokenBalance } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [onChainTokenBalance, setOnChainTokenBalance] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isBuy = tradeType === 'buy';
  const numericAmount = parseFloat(amount) || 0;
  const effectiveTokenBalance = (onChainTokenBalance !== null && onChainTokenBalance > 0) ? onChainTokenBalance : userBalance;

  // Fetch real on-chain token balance
  useEffect(() => {
    if (isAuthenticated && solanaAddress && token.mint_address) {
      getTokenBalance(token.mint_address)
        .then(bal => setOnChainTokenBalance(bal))
        .catch(() => setOnChainTokenBalance(null));
    }
  }, [isAuthenticated, solanaAddress, token.mint_address, getTokenBalance, isLoading]);

  // Calculate quote based on trade type
  const virtualSol = token.virtual_sol_reserves + token.real_sol_reserves;
  const virtualToken = token.virtual_token_reserves - token.real_token_reserves;
  
  const buyQuote = calculateBuyQuote(numericAmount, virtualSol, virtualToken);
  const sellQuote = calculateSellQuote(numericAmount, virtualSol, virtualToken);

  const outputAmount = isBuy ? buyQuote.tokensOut : sellQuote.solOut;
  const priceImpact = isBuy ? buyQuote.priceImpact : sellQuote.priceImpact;
  const newPrice = isBuy ? buyQuote.newPrice : sellQuote.newPrice;

  // Quick amount buttons
  const quickAmounts = isBuy
    ? [0.1, 0.5, 1, 5]
    : [25, 50, 75, 100]; // percentages for sell

  const handleQuickAmount = (value: number) => {
    if (isBuy) {
      setAmount(value.toString());
    } else {
      // Percentage of balance
      const tokenAmount = (effectiveTokenBalance * value) / 100;
      setAmount(tokenAmount.toString());
    }
  };

  const handleTrade = async () => {
    if (!numericAmount || numericAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    if (isBuy && numericAmount > userSolBalance) {
      toast({ title: "Insufficient SOL balance", variant: "destructive" });
      return;
    }

    if (!isBuy && numericAmount > effectiveTokenBalance) {
      toast({ title: "Insufficient token balance", variant: "destructive" });
      return;
    }

    if (!onTrade) {
      toast({ 
        title: "Trading not available", 
        description: "Please configure your Meteora API URL",
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      await onTrade(tradeType, numericAmount);
      setAmount('');
      toast({ 
        title: `${isBuy ? 'Buy' : 'Sell'} successful!`,
        description: `You ${isBuy ? 'bought' : 'sold'} ${formatTokenAmount(outputAmount)} ${token.ticker}`,
      });
    } catch (error) {
      console.error('Trade error:', error);
      toast({ 
        title: "Trade failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isGraduated = token.status === 'graduated';

  if (isGraduated) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">🎓</div>
          <h3 className="font-bold text-lg">Token Graduated!</h3>
          <p className="text-muted-foreground text-sm">
            This token has graduated to the DEX and is now trading on-chain.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <Tabs value={tradeType} onValueChange={(v) => setTradeType(v as 'buy' | 'sell')}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="buy" className="flex-1 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="flex-1 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500">
            Sell
          </TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          {/* Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isBuy ? 'You pay' : 'You sell'}
              </span>
              <span className="text-muted-foreground">
                Balance: {isBuy ? formatSolAmount(userSolBalance) : formatTokenAmount(effectiveTokenBalance)} {isBuy ? 'SOL' : token.ticker}
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16 text-lg h-14"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                {isBuy ? 'SOL' : token.ticker}
              </span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2">
            {quickAmounts.map((value) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleQuickAmount(value)}
              >
                {isBuy ? `${value} SOL` : `${value}%`}
              </Button>
            ))}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="bg-secondary p-2 rounded-full">
              <ArrowDown className="h-4 w-4" />
            </div>
          </div>

          {/* Output */}
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              {isBuy ? 'You receive' : 'You receive'}
            </span>
            <div className="bg-secondary rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {numericAmount > 0 ? formatTokenAmount(outputAmount) : '0'}
                </span>
                <span className="text-muted-foreground font-medium">
                  {isBuy ? token.ticker : 'SOL'}
                </span>
              </div>
            </div>
          </div>

          {/* Price Impact Warning */}
          {priceImpact > 5 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>High price impact: {priceImpact.toFixed(2)}%</span>
            </div>
          )}

          {/* Trade Info */}
          {numericAmount > 0 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span>{formatSolAmount(newPrice)} SOL per {token.ticker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={priceImpact > 5 ? 'text-destructive' : ''}>{priceImpact.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage</span>
                <span>{slippage}%</span>
              </div>
            </div>
          )}

          {/* Slippage */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
            <Slider
              value={[slippage]}
              onValueChange={([v]) => setSlippage(v)}
              min={0.5}
              max={20}
              step={0.5}
              className="w-full"
            />
          </div>

          {/* Action Button */}
          {!isAuthenticated ? (
            <Button className="w-full h-12 bg-green-500 hover:bg-green-600 text-white" onClick={() => login()}>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          ) : (
            <Button
              className={`w-full h-12 font-bold ${isBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
              onClick={handleTrade}
              disabled={isLoading || !numericAmount}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `${isBuy ? 'Buy' : 'Sell'} ${token.ticker}`
              )}
            </Button>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
