import { useMemo } from "react";
import { TokenTradeEvent } from "@/hooks/useCodexTokenEvents";
import { HolderInfo } from "@/hooks/useTokenHolders";
import { ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return `${diff} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return '$0.00';
}

function formatTokenAmt(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(2);
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function truncateTx(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/** Generate a deterministic gradient for an address */
function addrGradient(addr: string): string {
  if (!addr) return 'linear-gradient(135deg, #333, #555)';
  const h1 = (addr.charCodeAt(0) * 37 + addr.charCodeAt(1) * 13) % 360;
  const h2 = (h1 + 40 + (addr.charCodeAt(2) * 7) % 80) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,45%), hsl(${h2},50%,35%))`;
}

interface Props {
  events: TokenTradeEvent[];
  isLoading: boolean;
  holders?: HolderInfo[];
  currentPriceUsd?: number;
  isBsc?: boolean;
}

export function CodexTokenTrades({ events, isLoading, holders = [], currentPriceUsd = 0, isBsc = false }: Props) {
  const holdersMap = useMemo(() => {
    const m = new Map<string, HolderInfo>();
    for (const h of holders) m.set(h.address, h);
    return m;
  }, [holders]);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <span className="text-xs font-mono text-muted-foreground animate-pulse">Loading trades...</span>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex items-center justify-center py-10">
        <span className="text-xs font-mono text-muted-foreground">No trades yet</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[420px]">
      <table className="w-full text-xs font-mono">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: '#0d0d0d' }}>
          <tr className="text-muted-foreground/50 uppercase tracking-wider text-[10px]">
            <th className="text-left py-2.5 px-3 font-medium">Account</th>
            <th className="text-left py-2.5 px-2 font-medium">Type</th>
            <th className="text-right py-2.5 px-2 font-medium">Size</th>
            <th className="text-right py-2.5 px-2 font-medium hidden sm:table-cell">Price</th>
            <th className="text-right py-2.5 px-2 font-medium">% Holdings</th>
            <th className="text-right py-2.5 px-2 font-medium">Time</th>
            <th className="text-right py-2.5 px-3 font-medium">Transaction</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const isBuy = e.type === "Buy";
            return (
              <tr
                key={`${e.txHash}-${i}`}
                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                style={{ height: '52px' }}
              >
                {/* Account — avatar + truncated address */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-full shrink-0"
                      style={{ background: addrGradient(e.maker) }}
                    />
                    <span className="text-foreground/70 text-[11px]">{truncateAddr(e.maker)}</span>
                  </div>
                </td>

                {/* Type — BUY/SELL badge */}
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isBuy
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-sm ${isBuy ? 'bg-green-400' : 'bg-red-400'}`} />
                    {e.type}
                  </span>
                </td>

                {/* Size — token/USD */}
                <td className="py-2 px-2 text-right text-foreground/80">
                  <span className="text-[11px]">
                    ≡ {formatTokenAmt(e.tokenAmount)}/{formatUsd(e.totalUsd)}
                  </span>
                </td>

                {/* Price */}
                <td className="py-2 px-2 text-right text-foreground/60 hidden sm:table-cell">
                  <span className="text-[11px]">{formatUsd(e.priceUsd)}</span>
                </td>

                {/* % Holdings */}
                <td className="py-2 px-2 text-right">
                  {(() => {
                    const holder = holdersMap.get(e.maker);
                    const hasHoldings = !!holder && holder.tokenAmount > 0 && holder.percentage > 0;
                    const usdVal = hasHoldings ? holder.tokenAmount * currentPriceUsd : 0;
                    const pct = hasHoldings ? holder.percentage : 0;
                    return (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-foreground/80 text-[11px]">{formatUsd(usdVal)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {pct.toFixed(2)}%
                          </span>
                          <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                            {pct > 0 && (
                              <div
                                className={`h-full rounded-full ${pct > 10 ? "bg-destructive" : "bg-primary"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </td>

                {/* Time */}
                <td className="py-2 px-2 text-right text-muted-foreground/60">
                  <span className="text-[11px]">{formatTime(e.timestamp)}</span>
                </td>

                {/* Transaction */}
                <td className="py-2 px-3 text-right">
                {e.txHash ? (
                    <a
                      href={isBsc ? `https://bscscan.com/tx/${e.txHash}` : `https://solscan.io/tx/${e.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground/50 hover:text-foreground underline underline-offset-2 transition-colors inline-flex items-center gap-1"
                    >
                      {truncateTx(e.txHash)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/30">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}
