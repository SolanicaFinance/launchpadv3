import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBtcWallet } from "@/hooks/useBtcWallet";
import { useBtcMemeToken, useBtcMemeTrades, useBtcMemeBalance, useBtcTradingBalance } from "@/hooks/useBtcMemeTokens";
import { BtcConnectWalletModal } from "@/components/bitcoin/BtcConnectWalletModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowUpRight, ArrowDownRight, Copy, Users, BarChart3 } from "lucide-react";

function formatBtc(v: number) {
  if (v >= 1) return `${v.toFixed(4)} BTC`;
  if (v >= 0.001) return `${v.toFixed(6)} BTC`;
  return `${v.toFixed(8)} BTC`;
}

function formatNum(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function BtcMemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, address } = useBtcWallet();
  const { data: token, isLoading } = useBtcMemeToken(id);
  const { data: trades } = useBtcMemeTrades(id);
  const { data: myBalance } = useBtcMemeBalance(id, address);
  const { data: myBtcBalance } = useBtcTradingBalance(address);

  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [trading, setTrading] = useState(false);

  const handleTrade = async () => {
    if (!address || !id || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setTrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-swap", {
        body: { tokenId: id, walletAddress: address, tradeType, amount: numAmount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        tradeType === "buy"
          ? `Bought ${formatNum(data.trade.tokenAmount)} ${token?.ticker}`
          : `Sold ${formatNum(data.trade.tokenAmount)} ${token?.ticker}`
      );
      setAmount("");
    } catch (e: any) {
      toast.error(e.message || "Trade failed");
    } finally {
      setTrading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Token not found</p>
        <Button variant="outline" onClick={() => navigate("/btc")} className="mt-4">Back to BTC</Button>
      </div>
    );
  }

  const progressPct = Math.min(token.bonding_progress, 100);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-4">
      <button onClick={() => navigate("/btc")} className="text-muted-foreground hover:text-foreground text-sm">← Back</button>

      {/* Header */}
      <div className="flex items-center gap-4">
        {token.image_url ? (
          <img src={token.image_url} alt={token.ticker} className="w-12 h-12 rounded-xl object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-[hsl(30,100%,50%)]/20 border border-[hsl(30,100%,50%)]/30 flex items-center justify-center text-lg font-bold text-[hsl(30,100%,50%)]">
            {token.ticker.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">{token.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-muted-foreground">${token.ticker}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${token.status === "active" ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]" : "bg-primary/20 text-primary"}`}>
              {token.status}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Price</div>
          <div className="text-sm font-mono font-bold text-foreground">{formatBtc(token.price_btc)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase">Market Cap</div>
          <div className="text-sm font-mono font-bold text-foreground">{formatBtc(token.market_cap_btc)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Users className="w-3 h-3" /> Holders</div>
          <div className="text-sm font-mono font-bold text-foreground">{token.holder_count}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Volume</div>
          <div className="text-sm font-mono font-bold text-foreground">{formatBtc(token.volume_btc)}</div>
        </div>
      </div>

      {/* Bonding Progress */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground">Bonding Progress</span>
          <span className="text-xs font-mono font-bold text-foreground">{progressPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[hsl(30,100%,50%)] to-[hsl(45,100%,50%)] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{formatBtc(token.real_btc_reserves || 0)} raised</span>
          <span className="text-[10px] text-muted-foreground">{formatBtc(token.graduation_threshold_btc || 0.015)} goal</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Trade Panel */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Trade</h3>

          {!isConnected ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-muted-foreground">Connect wallet to trade</p>
              <BtcConnectWalletModal />
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
                <button onClick={() => setTradeType("buy")} className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${tradeType === "buy" ? "bg-[hsl(var(--success))] text-white" : "text-muted-foreground"}`}>Buy</button>
                <button onClick={() => setTradeType("sell")} className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${tradeType === "sell" ? "bg-destructive text-white" : "text-muted-foreground"}`}>Sell</button>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{tradeType === "buy" ? "Amount (BTC)" : `Amount (${token.ticker})`}</span>
                  <span>
                    Balance: {tradeType === "buy"
                      ? formatBtc(myBtcBalance?.balance_btc || 0)
                      : formatNum(myBalance?.balance || 0)}
                  </span>
                </div>
                <Input type="number" step="any" min="0" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
              </div>

              {tradeType === "buy" && (
                <div className="grid grid-cols-4 gap-1">
                  {[0.00005, 0.0001, 0.0005, 0.001].map((v) => (
                    <button key={v} onClick={() => setAmount(String(v))} className="text-[10px] py-1 rounded bg-muted/50 hover:bg-muted text-foreground font-mono">
                      {v} ₿
                    </button>
                  ))}
                </div>
              )}

              {tradeType === "sell" && myBalance?.balance && (
                <div className="grid grid-cols-4 gap-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} onClick={() => setAmount(String(Math.floor((myBalance.balance * pct) / 100)))} className="text-[10px] py-1 rounded bg-muted/50 hover:bg-muted text-foreground font-mono">
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              <Button onClick={handleTrade} disabled={trading || !amount} className={`w-full ${tradeType === "buy" ? "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90" : "bg-destructive hover:bg-destructive/90"} text-white`}>
                {trading ? <Loader2 className="w-4 h-4 animate-spin" /> : tradeType === "buy" ? "Buy" : "Sell"}
              </Button>

              {myBalance && myBalance.balance > 0 && (
                <div className="bg-muted/20 rounded-lg p-2 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Your tokens</span><span className="font-mono">{formatNum(myBalance.balance)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg buy price</span><span className="font-mono">{formatBtc(myBalance.avg_buy_price_btc || 0)}</span></div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent Trades */}
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Recent Trades</h3>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(!trades || trades.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-6">No trades yet. Be the first!</p>
            ) : (
              trades.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20 text-xs">
                  <div className="flex items-center gap-2">
                    {t.trade_type === "buy" ? (
                      <ArrowUpRight className="w-3 h-3 text-[hsl(var(--success))]" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-destructive" />
                    )}
                    <span className="font-mono text-muted-foreground">{t.wallet_address?.slice(0, 6)}...{t.wallet_address?.slice(-4)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-semibold ${t.trade_type === "buy" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                      {t.trade_type === "buy" ? "+" : "-"}{formatNum(t.token_amount)}
                    </span>
                    <span className="font-mono text-muted-foreground">{formatBtc(t.btc_amount)}</span>
                    <span className="text-muted-foreground/60">{timeAgo(t.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {token.description && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">About</h3>
          <p className="text-sm text-muted-foreground">{token.description}</p>
        </div>
      )}
    </div>
  );
}