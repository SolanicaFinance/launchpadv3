import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useBtcWallet } from "@/contexts/BtcWalletContext";
import { useBtcMemeToken, useBtcMemeTrades, useBtcMemeBalance, useBtcTradingBalance, useBtcOnChainBalance } from "@/hooks/useBtcMemeTokens";
import { useBtcUsdPrice } from "@/hooks/useBtcUsdPrice";
import { BtcConnectWalletModal } from "@/components/bitcoin/BtcConnectWalletModal";
import { BtcDepositPanel } from "@/components/bitcoin/BtcDepositPanel";
import { BtcWithdrawPanel } from "@/components/bitcoin/BtcWithdrawPanel";
import { BtcMemeChart } from "@/components/bitcoin/BtcMemeChart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, ArrowUpRight, ArrowDownRight, Users, BarChart3, Cpu,
  TrendingUp, Crown, Code, ArrowLeft, Copy, Share2, RefreshCw,
  ExternalLink, Activity, Shield, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import { showTradeSuccess, useTradeSuccessStore } from "@/stores/tradeSuccessStore";
import { useBtcMemeHolders } from "@/hooks/useBtcMemeHolders";
import { BtcMemeHoldersTable } from "@/components/bitcoin/BtcMemeHoldersTable";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

function formatBtc(v: number) {
  if (v === 0) return '0 BTC';
  if (v >= 1) return `${v.toFixed(4)} BTC`;
  if (v >= 0.001) return `${v.toFixed(6)} BTC`;
  if (v >= 0.00000001) return `${v.toFixed(8)} BTC`;
  // For extremely small prices, show significant digits
  const s = v.toFixed(12).replace(/0+$/, '');
  return `${s} BTC`;
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

function formatUsdCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return '$0';
}

