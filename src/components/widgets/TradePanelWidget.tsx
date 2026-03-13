import { useState, useEffect } from "react";
import { ArrowUpDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface WidgetConfig {
  apiKey: string;
  theme: "dark" | "light";
  accentColor?: string;
  hideHeader?: boolean;
  mintAddress?: string;
  poolAddress?: string;
}

interface TradePanelWidgetProps {
  config: WidgetConfig;
}

interface PoolInfo {
  name: string;
  ticker: string;
  price: number;
  imageUrl?: string;
  poolAddress: string;
}

const BASE_URL = "https://ptwytypavumcrbofspno.supabase.co/functions/v1";

export default function TradePanelWidget({ config }: TradePanelWidgetProps) {
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quote, setQuote] = useState<{
    outputAmount: string;
    priceImpact: string;
    fee: { amount: string; bps: number };
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Fetch pool info
  useEffect(() => {
    const fetchPool = async () => {
      try {
        const address = config.poolAddress || config.mintAddress;
        const response = await fetch(`${BASE_URL}/api-swap/pool?address=${address}`, {
          headers: {
            "x-api-key": config.apiKey,
          },
        });
        const data = await response.json();
        
        if (data.success) {
          setPoolInfo({
            name: data.pool.name,
            ticker: data.pool.ticker,
            price: data.pool.price,
            imageUrl: data.pool.imageUrl,
            poolAddress: data.pool.poolAddress,
          });
        } else {
          toast.error("Failed to load token info");
        }
      } catch (error) {
        toast.error("Failed to load token info");
      } finally {
        setLoading(false);
      }
    };

    fetchPool();
  }, [config.apiKey, config.mintAddress, config.poolAddress]);

  // Get quote when amount changes
  useEffect(() => {
    const getQuote = async () => {
      if (!amount || !poolInfo || parseFloat(amount) <= 0) {
        setQuote(null);
        return;
      }

      setQuoteLoading(true);
      try {
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        const amountLamports = Math.floor(parseFloat(amount) * 1e9);

        const response = await fetch(`${BASE_URL}/api-swap`, {
          method: "POST",
          headers: {
            "x-api-key": config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            poolAddress: poolInfo.poolAddress,
            inputMint: side === "buy" ? SOL_MINT : config.mintAddress,
            outputMint: side === "buy" ? config.mintAddress : SOL_MINT,
            amount: amountLamports.toString(),
            slippageBps: 100,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setQuote({
            outputAmount: data.outputAmount,
            priceImpact: data.priceImpact,
            fee: data.fee,
          });
        }
      } catch (error) {
        console.error("Quote error:", error);
      } finally {
        setQuoteLoading(false);
      }
    };

    const debounce = setTimeout(getQuote, 300);
    return () => clearTimeout(debounce);
  }, [amount, side, poolInfo, config.apiKey, config.mintAddress]);

  const handleTrade = () => {
    // Notify parent to handle the trade
    window.parent.postMessage({
      type: "trade-request",
      data: {
        side,
        amount,
        poolAddress: poolInfo?.poolAddress,
        mintAddress: config.mintAddress,
        quote,
      },
    }, "*");
    
    toast.info("Connect your wallet to complete this trade");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="w-6 h-6 border-2 border-transparent border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!poolInfo) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-destructive p-4">
        <p>Token not found</p>
      </div>
    );
  }

  const formatOutput = (lamports: string) => {
    const num = parseFloat(lamports) / 1e9;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(4);
  };

  return (
    <Card className="border-0 shadow-none">
      {!config.hideHeader && (
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            {poolInfo.imageUrl && (
              <img src={poolInfo.imageUrl} alt={poolInfo.name} className="w-10 h-10 rounded-full" />
            )}
            <div>
              <CardTitle>{poolInfo.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                ${poolInfo.ticker}
                <span className="text-primary">
                  {poolInfo.price < 0.000001 
                    ? poolInfo.price.toExponential(4) 
                    : poolInfo.price.toFixed(8)} SOL
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="buy" className="text-primary data-[state=active]:bg-primary/20">
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="text-destructive data-[state=active]:bg-destructive/20">
              Sell
            </TabsTrigger>
          </TabsList>

          <div className="space-y-4">
            {/* Input */}
            <div className="space-y-2">
              <Label>{side === "buy" ? "You Pay (SOL)" : `You Sell (${poolInfo.ticker})`}</Label>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              
              {/* Quick amounts */}
              <div className="flex gap-2">
                {side === "buy" ? (
                  <>
                    {[0.1, 0.5, 1, 2].map((val) => (
                      <Button
                        key={val}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setAmount(val.toString())}
                      >
                        {val} SOL
                      </Button>
                    ))}
                  </>
                ) : (
                  <>
                    {[25, 50, 75, 100].map((pct) => (
                      <Button
                        key={pct}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          // Would need wallet balance to calculate
                          toast.info("Connect wallet to use percentage");
                        }}
                      >
                        {pct}%
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="bg-muted p-2 rounded-full">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Output */}
            <div className="space-y-2">
              <Label>{side === "buy" ? `You Receive (${poolInfo.ticker})` : "You Receive (SOL)"}</Label>
              <div className="bg-muted/50 p-3 rounded-lg">
                {quoteLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" />
                    Getting quote...
                  </div>
                ) : quote ? (
                  <div>
                    <p className="text-xl font-bold">{formatOutput(quote.outputAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Price impact: {quote.priceImpact}% | Fee: {quote.fee.bps / 100}%
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Enter amount</p>
                )}
              </div>
            </div>

            {/* Trade Button */}
            <Button
              className={`w-full ${side === "buy" ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90"}`}
              onClick={handleTrade}
              disabled={!quote || !amount}
            >
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet to {side === "buy" ? "Buy" : "Sell"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Powered by Saturn
            </p>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
