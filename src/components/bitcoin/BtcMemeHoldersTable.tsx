import { BtcMemeHolder } from "@/hooks/useBtcMemeHolders";
import { Loader2, Crown, Code, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  holders: BtcMemeHolder[];
  isLoading: boolean;
  ticker: string;
  currentPriceBtc: number;
}

function formatNum(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatBtc(v: number) {
  if (v >= 1) return `${v.toFixed(4)}`;
  if (v >= 0.001) return `${v.toFixed(6)}`;
  return `${v.toFixed(8)}`;
}

function truncAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function addrGradient(addr: string): string {
  if (!addr) return "linear-gradient(135deg, #333, #555)";
  const h1 = (addr.charCodeAt(0) * 37 + addr.charCodeAt(1) * 13) % 360;
  const h2 = (h1 + 40 + (addr.charCodeAt(2) * 7) % 80) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,45%), hsl(${h2},50%,35%))`;
}

export function BtcMemeHoldersTable({ holders, isLoading, ticker, currentPriceBtc, creatorWallet }: Props & { creatorWallet?: string }) {
  if (isLoading && holders.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="text-center py-10 text-xs text-muted-foreground">No holders yet</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Holder Distribution Summary */}
      {holders.length > 0 && (
        <div className="flex items-center gap-3 px-2">
          <HolderDistributionBar holders={holders} />
        </div>
      )}

      <ScrollArea className="h-[340px]">
      <table className="w-full text-xs font-mono">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-muted-foreground/50 uppercase tracking-wider text-[9px] border-b border-border">
            <th className="text-left py-2.5 px-2 font-medium w-6">#</th>
            <th className="text-left py-2.5 px-2 font-medium">Wallet</th>
            <th className="text-right py-2.5 px-2 font-medium">Balance</th>
            <th className="text-right py-2.5 px-2 font-medium">Value (BTC)</th>
            <th className="text-right py-2.5 px-2 font-medium">Avg Buy</th>
            <th className="text-right py-2.5 px-2 font-medium">% Hold</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h, i) => {
            const valueBtc = h.balance * currentPriceBtc;
            const costBasis = h.balance * h.avg_buy_price_btc;
            const pnl = valueBtc - costBasis;
            const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
            const isPositive = pnl >= 0;

            return (
              <tr key={h.wallet_address} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-2 text-muted-foreground/40">{i + 1}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full shrink-0" style={{ background: addrGradient(h.wallet_address) }} />
                    <span className="text-foreground/70 text-[11px]">{truncAddr(h.wallet_address)}</span>
                    {h.is_creator && (
                      <span className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                        <Code className="w-2.5 h-2.5" /> DEV
                      </span>
                    )}
                    {i === 0 && !h.is_creator && (
                      <span className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(45 90% 50% / 0.15)", color: "hsl(45 90% 50%)" }}>
                        <Crown className="w-2.5 h-2.5" /> #1
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-foreground/80">{formatNum(h.balance)}</td>
                <td className="py-2 px-2 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-foreground/70">{formatBtc(valueBtc)} ₿</span>
                    {h.avg_buy_price_btc > 0 && (
                      <span className={`text-[9px] ${isPositive ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                        {isPositive ? '+' : ''}{pnlPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-muted-foreground/60">{formatBtc(h.avg_buy_price_btc)} ₿</td>
                <td className="py-2 px-2 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[9px] px-1 py-0.5 rounded bg-muted/30 text-muted-foreground/70">
                      {h.percentage.toFixed(h.percentage >= 1 ? 2 : 3)}%
                    </span>
                    <div className="w-12 h-1 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(h.percentage, 100)}%`,
                          backgroundColor: h.percentage > 10 ? "hsl(var(--destructive))" : "hsl(var(--success))",
                        }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
    </div>
  );
}

/* Mini horizontal distribution bar */
function HolderDistributionBar({ holders }: { holders: BtcMemeHolder[] }) {
  const top5 = holders.slice(0, 5);
  const top5Pct = top5.reduce((s, h) => s + h.percentage, 0);
  const restPct = Math.max(0, 100 - top5Pct);
  const devHolder = holders.find(h => h.is_creator);
  const devPct = devHolder?.percentage || 0;

  const colors = [
    "hsl(30 90% 55%)",   // orange
    "hsl(200 80% 55%)",  // blue
    "hsl(150 60% 45%)",  // green
    "hsl(280 60% 55%)",  // purple
    "hsl(350 70% 55%)",  // red
  ];

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3">
          {devPct > 0 && (
            <span className="flex items-center gap-1 text-primary">
              <Code className="w-3 h-3" />
              Dev: <span className="font-bold font-mono">{devPct.toFixed(2)}%</span>
            </span>
          )}
          <span className="text-muted-foreground">
            Top 5: <span className="font-bold font-mono text-foreground">{top5Pct.toFixed(1)}%</span>
          </span>
        </div>
        <span className="text-muted-foreground/60">{holders.length} holders</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {top5.map((h, i) => (
          <div
            key={h.wallet_address}
            className="h-full transition-all"
            style={{
              width: `${h.percentage}%`,
              backgroundColor: h.is_creator ? "hsl(var(--primary))" : colors[i % colors.length],
              opacity: 0.85,
            }}
            title={`${truncAddr(h.wallet_address)}: ${h.percentage.toFixed(2)}%`}
          />
        ))}
        {restPct > 0 && (
          <div className="h-full bg-muted/50" style={{ width: `${restPct}%` }} title={`Others: ${restPct.toFixed(1)}%`} />
        )}
      </div>
    </div>
  );
}
