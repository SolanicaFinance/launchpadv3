import { useState, useCallback } from "react";
import { useBnbSwap } from "@/hooks/useBnbSwap";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { toast } from "sonner";
import { Loader2, Zap, ArrowDownToLine } from "lucide-react";
const BNB_LOGO = "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png";

const BNB_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

interface BnbTradePanelProps {
  tokenAddress: string;
  ticker: string;
  name: string;
  imageUrl?: string;
}

export function BnbTradePanel({ tokenAddress, ticker, name, imageUrl }: BnbTradePanelProps) {
  const { isAuthenticated, login } = useAuth();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { executeBnbSwap, isLoading } = useBnbSwap();
  const [isBuy, setIsBuy] = useState(true);
  const [amount, setAmount] = useState("0.05");
  const userWallet = evmAddress || "unknown";

  const handleSwap = useCallback(async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    const amtNum = parseFloat(amount);
    if (!evmAddress) {
      toast.error("BNB wallet not ready yet");
      return;
    }
    if (isNaN(amtNum) || amtNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const toastId = `bnb-swap-${Date.now()}`;
    const action = isBuy ? "buy" : "sell";
    toast.loading(`⚡ ${isBuy ? 'Buying' : 'Selling'}...`, {
      id: toastId,
      description: `${amtNum} ${isBuy ? 'BNB' : ticker} of $${ticker}`,
    });

    try {
      const result = await executeBnbSwap(tokenAddress, action, amtNum, userWallet, 3);
      if (result.success) {
        toast.success(`✅ ${isBuy ? 'Buy' : 'Sell'} Executed!`, {
          id: toastId,
          description: `TX: ${result.txHash?.slice(0, 12)}... · ${result.route === 'fourmeme' ? 'Four.meme' : result.route === 'openocean' ? 'OpenOcean' : 'Portal'}`,
          action: result.explorerUrl
            ? { label: "View TX", onClick: () => window.open(result.explorerUrl, "_blank") }
            : undefined,
        });
      } else {
        toast.error("❌ Swap Failed", { id: toastId, description: result.error?.slice(0, 120) });
      }
    } catch (err: any) {
      toast.error("❌ Swap Failed", { id: toastId, description: err?.message?.slice(0, 100) });
    }
  }, [isAuthenticated, isBuy, amount, tokenAddress, ticker, name, userWallet, evmAddress, executeBnbSwap, login]);

  return (
    <div className="trade-glass-panel p-4 md:p-3 space-y-3">
      {/* Buy/Sell toggle */}
      <div className="flex gap-1 p-0.5 bg-muted/30 rounded-lg">
        <button
          onClick={() => setIsBuy(true)}
          className={`flex-1 py-2.5 md:py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
            isBuy
              ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="inline h-3 w-3 mr-1" />QUICK BUY
        </button>
        <button
          onClick={() => setIsBuy(false)}
          className={`flex-1 py-2.5 md:py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
            !isBuy
              ? 'bg-red-500/15 text-red-400 border border-red-500/20 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowDownToLine className="inline h-3 w-3 mr-1" />SELL
        </button>
      </div>

      {/* Amount input */}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, '');
            if (val.split('.').length <= 2) setAmount(val);
          }}
          className="w-full bg-muted/20 border border-border/40 rounded-lg px-4 py-3 md:py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
          placeholder={isBuy ? "Amount in BNB" : `Amount in ${ticker}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <img src={BNB_LOGO} alt="BNB" className="h-4 w-4 rounded-full" />
          <span className="text-[10px] font-mono text-muted-foreground font-semibold">
            {isBuy ? 'BNB' : ticker}
          </span>
        </div>
      </div>

      {/* Preset amounts */}
      <div className="grid grid-cols-6 gap-1">
        {(isBuy ? BNB_PRESETS : [10, 25, 50, 100]).map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(String(preset))}
            className={`py-1.5 text-[10px] font-mono font-semibold rounded-md transition-all ${
              amount === String(preset)
                ? 'bg-primary/15 text-primary border border-primary/25'
                : 'bg-muted/20 text-muted-foreground hover:bg-muted/40 border border-transparent'
            }`}
          >
            {isBuy ? `${preset}` : `${preset}%`}
          </button>
        ))}
      </div>

      {/* Execute button */}
      <button
        onClick={handleSwap}
        disabled={isLoading}
        className={`w-full py-3 md:py-2.5 rounded-lg text-sm font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
          isBuy
            ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20'
            : 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
        } disabled:opacity-50`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        {isLoading ? 'Executing...' : `${isBuy ? 'BUY' : 'SELL'} $${ticker}`}
      </button>

      {/* Route info */}
      <p className="text-[9px] font-mono text-muted-foreground/40 text-center">
        Swaps via OpenOcean DEX aggregator · Best route auto-selected
      </p>
    </div>
  );
}
