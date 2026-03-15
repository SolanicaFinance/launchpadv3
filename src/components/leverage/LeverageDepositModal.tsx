import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ArrowDownUp, Wallet, Loader2, ExternalLink } from "lucide-react";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { HL_BRIDGE_ADDRESS, ARBITRUM_USDC } from "@/lib/hyperliquid";
import { toast } from "@/hooks/use-toast";

const USDC_ABI_APPROVE = "function approve(address spender, uint256 amount) returns (bool)";
const USDC_ABI_TRANSFER = "function transfer(address to, uint256 amount) returns (bool)";
const USDC_ABI_BALANCE = "function balanceOf(address account) view returns (uint256)";
const USDC_ABI_ALLOWANCE = "function allowance(address owner, address spender) view returns (uint256)";

// ERC-20 function selectors
const BALANCE_OF_SELECTOR = "0x70a08231";
const APPROVE_SELECTOR = "0x095ea7b3";
const TRANSFER_SELECTOR = "0xa9059cbb";

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

interface Props {
  open: boolean;
  onClose: () => void;
  onWithdraw: (amount: string) => Promise<any>;
  hlBalance: string;
  hlWithdrawable: string;
}

export function LeverageDepositModal({ open, onClose, onWithdraw, hlBalance, hlWithdrawable }: Props) {
  const { wallet, address } = usePrivyEvmWallet();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [arbUsdcBalance, setArbUsdcBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  // Fetch Arbitrum USDC balance
  const fetchUsdcBalance = useCallback(async () => {
    if (!wallet || !address) return;
    setFetchingBalance(true);
    try {
      const provider = await wallet.getEthereumProvider();

      // Switch to Arbitrum
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa4b1" }] });
      } catch {
        // May already be on Arbitrum
      }

      const data = BALANCE_OF_SELECTOR + encodeAddress(address);
      const result = await provider.request({
        method: "eth_call",
        params: [{ to: ARBITRUM_USDC, data }, "latest"],
      });

      const balanceWei = BigInt(result);
      const balanceUsdc = Number(balanceWei) / 1e6;
      setArbUsdcBalance(balanceUsdc.toFixed(2));
    } catch (err) {
      console.error("Failed to fetch USDC balance:", err);
    } finally {
      setFetchingBalance(false);
    }
  }, [wallet, address]);

  useEffect(() => {
    if (open && wallet && address) {
      fetchUsdcBalance();
    }
  }, [open, wallet, address, fetchUsdcBalance]);

  const handleDeposit = async () => {
    if (!wallet || !address || !amount) return;
    setLoading(true);
    try {
      const provider = await wallet.getEthereumProvider();
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6));

      // Switch to Arbitrum
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa4b1" }] });
      } catch {
        // ignore
      }

      // 1. Approve USDC spending
      const approveData = APPROVE_SELECTOR + encodeAddress(HL_BRIDGE_ADDRESS) + encodeUint256(amountWei);
      const approveTx = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: ARBITRUM_USDC,
          data: "0x" + approveData.replace("0x", ""),
        }],
      });
      console.log("[Deposit] Approve tx:", approveTx);

      // 2. Wait briefly for approval
      await new Promise((r) => setTimeout(r, 3000));

      // 3. Transfer USDC to bridge
      const transferData = TRANSFER_SELECTOR + encodeAddress(HL_BRIDGE_ADDRESS) + encodeUint256(amountWei);
      const transferTx = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: ARBITRUM_USDC,
          data: "0x" + transferData.replace("0x", ""),
        }],
      });
      console.log("[Deposit] Transfer tx:", transferTx);

      toast({
        title: "Deposit submitted",
        description: `${amount} USDC sent to Hyperliquid. It may take a few minutes to reflect.`,
      });

      setAmount("");
      await fetchUsdcBalance();
    } catch (err: any) {
      console.error("Deposit failed:", err);
      toast({
        title: "Deposit failed",
        description: err.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      await onWithdraw(amount);
      setAmount("");
    } catch (err: any) {
      toast({
        title: "Withdrawal failed",
        description: err.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const maxAmount = mode === "deposit" ? arbUsdcBalance : hlWithdrawable;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownUp className="h-4 w-4 text-primary" />
            {mode === "deposit" ? "Deposit" : "Withdraw"} USDC
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary rounded-sm">
            <button
              onClick={() => { setMode("deposit"); setAmount(""); }}
              className={cn(
                "py-2 rounded-sm font-bold text-xs transition-colors",
                mode === "deposit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Deposit
            </button>
            <button
              onClick={() => { setMode("withdraw"); setAmount(""); }}
              className={cn(
                "py-2 rounded-sm font-bold text-xs transition-colors",
                mode === "withdraw" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Withdraw
            </button>
          </div>

          {/* Balance info */}
          <div className="p-3 rounded-sm bg-secondary border border-border space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                Arbitrum USDC
              </span>
              <span className="text-foreground font-medium tabular-nums">
                {fetchingBalance ? <Loader2 className="h-3 w-3 animate-spin" /> : `${arbUsdcBalance} USDC`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Hyperliquid Balance</span>
              <span className="text-foreground font-medium tabular-nums">{parseFloat(hlBalance).toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Withdrawable</span>
              <span className="text-primary font-medium tabular-nums">{parseFloat(hlWithdrawable).toFixed(2)} USDC</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Amount (USDC)</label>
              <button
                onClick={() => setAmount(maxAmount)}
                className="text-[10px] text-primary hover:underline"
              >
                Max: {parseFloat(maxAmount).toFixed(2)}
              </button>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
            />
          </div>

          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setAmount((parseFloat(maxAmount) * pct / 100).toFixed(2))}
                className="py-1.5 text-[10px] font-medium rounded-sm bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border border-border/50"
              >
                {pct}%
              </button>
            ))}
          </div>

          {mode === "deposit" && (
            <div className="text-[10px] text-muted-foreground p-2 bg-secondary/50 rounded-sm border border-border/50">
              Deposits require USDC on Arbitrum. USDC is sent to the Hyperliquid bridge contract. Takes ~2 minutes to credit.
            </div>
          )}

          {/* Submit */}
          <button
            onClick={mode === "deposit" ? handleDeposit : handleWithdraw}
            disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(maxAmount)}
            className="w-full py-2.5 rounded-sm font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {mode === "deposit" ? "Depositing..." : "Withdrawing..."}
              </span>
            ) : (
              `${mode === "deposit" ? "Deposit" : "Withdraw"} USDC`
            )}
          </button>

          {/* Link */}
          <a
            href="https://app.hyperliquid.xyz/portfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            View on Hyperliquid <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
