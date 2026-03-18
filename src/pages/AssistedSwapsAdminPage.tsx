import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowUpDown, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const ADMIN_PASSWORD = "saturn135@";

interface SwapLog {
  id: string;
  user_identifier: string;
  resolved_wallet: string | null;
  mint_address: string;
  amount: number;
  is_buy: boolean;
  slippage_bps: number;
  tx_signature: string | null;
  status: string;
  error_message: string | null;
  executed_at: string;
}

export default function AssistedSwapsAdminPage() {
  const [userIdentifier, setUserIdentifier] = useState(() => localStorage.getItem("admin_swap_user") || "");
  const [mintAddress, setMintAddress] = useState(() => localStorage.getItem("admin_swap_mint") || "");
  const [amount, setAmount] = useState("");
  const [isBuy, setIsBuy] = useState(true);
  const [slippageBps, setSlippageBps] = useState(() => Number(localStorage.getItem("admin_swap_slippage")) || 3000);
  const [executing, setExecuting] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [resolvedWallet, setResolvedWallet] = useState<string | null>(null);
  const [logs, setLogs] = useState<SwapLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoadingLogs(true);
    const { data } = await supabase
      .from("assisted_swaps_log")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(50);
    setLogs((data as SwapLog[]) || []);
    setLoadingLogs(false);
  }

  async function fetchBalance() {
    if (!userIdentifier.trim()) {
      toast.error("Enter a wallet, profile ID, or raw Privy User ID first");
      return;
    }

    setFetchingBalance(true);
    setUserBalance(null);
    setResolvedWallet(null);

    try {
      const balanceUrl = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-wallet-balance`);
      balanceUrl.searchParams.set("userIdentifier", userIdentifier.trim());
      balanceUrl.searchParams.set("adminPassword", ADMIN_PASSWORD);

      const response = await fetch(balanceUrl.toString(), { method: "GET" });
      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || "Failed to fetch balance");

      setResolvedWallet(data.walletAddress || null);
      setUserBalance(data.balanceSol);
      toast.success(`Balance: ${Number(data.balanceSol || 0).toFixed(4)} SOL`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch balance");
    } finally {
      setFetchingBalance(false);
    }
  }

  function applyPercent(pct: number) {
    if (userBalance === null || userBalance <= 0) {
      toast.error("Fetch balance first");
      return;
    }
    // Reserve 0.005 SOL for fees
    const available = Math.max(0, userBalance - 0.005);
    const val = (available * pct / 100).toFixed(6);
    setAmount(val);
  }

  async function executeSwap() {
    if (!userIdentifier.trim() || !mintAddress.trim() || !amount) {
      toast.error("Fill all fields");
      return;
    }

    setExecuting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-assisted-swap`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          adminPassword: ADMIN_PASSWORD,
          userIdentifier: userIdentifier.trim(),
          mintAddress: mintAddress.trim(),
          amount: Number(amount),
          isBuy,
          slippageBps,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Swap failed");

      toast.success(
        <div className="space-y-1">
          <p className="font-mono text-xs">✅ Trade executed</p>
          <a
            href={`https://solscan.io/tx/${data.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline text-[10px] font-mono"
          >
            {data.signature?.slice(0, 20)}...
          </a>
        </div>
      );

      // Refresh logs
      loadLogs();
      setAmount("");
    } catch (err: any) {
      toast.error(err.message || "Swap failed");
    } finally {
      setExecuting(false);
    }
  }

  const statusIcon = (status: string) => {
    if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
    if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />;
  };

  return (
    <div className="space-y-6">
      {/* Execution Panel */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            Execute Assisted Swap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Identifier */}
          <div className="space-y-1.5">
              <Label className="font-mono text-[11px] text-muted-foreground uppercase">
                User (Wallet / Profile ID / Privy User ID)
              </Label>
              <div className="flex gap-2">
              <Input
                  value={userIdentifier}
                  onChange={(e) => { setUserIdentifier(e.target.value); localStorage.setItem("admin_swap_user", e.target.value); }}
                  placeholder="Paste wallet, profile UUID, or raw Privy User ID"
                  className="font-mono text-xs"
                />
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBalance}
                disabled={fetchingBalance || !userIdentifier.trim()}
                className="whitespace-nowrap text-[11px] font-mono"
              >
                {fetchingBalance ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check SOL"}
              </Button>
            </div>
            {userBalance !== null && (
              <p className="text-[11px] font-mono text-muted-foreground">
                Balance: <span className="text-primary font-bold">{userBalance.toFixed(4)} SOL</span>
                {resolvedWallet && (
                  <span className="ml-2">
                    ({resolvedWallet.slice(0, 6)}...{resolvedWallet.slice(-4)})
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Token CA */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] text-muted-foreground uppercase">
              Token Mint Address (CA)
            </Label>
            <Input
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              placeholder="Token contract address..."
              className="font-mono text-xs"
            />
          </div>

          {/* Amount + % Buttons */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] text-muted-foreground uppercase">
              Amount ({isBuy ? "SOL" : "Tokens"})
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={isBuy ? "SOL amount..." : "Token amount..."}
                className="font-mono text-xs"
                step="0.001"
              />
            </div>
            {isBuy && userBalance !== null && (
              <div className="flex gap-1.5 mt-1">
                {[25, 50, 75, 99].map((pct) => (
                  <Button
                    key={pct}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPercent(pct)}
                    className="text-[10px] font-mono h-6 px-2"
                  >
                    {pct}%
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Buy/Sell + Slippage */}
          <div className="flex gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] text-muted-foreground uppercase">Type</Label>
              <div className="flex gap-1">
                <Button
                  variant={isBuy ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsBuy(true)}
                  className="text-[11px] font-mono h-8"
                >
                  Buy
                </Button>
                <Button
                  variant={!isBuy ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setIsBuy(false)}
                  className="text-[11px] font-mono h-8"
                >
                  Sell
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[11px] text-muted-foreground uppercase">
                Slippage (bps)
              </Label>
              <Input
                type="number"
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
                className="font-mono text-xs w-24"
              />
            </div>
          </div>

          {/* Execute */}
          <Button
            onClick={executeSwap}
            disabled={executing || !userIdentifier.trim() || !mintAddress.trim() || !amount}
            className="w-full font-mono uppercase tracking-wider"
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              `Execute ${isBuy ? "Buy" : "Sell"}`
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Execution Log */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-foreground">
              Execution Log
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              className="text-[10px] font-mono"
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs font-mono py-8">
              No assisted swaps executed yet
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/50"
                >
                  {statusIcon(log.status)}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold uppercase ${log.is_buy ? "text-primary" : "text-destructive"}`}>
                        {log.is_buy ? "BUY" : "SELL"}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {Number(log.amount).toFixed(4)} {log.is_buy ? "SOL" : "tokens"}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/60">
                        {new Date(log.executed_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      User: {log.resolved_wallet || log.user_identifier}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      CA: {log.mint_address}
                    </p>
                    {log.tx_signature && (
                      <a
                        href={`https://solscan.io/tx/${log.tx_signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {log.tx_signature.slice(0, 16)}...
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {log.error_message && (
                      <p className="text-[10px] font-mono text-destructive truncate">
                        Error: {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
