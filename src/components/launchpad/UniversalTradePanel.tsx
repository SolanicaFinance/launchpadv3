import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useTransakOnramp } from "@/hooks/useTransakOnramp";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { useTurboSwap } from "@/hooks/useTurboSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Loader2, Wallet, AlertTriangle, ExternalLink, ChevronDown, CheckCircle2, XCircle, HelpCircle, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRugCheck } from "@/hooks/useRugCheck";
import { Connection, PublicKey } from "@solana/web3.js";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { ProfitCardModal, ProfitCardData } from "@/components/launchpad/ProfitCardModal";
import type { Token } from "@/hooks/useLaunchpad";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";

interface TokenInfo {
  mint_address: string;
  ticker: string;
  name: string;
  decimals?: number;
  graduated?: boolean;
  price_sol?: number;
  imageUrl?: string;
}

interface UniversalTradePanelProps {
  token: TokenInfo;
  userTokenBalance?: number;
}

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5, 10];
const HELIUS_RPC = import.meta.env.VITE_HELIUS_RPC_URL || (import.meta.env.VITE_HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}` : "https://mainnet.helius-rpc.com");

export function UniversalTradePanel({ token, userTokenBalance: externalTokenBalance }: UniversalTradePanelProps) {
  const { isAuthenticated, login, solanaAddress, profileId } = useAuth();
  const { openTransak } = useTransakOnramp();
  const { getBuyQuote, getSellQuote } = useJupiterSwap();
  const { executeTurboSwap, isLoading: turboLoading } = useTurboSwap();
  const { isWalletReady, getBalance } = useSolanaWalletWithPrivy();

  // Build Token object for TurboSwap
  const turboToken: Token = useMemo(() => ({
    id: token.mint_address,
    mint_address: token.mint_address,
    name: token.name,
    ticker: token.ticker,
    description: null,
    image_url: token.imageUrl ?? null,
    website_url: null,
    twitter_url: null,
    telegram_url: null,
    discord_url: null,
    creator_wallet: "",
    creator_id: null,
    dbc_pool_address: null,
    damm_pool_address: null,
    virtual_sol_reserves: 0,
    virtual_token_reserves: 0,
    real_sol_reserves: 0,
    real_token_reserves: 0,
    total_supply: 0,
    bonding_curve_progress: 0,
    graduation_threshold_sol: 0,
    price_sol: token.price_sol ?? 0,
    market_cap_sol: 0,
    volume_24h_sol: 0,
    status: (token.graduated !== false ? "graduated" : "bonding") as Token["status"],
    migration_status: "",
    holder_count: 0,
    created_at: "",
    updated_at: "",
    graduated_at: null,
  }), [token]);

  const preferJupiterRoute = token.graduated !== false;
  const [jupiterQuoteFailed, setJupiterQuoteFailed] = useState(false);
  const useJupiterRoute = preferJupiterRoute && !jupiterQuoteFailed;

  const { toast } = useToast();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(5);
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [onChainTokenBalance, setOnChainTokenBalance] = useState<number | null>(null);
  const [instaBuy, setInstaBuy] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [showLatency, setShowLatency] = useState(false);
  const [profitCardData, setProfitCardData] = useState<ProfitCardData | null>(null);
  const [showProfitCard, setShowProfitCard] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isBuy = tradeType === 'buy';
  const numericAmount = parseFloat(amount) || 0;
  const tokenDecimals = token.decimals || 9;
  const userTokenBalance = onChainTokenBalance ?? externalTokenBalance ?? 0;

  // Fetch SOL balance
  useEffect(() => {
    if (isAuthenticated && solanaAddress) {
      getBalance().then(setSolBalance).catch(() => setSolBalance(null));
    }
  }, [isAuthenticated, solanaAddress, getBalance, isLoading]);

  const { walletAddress: embeddedWallet, getTokenBalance: getTokenBalancePrivy } = useSolanaWalletWithPrivy();
  const effectiveWallet = embeddedWallet || solanaAddress;

  const refreshTokenBalance = useCallback(async () => {
    if (!isAuthenticated || !effectiveWallet || !token.mint_address) { setOnChainTokenBalance(null); return; }
    try {
      const connection = new Connection(HELIUS_RPC);
      const owner = new PublicKey(effectiveWallet);
      const mint = new PublicKey(token.mint_address);
      const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
      const bal = resp.value.reduce((sum, acc) => {
        const ta = acc.account?.data?.parsed?.info?.tokenAmount;
        const v = typeof ta?.uiAmount === 'number' ? ta.uiAmount : (ta?.uiAmountString ? parseFloat(ta.uiAmountString) : 0);
        return sum + (isFinite(v) ? v : 0);
      }, 0);
      setOnChainTokenBalance(bal);
    } catch { /* keep previous */ }
  }, [isAuthenticated, effectiveWallet, token.mint_address]);

  useEffect(() => { void refreshTokenBalance(); }, [refreshTokenBalance, isLoading]);
  useEffect(() => {
    if (!isAuthenticated || !effectiveWallet || !token.mint_address) return;
    const interval = window.setInterval(() => void refreshTokenBalance(), 3000);
    const onFocus = () => void refreshTokenBalance();
    const onVisibility = () => { if (document.visibilityState === 'visible') void refreshTokenBalance(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility); };
  }, [isAuthenticated, effectiveWallet, token.mint_address, refreshTokenBalance]);

  // Jupiter quotes
  useEffect(() => {
    if (!preferJupiterRoute) { setQuote(null); setQuoteLoading(false); setJupiterQuoteFailed(false); return; }
    const fetchQuote = async () => {
      if (numericAmount <= 0 || !token.mint_address) { setQuote(null); setJupiterQuoteFailed(false); return; }
      setQuoteLoading(true);
      try {
        const result = isBuy
          ? await getBuyQuote(token.mint_address, numericAmount, slippage * 100)
          : await getSellQuote(token.mint_address, numericAmount, tokenDecimals, slippage * 100);
        if (result) { setQuote({ outAmount: result.outAmount, priceImpactPct: result.priceImpactPct }); setJupiterQuoteFailed(false); }
        else { setQuote(null); setJupiterQuoteFailed(true); }
      } catch { setQuote(null); setJupiterQuoteFailed(true); }
      finally { setQuoteLoading(false); }
    };
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [numericAmount, isBuy, token.mint_address, tokenDecimals, slippage, getBuyQuote, getSellQuote, preferJupiterRoute]);

  const outputAmount = (() => {
    if (useJupiterRoute && quote) return parseInt(quote.outAmount) / (10 ** (isBuy ? tokenDecimals : 9));
    if (!useJupiterRoute && numericAmount > 0 && token.price_sol && token.price_sol > 0) {
      return isBuy ? numericAmount / token.price_sol : numericAmount * token.price_sol;
    }
    return 0;
  })();
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;

  const quickBuyAmounts = [0.1, 0.5, 1, 5];
  const quickSellPct = [25, 50, 75, 100];

  const formatAmount = (amt: number, decimals: number = 4) => {
    if (amt >= 1_000_000) return `${(amt / 1_000_000).toFixed(2)}M`;
    if (amt >= 1_000) return `${(amt / 1_000).toFixed(2)}K`;
    return amt.toFixed(decimals);
  };

  const handleQuickAmount = (value: number, index: number) => {
    if (isBuy) { setAmount(value.toString()); }
    else { setAmount(((userTokenBalance * value) / 100).toString()); }
    setSelectedPreset(index);
  };

  const handleMaxClick = () => {
    if (isBuy && solBalance !== null) { setAmount(Math.max(0, solBalance - 0.005).toFixed(4)); }
    else if (!isBuy) { setAmount(userTokenBalance.toString()); }
    setSelectedPreset(null);
  };

  const handleSlippagePreset = (val: number) => { setSlippage(val); setShowCustomSlippage(false); setCustomSlippage(''); };
  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) setSlippage(num);
  };

  const handleTrade = async () => {
    if (!numericAmount || numericAmount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (!isBuy && numericAmount > userTokenBalance) { toast({ title: "Insufficient token balance", variant: "destructive" }); return; }
    if (!solanaAddress) { toast({ title: "Please connect your wallet", variant: "destructive" }); return; }

    setIsLoading(true);
    const t0 = performance.now();
    try {
      // Use the same TurboSwap pipeline as Pulse quick buy
      const result = await executeTurboSwap(turboToken, numericAmount, isBuy, slippage * 100);

      const latency = Math.round(performance.now() - t0);
      setLastLatencyMs(latency);
      setShowLatency(true);
      setTimeout(() => setShowLatency(false), 5000);

      setAmount(''); setQuote(null); setSelectedPreset(null);

      // Show global trade success notification (same as Pulse)
      showTradeSuccess({
        type: isBuy ? 'buy' : 'sell',
        ticker: token.ticker,
        tokenName: token.name,
        mintAddress: token.mint_address,
        amount: isBuy ? `${numericAmount} SOL` : `${formatAmount(numericAmount)} ${token.ticker}`,
        signature: result.signature,
        executionMs: result.totalMs || latency,
        tokenImageUrl: token.imageUrl,
      });

      // Also show PNL card
      setProfitCardData({ action: isBuy ? 'buy' : 'sell', amountSol: isBuy ? numericAmount : (result.outputAmount ?? numericAmount * (token.price_sol || 0)), tokenTicker: token.ticker, tokenName: token.name, outputAmount: result.outputAmount, signature: result.signature, tokenImageUrl: token.imageUrl });
      setShowProfitCard(true);

    } catch (error) {
      console.error('Trade error:', error);
      toast({ title: "Trade failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const buttonLoading = isLoading || turboLoading;
  const { data: rugCheck, isLoading: rugLoading } = useRugCheck(token.mint_address);

  const safetyChecks = [
    { label: "Launched", passed: token.graduated !== false, loading: false },
    { label: "Mint revoked", passed: rugCheck?.mintAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Freeze revoked", passed: rugCheck?.freezeAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Liq locked", passed: rugCheck?.liquidityLocked ?? null, loading: rugLoading },
    { label: "Top 10 < 30%", passed: rugCheck ? rugCheck.topHolderPct < 30 : null, loading: rugLoading },
  ];

  return (
    <>
    <div className="trade-glass-panel overflow-hidden">
      {/* ── Buy / Sell Toggle ── */}
      <div className="grid grid-cols-2">
        <button
          onClick={() => { setTradeType('buy'); setQuote(null); setSelectedPreset(null); }}
          className={`py-3.5 text-[13px] font-bold font-mono uppercase tracking-widest transition-all border-b-2 ${
            isBuy
              ? 'text-green-400 border-green-400/70 bg-green-400/[0.04]'
              : 'text-muted-foreground/40 hover:text-muted-foreground/60 border-transparent'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setTradeType('sell'); setQuote(null); setSelectedPreset(null); }}
          className={`py-3.5 text-[13px] font-bold font-mono uppercase tracking-widest transition-all border-b-2 ${
            !isBuy
              ? 'text-red-400 border-red-400/70 bg-red-400/[0.04]'
              : 'text-muted-foreground/40 hover:text-muted-foreground/60 border-transparent'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Slippage ── */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/60">Slippage Tolerance</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SLIPPAGE_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => handleSlippagePreset(v)}
                className={`text-[12px] font-mono font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  slippage === v && !showCustomSlippage
                    ? 'border-primary/30 bg-primary/8 text-primary'
                    : 'border-white/[0.12] text-foreground/50 hover:border-white/[0.2] hover:text-foreground/70'
                }`}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>

        {/* ── MEV Protection ── */}
        <div className="flex items-center gap-2.5 text-[11px] font-mono text-foreground/55">
          <span className="w-2 h-2 rounded-full bg-green-500/70" />
          <span>Jito MEV Protection</span>
          <span className="text-foreground/30">•</span>
          <span>Anti-sandwich</span>
        </div>

        {/* ── Quick Presets ── */}
        <div className="grid grid-cols-4 gap-[6px]">
          {(isBuy ? quickBuyAmounts : quickSellPct).map((v, i) => (
            <button
              key={v}
              onClick={() => handleQuickAmount(v, i)}
              aria-label={isBuy ? `Select ${v} SOL` : `Select ${v}%`}
              className={`h-[34px] rounded-[10px] font-mono text-[12px] font-bold border transition-all duration-150 flex items-center justify-center gap-[5px] hover:scale-[1.04] hover:brightness-110 active:scale-[0.96] ${
                selectedPreset === i
                  ? isBuy
                    ? 'border-[#00C4B4]/40 bg-[#00C4B4]/15 text-[#00C4B4] shadow-[0_0_6px_rgba(0,196,180,0.2)]'
                    : 'border-destructive/40 bg-destructive/15 text-destructive shadow-[0_0_6px_rgba(255,77,77,0.15)]'
                  : 'border-[#2A2A4A] bg-[#1A1A3A] text-[#A0A0B8] hover:border-[#3A3A5A] hover:text-foreground/75'
              }`}
            >
              {isBuy && (
                <img
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                  alt=""
                  className="w-[14px] h-[14px] rounded-full shrink-0"
                />
              )}
              <span>{isBuy ? v : `${v}%`}</span>
            </button>
          ))}
        </div>

        {/* ── Amount Input ── */}
        <div>
          <div className="flex justify-between items-center mb-2.5 gap-2">
            <span className="text-[12px] font-mono uppercase tracking-wider text-foreground/60">
              {isBuy ? 'Amount to buy' : `Sell ${token.ticker}`}
            </span>
            <span className="text-[12px] font-mono text-foreground/50 truncate">
              Bal: {isBuy
                ? (solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—')
                : `${formatAmount(userTokenBalance)} ${token.ticker.length > 6 ? token.ticker.slice(0, 5) + '…' : token.ticker}`}
            </span>
          </div>
          <div className="relative border border-white/[0.08] rounded-xl hover:border-white/[0.14] focus-within:border-green-500/30 focus-within:ring-1 focus-within:ring-green-500/10 transition-all overflow-hidden bg-white/[0.02]">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={(() => {
                if (!amount) return '';
                const num = parseFloat(amount);
                if (!isFinite(num)) return amount;
                if (!isBuy && num >= 10_000) return formatAmount(num);
                return amount;
              })()}
              onChange={(e) => {
                const raw = e.target.value.replace(/[KMBkmb]/g, '');
                if (raw === '' || /^\d*\.?\d*$/.test(raw)) { setAmount(raw); setSelectedPreset(null); }
              }}
              className="w-full border-0 bg-transparent font-mono h-12 pl-5 pr-28 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-foreground/25 text-foreground text-[16px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 shrink-0">
              <button onClick={handleMaxClick}
                className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-primary/8 text-primary/80 hover:bg-primary/12 transition-colors border border-primary/15">
                MAX
              </button>
              <span className="text-[13px] font-mono text-foreground/60 flex items-center gap-1">
                {isBuy
                  ? <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="SOL" className="w-4 h-4 rounded-full" />
                  : token.imageUrl && <img src={token.imageUrl} alt={token.ticker} className="w-4 h-4 rounded-full" />}
                {isBuy ? 'SOL' : (token.ticker.length > 6 ? token.ticker.slice(0, 5) + '…' : token.ticker)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Price Display ── */}
        <div className="py-1">
          <span className="text-[12px] font-mono text-foreground/50">
            1 {token.name} = {token.price_sol ? token.price_sol.toFixed(6) : '—'} SOL
          </span>
        </div>

        {/* ── Price Impact Warning ── */}
        {priceImpact > 5 && (
          <div className="flex items-center gap-2.5 p-3 bg-destructive/8 rounded-xl text-destructive text-[13px] font-mono border border-destructive/15">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>High price impact: {priceImpact.toFixed(2)}%</span>
          </div>
        )}

        {/* ── Buy with Credit Card ── */}
        <button
          onClick={() => setShowLoginModal(true)}
          className="w-full h-11 rounded-xl text-[12px] font-semibold tracking-wide transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500/50"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Buy ${token.ticker} with Credit Card
        </button>

        {/* ── Action Button ── */}
        {!isAuthenticated ? (
          <Button className="w-full h-13 font-mono text-sm uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => setShowLoginModal(true)}>
            <Wallet className="h-4 w-4 mr-2" /> Connect Wallet
          </Button>
        ) : (
          <div className="space-y-2">
            <button onClick={handleTrade} disabled={buttonLoading || !numericAmount || (useJupiterRoute && !jupiterQuoteFailed && quoteLoading) || !isWalletReady}
              className={`w-full h-13 rounded-xl font-mono text-[14px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isBuy ? 'bg-green-500 hover:bg-green-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'
              }`}>
              {buttonLoading ? <Loader2 className="h-4 w-4 animate-spin" />
                : useJupiterRoute && !jupiterQuoteFailed && quoteLoading ? 'Getting quote...'
                : isBuy ? (
                  <span className="flex items-center gap-2">QUICK BUY <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="" className="w-4 h-4 rounded-full" /> {numericAmount || ''}</span>
                ) : (
                  <span className="flex items-center gap-2">SELL {token.imageUrl && <img src={token.imageUrl} alt={token.ticker} className="w-4 h-4 rounded-full" />} {token.ticker}</span>
                )}
            </button>
            {showLatency && lastLatencyMs !== null && (
              <p className="text-[11px] font-mono text-primary/50 text-center animate-in fade-in duration-300">⚡ {lastLatencyMs}ms</p>
            )}
            {isBuy && !showLatency && (
              <p className="text-[10px] font-mono text-foreground/40 text-center">Once you click Quick Buy, your transaction is sent immediately</p>
            )}
          </div>
        )}

        {/* ── Share P&L ── */}
        <div className="flex items-center justify-between py-2.5 border-t border-white/[0.06]">
          <span className="text-[11px] font-mono text-foreground/50">Share your P&L</span>
          <button
            onClick={() => { setProfitCardData({ action: isBuy ? 'buy' : 'sell', amountSol: numericAmount || 0, tokenTicker: token.ticker, tokenName: token.name }); setShowProfitCard(true); }}
            className="text-[11px] font-mono font-bold text-primary/80 hover:text-primary flex items-center gap-1.5 transition-colors bg-primary/6 px-3 py-1.5 rounded-lg hover:bg-primary/10">
            🪐 Generate PNL Card
          </button>
        </div>

        {/* ── Advanced Settings ── */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center justify-center w-full text-[12px] font-mono font-bold uppercase tracking-widest text-primary/70 hover:text-primary transition-colors py-2.5">
            <span>Advanced Settings</span>
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {safetyChecks.map((check) => (
                <div key={check.label} className="flex flex-col items-center gap-1.5 py-2.5">
                  {check.loading ? <Loader2 className="h-5 w-5 text-muted-foreground/30 animate-spin" />
                    : check.passed === true ? <CheckCircle2 className="h-5 w-5 text-green-500/80" />
                    : check.passed === false ? <XCircle className="h-5 w-5 text-destructive/80" />
                    : <HelpCircle className="h-5 w-5 text-foreground/30" />}
                  <span className="text-[10px] font-mono text-foreground/50 text-center leading-tight">{check.label}</span>
                </div>
              ))}
            </div>

            {numericAmount > 0 && (
              <div className="space-y-2 text-[12px] font-mono border-t border-white/[0.05] pt-3">
                {outputAmount > 0 && (
                  <div className="flex justify-between text-foreground/55">
                    <span>You Receive</span>
                    <span className="text-foreground/80 font-semibold">{formatAmount(outputAmount)} {isBuy ? token.ticker : 'SOL'}</span>
                  </div>
                )}
                {quote && (
                  <div className="flex justify-between text-foreground/55">
                    <span>Price Impact</span>
                    <span className={priceImpact > 5 ? 'text-destructive' : 'text-foreground/80'}>{priceImpact.toFixed(2)}%</span>
                  </div>
                )}
                <div className="flex justify-between text-foreground/55">
                  <span>Slippage</span>
                  <span className="text-foreground/80">{slippage}%</span>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
    <ProfitCardModal open={showProfitCard} onClose={() => setShowProfitCard(false)} data={profitCardData} />
    <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </>
  );
}