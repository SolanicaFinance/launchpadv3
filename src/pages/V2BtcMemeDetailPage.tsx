import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBtcWallet } from "@/hooks/useBtcWallet";
import { useBtcMemeToken, useBtcMemeTrades, useBtcMemeBalance, useBtcTradingBalance } from "@/hooks/useBtcMemeTokens";
import { BtcConnectWalletModal } from "@/components/bitcoin/BtcConnectWalletModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowUpRight, ArrowDownRight, Users, BarChart3, ExternalLink, Cpu } from "lucide-react";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { useBtcMemeHolders } from "@/hooks/useBtcMemeHolders";
import { BtcMemeHoldersTable } from "@/components/bitcoin/BtcMemeHoldersTable";

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

function truncate(s: string, n = 6) {
  if (!s || s.length <= n * 2) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

export default function V2BtcMemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, address } = useBtcWallet();
  const { data: token, isLoading } = useBtcMemeToken(id);
  const { data: trades } = useBtcMemeTrades(id);
  const { data: myBalance } = useBtcMemeBalance(id, address);
  const { data: myBtcBalance } = useBtcTradingBalance(address);
  const { data: holders, isLoading: holdersLoading } = useBtcMemeHolders(id, token?.total_supply);

  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [trading, setTrading] = useState(false);
  const [tradeTab, setTradeTab] = useState<"all" | "my" | "holders">("all");

  const handleTrade = async () => {
    if (!address || !id || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setTrading(true);
    const startMs = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-swap", {
        body: { tokenId: id, walletAddress: address, tradeType, amount: numAmount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const executionMs = Date.now() - startMs;
      const trade = data.trade;

      // Use genesis_txid as CA pre-graduation, rune_id post-graduation
      const tokenCA = token?.genesis_txid || id;

      showTradeSuccess({
        type: tradeType,
        ticker: token?.ticker || "",
        tokenName: token?.name,
        amount: tradeType === "buy"
          ? `${trade.btcAmount.toFixed(8)} BTC`
          : `${formatNum(trade.tokenAmount)} ${token?.ticker}`,
        tokenImageUrl: token?.image_url || undefined,
        chain: "btc",
        executionMs,
        mintAddress: tokenCA,
      });
      setAmount("");
    } catch (e: any) {
      toast.error(e.message || "Trade failed");
    } finally {
      setTrading(false);
    }
  };

  const myTrades = trades?.filter((t: any) => t.wallet_address === address) || [];
  const displayTrades = tradeTab === "my" ? myTrades : (trades || []);

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
        <Button variant="outline" onClick={() => navigate("/v2btc")} className="mt-4">Back to V2 BTC</Button>
      </div>
    );
  }

  const progressPct = Math.min(token.bonding_progress, 100);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-4">
      <button onClick={() => navigate("/v2btc")} className="text-muted-foreground hover:text-foreground text-sm">← Back to V2 BTC</button>

      {/* Pending Genesis Banner */}
      {token.status === "pending_genesis" && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Awaiting Bitcoin Mainnet Confirmation</p>
            <p className="text-xs text-muted-foreground">Your token's genesis OP_RETURN transaction is being confirmed on Bitcoin mainnet.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        {token.image_url ? (
          <img src={token.image_url} alt={token.ticker} className="w-12 h-12 rounded-xl object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
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
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-semibold">TAT Protocol</span>
          </div>
          {/* CA: Genesis TX pre-graduation, Rune ID post-graduation */}
          {token.genesis_txid && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">
                {token.graduated_at ? 'RUNE' : 'GENESIS TX'}
              </span>
              <a
                href={`https://mempool.space/tx/${token.genesis_txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-primary/70 hover:text-primary transition-colors"
              >
                {truncate(token.genesis_txid, 8)} ↗
              </a>
            </div>
          )}
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
          <div className="h-full bg-gradient-to-r from-primary to-[hsl(45,100%,50%)] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{formatBtc(token.real_btc_reserves || 0)} raised</span>
          <span className="text-[10px] text-muted-foreground">{formatBtc(token.graduation_threshold_btc || 0.5)} goal</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Trade Panel */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Trade</h3>
          {token.status === "pending_genesis" ? (
            <div className="text-center py-6 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Trading disabled until Bitcoin mainnet genesis is confirmed</p>
            </div>
          ) : !isConnected ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-muted-foreground">Connect wallet to trade</p>
              <BtcConnectWalletModal
                trigger={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" size="sm">Connect Wallet</Button>}
              />
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
                  <span>Balance: {tradeType === "buy" ? formatBtc(myBtcBalance?.balance_btc || 0) : formatNum(myBalance?.balance || 0)}</span>
                </div>
                <Input type="number" step="any" min="0" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
              </div>
              {tradeType === "buy" && (
                <div className="grid grid-cols-4 gap-1">
                  {[0.00005, 0.0001, 0.0005, 0.001].map((v) => (
                    <button key={v} onClick={() => setAmount(String(v))} className="text-[10px] py-1 rounded bg-muted/50 hover:bg-muted text-foreground font-mono">{v} ₿</button>
                  ))}
                </div>
              )}
              {tradeType === "sell" && myBalance?.balance && (
                <div className="grid grid-cols-4 gap-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} onClick={() => setAmount(String(Math.floor((myBalance.balance * pct) / 100)))} className="text-[10px] py-1 rounded bg-muted/50 hover:bg-muted text-foreground font-mono">{pct}%</button>
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

        {/* Trade History */}
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              <button onClick={() => setTradeTab("all")} className={`text-sm font-bold transition-colors ${tradeTab === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"}`}>All Trades</button>
              {isConnected && (
                <button onClick={() => setTradeTab("my")} className={`text-sm font-bold transition-colors ${tradeTab === "my" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"}`}>
                  My Trades {myTrades.length > 0 && <span className="text-xs text-primary ml-1">({myTrades.length})</span>}
                </button>
              )}
              <button onClick={() => setTradeTab("holders")} className={`text-sm font-bold transition-colors flex items-center gap-1 ${tradeTab === "holders" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"}`}>
                <Users className="w-3.5 h-3.5" /> Holders <span className="text-xs text-primary ml-0.5">({token.holder_count})</span>
              </button>
            </div>
            {tradeTab !== "holders" && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Cpu className="w-3 h-3 text-blue-400/60" />
                <span>Fractal Settlement</span>
              </div>
            )}
          </div>

          {tradeTab === "holders" ? (
            <BtcMemeHoldersTable holders={holders || []} isLoading={holdersLoading} ticker={token.ticker} currentPriceBtc={token.price_btc} />
          ) : (
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {displayTrades.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {tradeTab === "my" ? "You haven't made any trades yet." : "No trades yet. Be the first!"}
                </p>
              ) : (
                displayTrades.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/20 text-xs group">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.trade_type === "buy" ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[hsl(var(--success))] flex-shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      )}
                      <span className="font-mono text-muted-foreground">{truncate(t.wallet_address, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-mono font-semibold ${t.trade_type === "buy" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                        {t.trade_type === "buy" ? "+" : "-"}{formatNum(t.token_amount)}
                      </span>
                      <span className="font-mono text-muted-foreground text-[10px]">{formatBtc(t.btc_amount)}</span>
                      {t.solana_proof_signature ? (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px]">
                          <Cpu className="w-2.5 h-2.5" />
                          Fractal
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground/40 text-[9px]">
                          <Cpu className="w-2.5 h-2.5" />
                          pending
                        </span>
                      )}
                      <span className="text-muted-foreground/60 text-[10px] w-12 text-right">{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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
