import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Copy, Check, ExternalLink, ShieldCheck, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface BtcDepositPanelProps {
  walletAddress: string;
  currentBalance: number;
}

interface DetectedDeposit {
  txid: string;
  amountBtc: number;
  confirmed: boolean;
  blockHeight: number | null;
  credited: boolean;
}

export function BtcDepositPanel({ walletAddress, currentBalance }: BtcDepositPanelProps) {
  const [copied, setCopied] = useState(false);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DetectedDeposit[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<number>(0);
  const queryClient = useQueryClient();

  // Fetch deposit address on mount
  useEffect(() => {
    supabase.functions.invoke("btc-meme-deposit", { body: {} })
      .then(({ data }) => {
        if (data?.depositAddress) setDepositAddress(data.depositAddress);
      })
      .catch(() => {});
  }, []);

  // Track which txids we've already shown credit toasts for
  const creditedToastRef = useRef<Set<string>>(new Set());

  // Scan for deposits from this wallet
  const scanDeposits = useCallback(async (silent = false) => {
    if (!walletAddress || !depositAddress) return;
    if (!silent) setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-deposit", {
        body: { action: "scan-deposits", walletAddress },
      });
      if (error) throw error;
      if (data?.deposits) {
        setDeposits(data.deposits);

        // Only toast for newly credited deposits we haven't toasted before
        const newlyConfirmed = (data.deposits as DetectedDeposit[]).filter(
          (d) => d.confirmed && d.credited && !creditedToastRef.current.has(d.txid)
        );
        if (newlyConfirmed.length > 0) {
          const total = newlyConfirmed.reduce((s: number, d: DetectedDeposit) => s + d.amountBtc, 0);
          newlyConfirmed.forEach(d => creditedToastRef.current.add(d.txid));
          toast.success(`${total.toFixed(8)} BTC confirmed & credited!`);
          queryClient.invalidateQueries({ queryKey: ["btc-trading-balance"] });
        }
      }
      setLastScan(Date.now());
    } catch (e) {
      if (!silent) toast.error("Failed to scan deposits");
    } finally {
      setScanning(false);
    }
  }, [walletAddress, depositAddress, queryClient]);

  // Initial scan + auto-poll every 60s
  useEffect(() => {
    if (!walletAddress || !depositAddress) return;
    // Seed the creditedToastRef with already-credited deposits to avoid re-toasting
    scanDeposits(true);
    const interval = setInterval(() => scanDeposits(true), 60000);
    return () => clearInterval(interval);
  }, [walletAddress, depositAddress, scanDeposits]);

  const copyDepositAddress = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    toast.success("Deposit address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const pendingDeposits = deposits.filter(d => !d.confirmed);
  const confirmedDeposits = deposits.filter(d => d.confirmed);

  return (
    <div className="trade-glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Deposit BTC</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scanDeposits(false)}
          disabled={scanning}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3 h-3 ${scanning ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Balance display */}
      <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/60 uppercase font-mono">Your Trading Balance</span>
          <span className="text-sm font-mono font-bold text-foreground">{currentBalance.toFixed(8)} BTC</span>
        </div>
      </div>

      {/* Deposit address */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground/60 uppercase font-mono">Send BTC to this address</span>
        {depositAddress ? (
          <div
            onClick={copyDepositAddress}
            className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2.5 border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-colors group"
          >
            <span className="text-[11px] font-mono text-primary truncate flex-1">{depositAddress}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-[hsl(var(--success))] shrink-0" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-foreground shrink-0" />}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/40 font-mono">Loading...</div>
        )}
      </div>

      {/* Detected deposits */}
      {deposits.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground/60 uppercase font-mono">Detected Deposits</span>
          <div className="space-y-1">
            {pendingDeposits.map((d) => (
              <div key={d.txid} className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-foreground font-semibold">{d.amountBtc.toFixed(8)} BTC</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-muted-foreground/50 truncate">{d.txid.slice(0, 12)}…{d.txid.slice(-6)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono text-primary font-semibold px-1.5 py-0.5 rounded bg-primary/10">0/1 conf</span>
                  <a
                    href={`https://mempool.space/tx/${d.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
            {confirmedDeposits.slice(0, 3).map((d) => (
              <div key={d.txid} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.06]">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-foreground/70">{d.amountBtc.toFixed(8)} BTC</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-muted-foreground/40 truncate">{d.txid.slice(0, 12)}…{d.txid.slice(-6)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono text-[hsl(var(--success))]/70 px-1.5 py-0.5 rounded bg-[hsl(var(--success))]/10">✓ credited</span>
                  <a
                    href={`https://mempool.space/tx/${d.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending notice */}
      {pendingDeposits.length > 0 && (
        <div className="flex items-start gap-1.5 bg-primary/5 rounded-lg p-2.5 border border-primary/15">
          <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0 mt-0.5" />
          <p className="text-[9px] text-muted-foreground/70 leading-tight font-mono">
            Waiting for network confirmation. Auto-credits once ≥1 confirmation is reached. Scanning every 30s.
          </p>
        </div>
      )}

      {/* No deposits yet hint */}
      {deposits.length === 0 && !scanning && (
        <div className="flex items-start gap-1.5 bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.06]">
          <ShieldCheck className="w-3 h-3 text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="text-[9px] text-muted-foreground/50 leading-tight font-mono">
            Send BTC to the address above. Deposits are auto-detected and credited after 1 confirmation. No manual verification needed.
          </p>
        </div>
      )}

      {scanning && deposits.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          <span className="text-[10px] text-muted-foreground/50 font-mono">Scanning for deposits…</span>
        </div>
      )}
    </div>
  );
}