export default function V2BtcMemeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isConnected, address } = useBtcWallet();
  const { data: token, isLoading, refetch } = useBtcMemeToken(id);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (token && token.genesis_txid && id === token.id) {
      navigate(`/btc/meme/${token.genesis_txid}`, { replace: true });
    }
  }, [token, id, navigate]);

  const tokenId = token?.id;
  const { data: trades } = useBtcMemeTrades(tokenId);
  const { data: myBalance } = useBtcMemeBalance(tokenId, address);
  const { data: myBtcBalance } = useBtcTradingBalance(address);
  const { data: onChainBtc } = useBtcOnChainBalance(address);
  const btcUsdPrice = useBtcUsdPrice();
  const { data: holders, isLoading: holdersLoading } = useBtcMemeHolders(tokenId, token?.total_supply, token?.creator_wallet);

  const devHoldingPct = useMemo(() => {
    if (!holders || !token) return null;
    const devHolder = holders.find(h => h.is_creator);
    return devHolder ? devHolder.percentage : 0;
  }, [holders, token]);

  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [trading, setTrading] = useState(false);
  const [tradeTab, setTradeTab] = useState<"all" | "my" | "holders">("all");
  const [showDeposit, setShowDeposit] = useState(false);
  const [mobileTab, setMobileTab] = useState<'trade' | 'chart' | 'info'>('chart');
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Realtime subscription
  useEffect(() => {
    if (!tokenId) return;
    const channel = supabase
      .channel(`btc-meme-${tokenId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "btc_meme_trades", filter: `token_id=eq.${tokenId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["btc-meme-trades", tokenId] });
        queryClient.invalidateQueries({ queryKey: ["btc-meme-token", id] });
        queryClient.invalidateQueries({ queryKey: ["btc-trading-balance"] });
        queryClient.invalidateQueries({ queryKey: ["btc-meme-balance", tokenId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "btc_meme_tokens", filter: `id=eq.${tokenId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["btc-meme-token", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tokenId, id, queryClient]);

  const pollForSolanaProof = async (tradeId: string) => {
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data: row } = await supabase
        .from("btc_meme_trades")
        .select("solana_proof_signature")
        .eq("id", tradeId)
        .maybeSingle();
      if (row?.solana_proof_signature) {
        const store = useTradeSuccessStore.getState();
        if (store.isVisible && store.data) {
          store.show({ ...store.data, solanaProofSignature: row.solana_proof_signature });
        }
        return;
      }
    }
  };

  const handleTrade = async () => {
    if (!address || !tokenId || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Enter a valid amount"); return; }
    setTrading(true);
    const startMs = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-swap", {
        body: { tokenId, walletAddress: address, tradeType, amount: numAmount },
      });
      if (error) { const msg = data?.error || error.message || "Trade failed"; throw new Error(msg); }
      if (data?.error) throw new Error(data.error);

      const executionMs = Date.now() - startMs;
      const trade = data.trade;
      const tokenCA = token?.genesis_txid || id;
      const tradeId = data.tradeId;

      showTradeSuccess({
        type: tradeType, ticker: token?.ticker || "", tokenName: token?.name,
        amount: tradeType === "buy" ? `${trade.btcAmount.toFixed(8)} BTC` : `${formatNum(trade.tokenAmount)} ${token?.ticker}`,
        tokenImageUrl: token?.image_url || undefined, chain: "btc", executionMs,
        mintAddress: tokenCA, pnlSol: trade.pnlBtc ?? undefined, pnlPercent: trade.pnlPercent ?? undefined,
        signature: tradeId || undefined,
      });

      if (tradeId) pollForSolanaProof(tradeId);
      setAmount("");
    } catch (e: any) {
      toast.error(e.message || "Trade failed");
    } finally {
      setTrading(false);
    }
  };

  const handleRefresh = () => { refetch(); toast.success("Refreshed"); };
  const copyAddress = () => {
    const addr = token?.genesis_txid || id;
    if (addr) { navigator.clipboard.writeText(addr); toast.success("Address copied!"); }
  };
  const shareToken = () => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); };

  const verifiedTrades = trades?.filter((t: any) => t.solana_proof_signature) || [];
  const myTrades = verifiedTrades.filter((t: any) => t.wallet_address === address);
  const displayTrades = tradeTab === "my" ? myTrades : verifiedTrades;

  // Loading
  if (isLoading) {
    return (
      <div className="trade-page-bg p-3">
        <div className="max-w-[1600px] mx-auto space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 lg:col-span-9"><Skeleton className="h-[70vh] w-full rounded-xl" /></div>
            <div className="hidden md:block md:col-span-5 lg:col-span-3"><Skeleton className="h-[70vh] w-full rounded-xl" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="trade-page-bg flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-bold font-mono">Token not found</h2>
        <p className="text-muted-foreground mt-2 font-mono text-sm">This token doesn't exist or has been removed.</p>
        <Link to="/btc" className="mt-4">
          <Button className="px-5 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl">Back to BTC</Button>
        </Link>
      </div>
    );
  }

  const progressPct = Math.min(token.bonding_progress, 100);
  const btcBalance = myBtcBalance?.balance_btc || 0;
  const mcapUsd = token.market_cap_btc * btcUsdPrice;
  const priceUsd = token.price_btc * btcUsdPrice;
  const volUsd = token.volume_btc * btcUsdPrice;

  const stats = [
    { label: 'MCAP', value: mcapUsd > 0 ? formatUsdCompact(mcapUsd) : formatBtc(token.market_cap_btc), accent: true },
    { label: 'VOLUME', value: volUsd > 0 ? formatUsdCompact(volUsd) : formatBtc(token.volume_btc) },
    { label: 'HOLDERS', value: token.holder_count.toLocaleString() },
    { label: 'PRICE', value: priceUsd > 0 ? formatUsdCompact(priceUsd) : formatBtc(token.price_btc) },
    { label: 'TRADES', value: token.trade_count.toLocaleString() },
  ];

  /* ── Reusable Sections ── */
  const ChartSection = ({ chartHeight = 420 }: { chartHeight?: number }) => (
    <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
      <BtcMemeChart
        trades={(trades || []).filter((t: any) => t.solana_proof_signature)}
        currentPrice={token.price_btc}
        height={chartHeight}
      />
    </div>
  );

  const TradeSection = () => (
    <div className="trade-glass-panel p-4 pb-5 space-y-3">
      <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary/50" /> Trade
      </h3>

      {token.status === "pending_genesis" ? (
        <div className="text-center py-6 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground font-mono">Awaiting Bitcoin mainnet confirmation</p>
        </div>
      ) : !isConnected ? (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-muted-foreground font-mono">Connect wallet to trade</p>
          <BtcConnectWalletModal
            trigger={<Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold font-mono" size="sm">Connect Wallet</Button>}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
            <button onClick={() => setTradeType("buy")} className={`flex-1 py-2 rounded-md text-xs font-mono font-semibold transition-all ${tradeType === "buy" ? "bg-[hsl(var(--success))] text-black shadow-sm" : "text-muted-foreground/60 hover:text-foreground"}`}>Buy</button>
            <button onClick={() => setTradeType("sell")} className={`flex-1 py-2 rounded-md text-xs font-mono font-semibold transition-all ${tradeType === "sell" ? "bg-destructive text-white shadow-sm" : "text-muted-foreground/60 hover:text-foreground"}`}>Sell</button>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground/50 font-mono mb-1.5">
              <span>{tradeType === "buy" ? "Amount (BTC)" : `Amount (${token.ticker})`}</span>
              <span className="flex items-center gap-1">
                Bal: {tradeType === "buy" ? formatBtc(btcBalance) : formatNum(myBalance?.balance || 0)}
                {tradeType === "buy" && btcBalance === 0 && (
                  <button onClick={() => setShowDeposit(true)} className="ml-1 text-primary hover:text-primary/80 underline">deposit</button>
                )}
                {((tradeType === "buy" && btcBalance > 0) || (tradeType === "sell" && myBalance && myBalance.balance > 0)) && (
                  <button
                    onClick={() => {
                      if (tradeType === "buy") {
                        const maxBtc = Math.max(0, btcBalance - 0.00006);
                        setAmount(maxBtc > 0 ? maxBtc.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : "0");
                      } else {
                        setAmount(String(Math.floor(myBalance?.balance || 0)));
                      }
                    }}
                    className="text-primary hover:text-primary/80 underline font-semibold"
                  >
                    Max
                  </button>
                )}
              </span>
            </div>
            <Input type="number" step="any" min="0" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono bg-white/[0.03] border-white/[0.08]" />
            {amount && btcUsdPrice > 0 && tradeType === "buy" && (
              <p className="text-[10px] text-muted-foreground/40 mt-0.5 text-right font-mono">
                ≈ ${(parseFloat(amount) * btcUsdPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
            )}
          </div>
          {tradeType === "buy" && (
            <div className="grid grid-cols-4 gap-1">
              {[0.00005, 0.0001, 0.0005, 0.001].map((v) => (
                <button key={v} onClick={() => setAmount(String(v))} className="text-[10px] py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-foreground/80 font-mono border border-white/[0.06] transition-colors">{v} ₿</button>
              ))}
            </div>
          )}
          {tradeType === "sell" && myBalance?.balance && (
            <div className="grid grid-cols-4 gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} onClick={() => setAmount(String(Math.floor((myBalance.balance * pct) / 100)))} className="text-[10px] py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-foreground/80 font-mono border border-white/[0.06] transition-colors">{pct}%</button>
              ))}
            </div>
          )}
          {(() => {
            const numAmt = parseFloat(amount) || 0;
            const noBalanceBuy = tradeType === "buy" && btcBalance <= 0;
            const noBalanceSell = tradeType === "sell" && (!myBalance?.balance || myBalance.balance <= 0);
            const insufficientBuy = tradeType === "buy" && numAmt > 0 && numAmt > btcBalance;
            const insufficientSell = tradeType === "sell" && numAmt > 0 && numAmt > (myBalance?.balance || 0);
            const isInsufficient = insufficientBuy || insufficientSell || noBalanceBuy || noBalanceSell;
            const label = trading
              ? null
              : noBalanceBuy ? "No BTC Balance — Deposit First"
              : noBalanceSell ? "No Tokens to Sell"
              : insufficientBuy || insufficientSell ? "Insufficient Balance"
              : tradeType === "buy" ? "Buy" : "Sell";
            return (
              <>
                <Button onClick={handleTrade} disabled={trading || !amount || isInsufficient} className={`w-full font-mono font-bold ${tradeType === "buy" ? "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-black" : "bg-destructive hover:bg-destructive/90 text-white"} disabled:opacity-50`}>
                  {trading ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
                </Button>
              </>
            );
          })()}
          {myBalance && myBalance.balance > 0 && (
            <div className="bg-white/[0.03] rounded-lg p-2.5 text-xs space-y-1.5 border border-white/[0.06]">
              <div className="flex justify-between font-mono"><span className="text-muted-foreground/50">Your tokens</span><span className="text-foreground/80">{formatNum(myBalance.balance)}</span></div>
              <div className="flex justify-between font-mono"><span className="text-muted-foreground/50">Avg buy price</span><span className="text-foreground/80">{formatBtc(myBalance.avg_buy_price_btc || 0)}</span></div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const DepositWithdrawSection = () => (
    <>
      {isConnected && address && (showDeposit || btcBalance === 0) && (
        <BtcDepositPanel walletAddress={address} currentBalance={btcBalance} />
      )}
      {isConnected && address && btcBalance > 0 && (
        <BtcWithdrawPanel walletAddress={address} currentBalance={btcBalance} />
      )}
    </>
  );

  const TradeHistorySection = () => (
    <div className="trade-glass-panel p-4 flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button onClick={() => setTradeTab("all")} className={`text-[11px] font-mono uppercase tracking-wider transition-colors ${tradeTab === "all" ? "text-foreground font-bold" : "text-muted-foreground/40 hover:text-foreground/60"}`}>All Trades</button>
          {isConnected && (
            <button onClick={() => setTradeTab("my")} className={`text-[11px] font-mono uppercase tracking-wider transition-colors ${tradeTab === "my" ? "text-foreground font-bold" : "text-muted-foreground/40 hover:text-foreground/60"}`}>
              My Trades {myTrades.length > 0 && <span className="text-primary ml-0.5">({myTrades.length})</span>}
            </button>
          )}
          <button onClick={() => setTradeTab("holders")} className={`text-[11px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${tradeTab === "holders" ? "text-foreground font-bold" : "text-muted-foreground/40 hover:text-foreground/60"}`}>
            <Users className="w-3 h-3" /> Holders <span className="text-primary ml-0.5">({token.holder_count})</span>
          </button>
        </div>
        {tradeTab !== "holders" && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/40 font-mono">
            <Cpu className="w-3 h-3" /> Internal
          </div>
        )}
      </div>

      {tradeTab === "holders" ? (
        <BtcMemeHoldersTable holders={holders || []} isLoading={holdersLoading} ticker={token.ticker} currentPriceBtc={token.price_btc} creatorWallet={token.creator_wallet} />
      ) : (
        <div className="space-y-0.5 flex-1 overflow-y-auto scrollbar-thin">
          {displayTrades.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 text-center py-6 font-mono">
              {tradeTab === "my" ? "You haven't made any trades yet." : "No trades yet. Be the first!"}
            </p>
          ) : (
            displayTrades.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-white/[0.03] text-xs group transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {t.trade_type === "buy" ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-[hsl(var(--success))] flex-shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                  )}
                  <span className="font-mono text-muted-foreground/50">{truncate(t.wallet_address, 5)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`font-mono font-semibold ${t.trade_type === "buy" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                    {t.trade_type === "buy" ? "+" : "-"}{formatNum(t.token_amount)}
                  </span>
                  <span className="font-mono text-muted-foreground/40 text-[10px]">{formatBtc(t.btc_amount)}</span>
                  <a
                    href={`https://solscan.io/tx/${t.solana_proof_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-muted-foreground/40 text-[9px] hover:bg-white/[0.06] transition-colors cursor-pointer font-mono"
                  >
                    <Cpu className="w-2.5 h-2.5" /> receipt ↗
                  </a>
                  <span className="text-muted-foreground/30 text-[10px] w-12 text-right font-mono">{timeAgo(t.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const TokenDetailsSection = () => (
    <div className="trade-glass-panel p-5 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary/50" /> Token Details
        </h3>
        <span className="text-[9px] font-mono px-2.5 py-1 rounded-full bg-blue-500/8 text-blue-400/80 border border-blue-500/18 flex items-center gap-1 shrink-0">
          <Shield className="h-3 w-3" /> TAT Protocol
        </span>
      </div>
      {[
        { label: 'Price', value: priceUsd > 0 ? `${formatUsdCompact(priceUsd)} (${formatBtc(token.price_btc)})` : formatBtc(token.price_btc) },
        { label: 'Market Cap', value: mcapUsd > 0 ? `${formatUsdCompact(mcapUsd)} (${formatBtc(token.market_cap_btc)})` : formatBtc(token.market_cap_btc) },
        { label: 'Volume', value: volUsd > 0 ? `${formatUsdCompact(volUsd)} (${formatBtc(token.volume_btc)})` : formatBtc(token.volume_btc) },
        { label: 'Holders', value: token.holder_count.toLocaleString() },
        { label: 'Supply', value: formatNum(token.total_supply) },
        { label: 'Trades', value: token.trade_count.toLocaleString() },
        { label: 'Bonding', value: `${progressPct < 1 ? progressPct.toFixed(2) : progressPct.toFixed(1)}%` },
      ].map((row, i) => (
        <div key={i} className="trade-detail-row">
          <span className="text-[12px] font-mono text-muted-foreground/50">{row.label}</span>
          <span className="text-[12px] font-mono text-foreground/80 font-semibold">{row.value}</span>
        </div>
      ))}
    </div>
  );

  const ContractSection = () => {
    if (!token.genesis_txid) return null;
    return (
      <div className="trade-glass-panel p-5 space-y-2">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40">Genesis TX</h3>
        <div className="flex items-center gap-2">
          <code className="text-[12px] font-mono text-foreground/60 truncate flex-1">{token.genesis_txid.slice(0, 10)}...{token.genesis_txid.slice(-4)}</code>
          <a href={`https://mempool.space/tx/${token.genesis_txid}`} target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 p-2 min-h-[44px] flex items-center justify-center">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  };

  const DescriptionSection = () => {
    if (!token.description) return null;
    return (
      <div className="trade-glass-panel p-5">
        <p className={`text-[13px] text-muted-foreground/60 font-mono leading-relaxed ${!showFullDesc ? 'line-clamp-2' : ''}`}>{token.description}</p>
        {token.description.length > 100 && (
          <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-[12px] font-mono text-primary/60 hover:text-primary mt-2 flex items-center gap-1 min-h-[44px] transition-colors">
            {showFullDesc ? <><ChevronUp className="h-3.5 w-3.5" /> Less</> : <><ChevronDown className="h-3.5 w-3.5" /> More</>}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="trade-page-bg -mx-4 -mt-4 px-4 pt-4 md:mx-0 md:mt-0 md:pl-6 md:pr-4 md:pt-4 md:rounded-xl lg:px-6 lg:pt-6">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-4 pb-32 md:pb-24">

        {/* ──── TOP BAR ──── */}
        <div className="trade-topbar">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Link to="/btc" className="shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] rounded-lg">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <Avatar className="h-10 w-10 rounded-xl trade-avatar-glow shrink-0">
              <AvatarImage src={token.image_url || undefined} className="object-cover" />
              <AvatarFallback className="rounded-xl text-xs font-bold bg-primary/8 text-primary font-mono">
                {(token.ticker || '??').slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-2.5 min-w-0 shrink">
              <h1 className="text-[15px] md:text-base font-bold font-mono tracking-tight truncate max-w-[100px] sm:max-w-[170px] md:max-w-[240px] lg:max-w-none text-foreground">{token.name}</h1>
              <span className="text-[13px] font-mono text-muted-foreground/50 shrink-0">${token.ticker}</span>
              {token.status === "active" && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/8 text-primary/90 border border-primary/15 flex items-center gap-1 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />LIVE
                </span>
              )}
              {token.status === "graduated" && (
                <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-md bg-green-500/10 text-green-400/90 border border-green-500/18 shrink-0">GRADUATED</span>
              )}
              {token.bonding_progress >= 50 && token.status !== "graduated" && (
                <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-0.5 shrink-0" style={{ background: "hsl(45 90% 50% / 0.1)", color: "hsl(45 90% 50%)", border: "1px solid hsl(45 90% 50% / 0.2)" }}>
                  <Crown className="w-3 h-3" /> KOTH
                </span>
              )}
              {devHoldingPct !== null && devHoldingPct > 0 && (
                <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/8 text-primary/80 border border-primary/15 flex items-center gap-0.5 shrink-0">
                  <Code className="w-3 h-3" /> Dev {devHoldingPct < 0.1 ? devHoldingPct.toFixed(3) : devHoldingPct.toFixed(1)}%
                </span>
              )}
              <span className="hidden md:inline text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/8 text-blue-400/70 border border-blue-500/15 shrink-0">TAT</span>
            </div>

            <div className="flex items-center gap-2.5 ml-auto sm:ml-4 shrink-0">
              <span className="text-[15px] sm:text-base font-mono font-bold text-foreground">
                {formatBtc(token.price_btc)}
              </span>
            </div>

            {/* Inline stats — lg+ */}
            <div className="hidden lg:flex items-center gap-6 ml-6 min-w-0">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">{s.label}</span>
                  <span className={`text-[13px] font-mono font-semibold ${s.accent ? 'text-yellow-400' : 'text-foreground/80'}`}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 ml-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={handleRefresh}><RefreshCw className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={copyAddress}><Copy className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={shareToken}><Share2 className="h-3.5 w-3.5" /></Button>
              {token.genesis_txid && (
                <a href={`https://mempool.space/tx/${token.genesis_txid}`} target="_blank" rel="noopener noreferrer" className="hidden md:flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><ExternalLink className="h-3.5 w-3.5" /></Button>
                </a>
              )}
              {(token as any).twitter_url && (
                <a href={(token as any).twitter_url} target="_blank" rel="noopener noreferrer" className="hidden md:flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </Button>
                </a>
              )}
              {(token as any).website_url && (
                <a href={(token as any).website_url} target="_blank" rel="noopener noreferrer" className="hidden md:flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><ExternalLink className="h-3.5 w-3.5" /></Button>
                </a>
              )}
            </div>
          </div>

          {/* Tablet stats row */}
          <div className="hidden sm:flex lg:hidden items-center gap-6 px-5 py-2.5 overflow-x-auto scrollbar-none border-t border-white/[0.04]">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">{s.label}</span>
                <span className={`text-[13px] font-mono font-semibold ${s.accent ? 'text-yellow-400' : 'text-foreground/80'}`}>{s.value}</span>
              </div>
            ))}
            <span className="text-[9px] font-mono px-2.5 py-1 rounded-full bg-primary/6 text-primary/70 border border-primary/12 flex items-center gap-1 shrink-0">
              <Shield className="h-3 w-3" /> TAT PROTOCOL
            </span>
          </div>
        </div>

        {/* Pending Genesis Banner */}
        {token.status === "pending_genesis" && (
          <div className="trade-glass-panel flex items-center gap-3 px-5 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground font-mono">Awaiting Bitcoin Mainnet Confirmation</p>
              <p className="text-xs text-muted-foreground/50 font-mono">Genesis OP_RETURN transaction is being confirmed. Trading will auto-activate.</p>
            </div>
          </div>
        )}

        {/* ── PHONE STATS ── */}
        <div className="md:hidden grid grid-cols-3 gap-2.5">
          {stats.slice(0, 3).map((s, i) => (
            <div key={i} className="trade-stat-card">
              <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">{s.label}</p>
              <p className={`text-sm font-mono font-bold mt-1 ${s.accent ? 'text-yellow-400' : 'text-foreground/90'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── BONDING PROGRESS ── */}
        {token.status === "active" && (
          <div className="trade-glass-panel flex items-center gap-4 px-5 py-3">
            <Zap className="h-4 w-4 text-primary/70 shrink-0" />
            <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider shrink-0">Bonding</span>
            <div className="flex-1 min-w-[80px]">
              <div className="trade-bonding-bar">
                <div className="trade-bonding-fill" style={{ width: `${Math.max(Math.min(progressPct, 100), 1)}%` }} />
              </div>
            </div>
            <span className="text-sm font-mono font-bold text-primary shrink-0 hidden md:inline">{progressPct < 1 ? progressPct.toFixed(2) : progressPct.toFixed(1)}%</span>
            <span className="text-[12px] font-mono text-muted-foreground/50 shrink-0">{formatBtc(token.real_btc_reserves || 0)} / {formatBtc(token.graduation_threshold_btc || 0.5)}</span>
          </div>
        )}

        {/* ── PHONE TAB SWITCHER ── */}
        <div className="md:hidden">
          <div className="flex bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
            {(['trade', 'chart', 'info'] as const).map(tab => (
              <button key={tab} onClick={() => setMobileTab(tab)}
                className={`flex-1 py-2.5 text-[12px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-lg ${
                  mobileTab === tab
                    ? 'bg-white/[0.06] text-foreground font-bold'
                    : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                }`}>
                {tab === 'trade' && <Activity className="h-3.5 w-3.5" />}
                {tab === 'chart' && <BarChart3 className="h-3.5 w-3.5" />}
                {tab === 'info' && <Shield className="h-3.5 w-3.5" />}
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ MAIN CONTENT ═══ */}

        {/* PHONE */}
        <div className="md:hidden flex flex-col gap-3">
          {mobileTab === 'trade' && (
            <>
              <TradeSection />
              <DepositWithdrawSection />
              <TradeHistorySection />
            </>
          )}
          {mobileTab === 'chart' && (
            <>
              <ChartSection chartHeight={360} />
              <TradeHistorySection />
            </>
          )}
          {mobileTab === 'info' && (
            <>
              <TokenDetailsSection />
              <ContractSection />
              <DescriptionSection />
            </>
          )}
        </div>

        {/* TABLET */}
        <div className="hidden md:grid lg:hidden grid-cols-12 gap-4">
          <div className="col-span-7 flex flex-col gap-4">
            <ChartSection chartHeight={440} />
            <TradeHistorySection />
            <TokenDetailsSection />
            <ContractSection />
            <DescriptionSection />
          </div>
          <div className="col-span-5 flex flex-col gap-4">
            <div className="sticky top-4 flex flex-col gap-4">
              <TradeSection />
              <DepositWithdrawSection />
            </div>
          </div>
        </div>

        {/* DESKTOP */}
        <div className="hidden lg:grid grid-cols-12 gap-4 flex-1">
          <div className="col-span-9 flex flex-col gap-4">
            <ChartSection chartHeight={420} />
            <TradeHistorySection />
          </div>
          <div className="col-span-3 flex flex-col gap-4">
            <TradeSection />
            <DepositWithdrawSection />
            <TokenDetailsSection />
            <ContractSection />
            <DescriptionSection />
          </div>
        </div>

      </div>
    </div>
  );
}
