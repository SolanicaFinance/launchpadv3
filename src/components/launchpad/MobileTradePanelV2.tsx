import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { useTurboSwap } from "@/hooks/useTurboSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useRugCheck } from "@/hooks/useRugCheck";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, AlertTriangle, ExternalLink, Settings2 } from "lucide-react";
import { AdvancedSettingsSheet } from "./AdvancedSettingsSheet";
import { ProfitCardModal, type ProfitCardData } from "./ProfitCardModal";
import { Connection, PublicKey } from "@solana/web3.js";
import { showTradeSuccess } from "@/stores/tradeSuccessStore";
import { Token, calculateBuyQuote, calculateSellQuote, formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";

const HELIUS_RPC = import.meta.env.VITE_HELIUS_RPC_URL || (import.meta.env.VITE_HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}` : "https://mainnet.helius-rpc.com");
const SOL_LOGO = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

interface MobileTradePanelV2Props {
  bondingToken?: Token;
  externalToken?: {
    mint_address: string;
    ticker: string;
    name: string;
    decimals?: number;
    graduated?: boolean;
    price_sol?: number;
    imageUrl?: string;
  };
  userTokenBalance?: number;
}

export function MobileTradePanelV2({ bondingToken, externalToken, userTokenBalance: externalBalance = 0 }: MobileTradePanelV2Props) {
  const { isAuthenticated, login, solanaAddress, profileId } = useAuth();
  const { getBuyQuote, getSellQuote } = useJupiterSwap();
  const { executeTurboSwap, isLoading: turboLoading, walletAddress: turboWallet } = useTurboSwap();
  const { isWalletReady, walletAddress: embeddedWallet, getTokenBalance: getTokenBalancePrivy, getBalance } = useSolanaWalletWithPrivy();
  const { toast } = useToast();

  const isBondingMode = !!bondingToken;
  const tokenInfo = bondingToken
    ? { mint_address: bondingToken.mint_address, ticker: bondingToken.ticker, name: bondingToken.name, decimals: 6, price_sol: bondingToken.price_sol, imageUrl: bondingToken.image_url || undefined }
    : externalToken!;

  const mintAddress = tokenInfo.mint_address;
  const tokenDecimals = tokenInfo.decimals || 9;

  // Build a Token object for useTurboSwap (same bridge pattern as Pulse)
  const turboToken: Token = useMemo(() => {
    if (bondingToken) return bondingToken;
    return {
      id: externalToken?.mint_address ?? "",
      mint_address: externalToken?.mint_address ?? "",
      name: externalToken?.name ?? "",
      ticker: externalToken?.ticker ?? "",
      description: null,
      image_url: externalToken?.imageUrl ?? null,
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
      price_sol: externalToken?.price_sol ?? 0,
      market_cap_sol: 0,
      volume_24h_sol: 0,
      status: (externalToken?.graduated !== false ? "graduated" : "bonding") as Token["status"],
      migration_status: "",
      holder_count: 0,
      created_at: "",
      updated_at: "",
      graduated_at: null,
    };
  }, [bondingToken, externalToken]);

  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [slippage, setSlippage] = useState(1);
  const [instaBuy, setInstaBuy] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [onChainTokenBalance, setOnChainTokenBalance] = useState<number | null>(null);
  const [jupiterQuoteFailed, setJupiterQuoteFailed] = useState(false);
  const [quote, setQuote] = useState<{ outAmount: string; priceImpactPct: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [profitCardData, setProfitCardData] = useState<ProfitCardData | null>(null);
  const [showProfitCard, setShowProfitCard] = useState(false);

  const isBuy = tradeType === "buy";
  const numericAmount = parseFloat(amount) || 0;
  const effectiveWallet = embeddedWallet || solanaAddress;
  const userTokenBalance = onChainTokenBalance ?? externalBalance;
  const useJupiterRoute = !isBondingMode && !jupiterQuoteFailed;

  // SOL balance
  useEffect(() => {
    if (isAuthenticated && solanaAddress) {
      getBalance().then(setSolBalance).catch(() => setSolBalance(null));
    }
  }, [isAuthenticated, solanaAddress, getBalance, isLoading]);

  // Token balance
  const refreshTokenBalance = useCallback(async () => {
    if (!isAuthenticated || !effectiveWallet || !mintAddress) return;
    try {
      if (isBondingMode) {
        const bal = await getTokenBalancePrivy(mintAddress);
        setOnChainTokenBalance(bal);
      } else {
        const connection = new Connection(HELIUS_RPC);
        const owner = new PublicKey(effectiveWallet);
        const mint = new PublicKey(mintAddress);
        const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
        const bal = resp.value.reduce((sum, acc) => {
          const ta = acc.account?.data?.parsed?.info?.tokenAmount;
          const v = typeof ta?.uiAmount === "number" ? ta.uiAmount : ta?.uiAmountString ? parseFloat(ta.uiAmountString) : 0;
          return sum + (isFinite(v) ? v : 0);
        }, 0);
        setOnChainTokenBalance(bal);
      }
    } catch { /* keep previous */ }
  }, [isAuthenticated, effectiveWallet, mintAddress, isBondingMode, getTokenBalancePrivy]);

  useEffect(() => { void refreshTokenBalance(); }, [refreshTokenBalance, isLoading, tradeType]);
  useEffect(() => {
    if (!isAuthenticated || !effectiveWallet || !mintAddress) return;
    const interval = window.setInterval(() => void refreshTokenBalance(), 3000);
    const onFocus = () => void refreshTokenBalance();
    const onVis = () => { if (document.visibilityState === "visible") void refreshTokenBalance(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVis); };
  }, [isAuthenticated, effectiveWallet, mintAddress, refreshTokenBalance]);

  // Jupiter quotes
  useEffect(() => {
    if (isBondingMode) { setQuote(null); return; }
    const fetchQuote = async () => {
      if (numericAmount <= 0 || !mintAddress) { setQuote(null); setJupiterQuoteFailed(false); return; }
      setQuoteLoading(true);
      try {
        const result = isBuy
          ? await getBuyQuote(mintAddress, numericAmount, slippage * 100)
          : await getSellQuote(mintAddress, numericAmount, tokenDecimals, slippage * 100);
        if (result) { setQuote({ outAmount: result.outAmount, priceImpactPct: result.priceImpactPct }); setJupiterQuoteFailed(false); }
        else { setQuote(null); setJupiterQuoteFailed(true); }
      } catch { setQuote(null); setJupiterQuoteFailed(true); }
      finally { setQuoteLoading(false); }
    };
    const t = setTimeout(fetchQuote, 500);
    return () => clearTimeout(t);
  }, [numericAmount, isBuy, mintAddress, tokenDecimals, slippage, getBuyQuote, getSellQuote, isBondingMode]);

  // Compute output
  const outputAmount = (() => {
    if (isBondingMode && bondingToken) {
      const virtualSol = (bondingToken.virtual_sol_reserves || 30) + (bondingToken.real_sol_reserves || 0);
      const virtualToken = (bondingToken.virtual_token_reserves || 1_000_000_000) - (bondingToken.real_token_reserves || 0);
      return isBuy ? calculateBuyQuote(numericAmount, virtualSol, virtualToken).tokensOut : calculateSellQuote(numericAmount, virtualSol, virtualToken).solOut;
    }
    if (useJupiterRoute && quote) return parseInt(quote.outAmount) / 10 ** (isBuy ? tokenDecimals : 9);
    if (!useJupiterRoute && numericAmount > 0 && tokenInfo.price_sol && tokenInfo.price_sol > 0) {
      return isBuy ? numericAmount / tokenInfo.price_sol : numericAmount * tokenInfo.price_sol;
    }
    return 0;
  })();

  const priceImpact = (() => {
    if (isBondingMode && bondingToken && numericAmount > 0) {
      const virtualSol = (bondingToken.virtual_sol_reserves || 30) + (bondingToken.real_sol_reserves || 0);
      const virtualToken = (bondingToken.virtual_token_reserves || 1_000_000_000) - (bondingToken.real_token_reserves || 0);
      return isBuy ? calculateBuyQuote(numericAmount, virtualSol, virtualToken).priceImpact : calculateSellQuote(numericAmount, virtualSol, virtualToken).priceImpact;
    }
    return quote ? parseFloat(quote.priceImpactPct) : 0;
  })();

  const quickBuyAmounts = [0.1, 0.5, 1, 5];
  const quickSellPct = [25, 50, 75, 100];

  const handleQuickAmount = (value: number, index: number) => {
    if (isBuy) setAmount(value.toString());
    else {
      // Store full precision internally but display is handled by formatAmount
      const sellAmt = (userTokenBalance * value) / 100;
      setAmount(sellAmt.toString());
    }
    setSelectedPreset(index);
  };

  const handleMaxClick = () => {
    if (isBuy && solBalance !== null) setAmount(Math.max(0, solBalance - 0.005).toFixed(4));
    else if (!isBuy) setAmount(userTokenBalance.toString());
    setSelectedPreset(null);
  };

  /** Abbreviate large numbers: 975982.97 → "975.98K", 1234567 → "1.23M" */
  const formatAmount = (amt: number) => {
    if (amt >= 1_000_000_000) return `${(amt / 1_000_000_000).toFixed(2)}B`;
    if (amt >= 1_000_000) return `${(amt / 1_000_000).toFixed(2)}M`;
    if (amt >= 10_000) return `${(amt / 1_000).toFixed(1)}K`;
    if (amt >= 1_000) return `${(amt / 1_000).toFixed(2)}K`;
    if (amt >= 1) return amt.toFixed(4);
    if (amt >= 0.001) return amt.toFixed(6);
    return amt.toFixed(9);
  };

  /** Format the amount input value for display — abbreviate if selling huge token amounts */
  const displayInputValue = (() => {
    if (!amount) return '';
    const num = parseFloat(amount);
    if (!isFinite(num)) return amount;
    // For sell side with large token amounts, show abbreviated in the input
    if (!isBuy && num >= 10_000) return formatAmount(num);
    // For buy side or small amounts, show as-is (user typed it)
    return amount;
  })();

  const handleTrade = async () => {
    if (!numericAmount || numericAmount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (!isBuy && numericAmount > userTokenBalance) { toast({ title: "Insufficient token balance", variant: "destructive" }); return; }
    if (isBuy && solBalance !== null && numericAmount > solBalance) { toast({ title: "Insufficient SOL balance", variant: "destructive" }); return; }
    if (!solanaAddress) { toast({ title: "Please connect your wallet", variant: "destructive" }); return; }

    setIsLoading(true);
    try {
      // Use the same TurboSwap pipeline as Pulse quick buy
      const result = await executeTurboSwap(turboToken, numericAmount, isBuy, slippage * 100);

      const signature = result.signature;
      const resultOutputAmount = result.outputAmount;

      setAmount("");
      setQuote(null);
      setSelectedPreset(null);
      getBalance().then(setSolBalance).catch(() => {});
      void refreshTokenBalance();
      window.setTimeout(() => void refreshTokenBalance(), 1500);
      window.setTimeout(() => void refreshTokenBalance(), 5000);

      // Show global trade success notification (same as Pulse)
      showTradeSuccess({
        type: isBuy ? 'buy' : 'sell',
        ticker: tokenInfo.ticker,
        tokenName: tokenInfo.name,
        mintAddress,
        amount: isBuy ? `${numericAmount} SOL` : `${formatAmount(numericAmount)} ${tokenInfo.ticker}`,
        signature,
        executionMs: result.totalMs || undefined,
        tokenImageUrl: tokenInfo.imageUrl,
      });

      // Also show PNL card
      const solValue = !isBuy ? (resultOutputAmount ?? numericAmount * (tokenInfo.price_sol || 0)) : numericAmount;
      setProfitCardData({ action: isBuy ? "buy" : "sell", amountSol: solValue, tokenTicker: tokenInfo.ticker, tokenName: tokenInfo.name, outputAmount: resultOutputAmount, signature, tokenImageUrl: tokenInfo.imageUrl });
      setShowProfitCard(true);

    } catch (error) {
      console.error("Trade error:", error);
      toast({ title: "Trade failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Safety checks
  const { data: rugCheck, isLoading: rugLoading } = useRugCheck(mintAddress);
  const safetyChecks = [
    { label: "Launched", passed: isBondingMode ? bondingToken?.status === "graduated" : true, loading: false },
    { label: "Mint revoked", passed: rugCheck?.mintAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Freeze revoked", passed: rugCheck?.freezeAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Liq locked", passed: rugCheck?.liquidityLocked ?? null, loading: rugLoading },
    { label: "Top 10 <30%", passed: rugCheck ? rugCheck.topHolderPct < 30 : null, loading: rugLoading },
  ];

  const tradingDisabled = isLoading || turboLoading;

  // Truncate ticker for display on small screens
  const shortTicker = tokenInfo.ticker.length > 8 ? tokenInfo.ticker.slice(0, 7) + '…' : tokenInfo.ticker;

  return (
    <>
      <div className="flex flex-col gap-3 overflow-hidden">
        {/* ── Segmented BUY / SELL ── */}
        <div className="flex h-11 rounded-xl bg-white/[0.02] border border-white/[0.06] p-1 relative">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-200 ${
              isBuy ? "left-1 bg-green-500/10 border border-green-500/20" : "left-[calc(50%+4px)] bg-destructive/10 border border-destructive/20"
            }`}
          />
          <button
            onClick={() => { setTradeType("buy"); setSelectedPreset(null); setQuote(null); }}
            className={`flex-1 relative z-10 text-[13px] font-mono font-bold uppercase tracking-wider transition-colors min-h-[44px] -my-1 ${
              isBuy ? "text-green-400" : "text-muted-foreground/35"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => { setTradeType("sell"); setSelectedPreset(null); setQuote(null); }}
            className={`flex-1 relative z-10 text-[13px] font-mono font-bold uppercase tracking-wider transition-colors min-h-[44px] -my-1 ${
              !isBuy ? "text-red-400" : "text-muted-foreground/35"
            }`}
          >
            Sell
          </button>
        </div>

        {/* ── Amount Input ── */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-0.5 min-w-0 gap-2">
            <span className="text-[12px] font-mono text-foreground/65 shrink-0">
              {isBuy ? "You pay" : "You sell"}
            </span>
            <button
              onClick={handleMaxClick}
              className="text-[12px] font-mono text-foreground/55 truncate hover:text-foreground/80 transition-colors"
              title="Click to use max"
            >
              Bal: {isBuy
                ? solBalance !== null ? `${solBalance.toFixed(3)} SOL` : "—"
                : `${formatAmount(userTokenBalance)} ${shortTicker}`}
            </button>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] focus-within:ring-1 focus-within:ring-green-500/15 focus-within:border-green-500/25 transition-all">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={displayInputValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/[KMBkmb]/g, '');
                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                  setAmount(raw);
                  setSelectedPreset(null);
                }
              }}
              className="w-full h-11 font-mono font-semibold pl-4 pr-[92px] bg-transparent text-foreground placeholder:text-foreground/25 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-ellipsis overflow-hidden"
              style={{ fontSize: 'clamp(15px, 4vw, 17px)' }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleMaxClick}
                className="h-7 px-2.5 rounded-lg font-mono text-[11px] font-bold bg-primary/8 text-primary/80 border border-primary/15 hover:bg-primary/12 transition-all active:scale-95 shrink-0"
              >
                MAX
              </button>
              {isBuy ? (
                <img src={SOL_LOGO} alt="SOL" className="w-4 h-4 rounded-full shrink-0" />
              ) : tokenInfo.imageUrl ? (
                <img src={tokenInfo.imageUrl} alt={tokenInfo.ticker} className="w-4 h-4 rounded-full shrink-0" />
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Quick Amount Chips ── */}
        <div className="grid grid-cols-4 gap-[6px]">
          {(isBuy ? quickBuyAmounts : quickSellPct).map((v, i) => (
            <button
              key={v}
              onClick={() => handleQuickAmount(v, i)}
              aria-label={isBuy ? `Select ${v} SOL` : `Select ${v}%`}
              className={`h-[34px] rounded-[10px] font-mono text-[clamp(11px,3vw,12px)] font-bold border transition-all duration-150 flex items-center justify-center gap-[5px] active:scale-[0.96] ${
                selectedPreset === i
                  ? isBuy
                    ? "border-[#00C4B4]/40 bg-[#00C4B4]/15 text-[#00C4B4] shadow-[0_0_6px_rgba(0,196,180,0.2)]"
                    : "border-destructive/40 bg-destructive/15 text-destructive shadow-[0_0_6px_rgba(255,77,77,0.15)]"
                  : "border-[#2A2A4A] bg-[#1A1A3A] text-[#A0A0B8] hover:border-[#3A3A5A] hover:text-foreground/75"
              }`}
            >
              {isBuy && <img src={SOL_LOGO} alt="" className="w-[14px] h-[14px] rounded-full shrink-0" />}
              <span>{isBuy ? v : `${v}%`}</span>
            </button>
          ))}
        </div>

        {/* ── Compact Preview ── */}
        {numericAmount > 0 && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 space-y-1.5">
            <div className="flex justify-between items-center min-w-0 gap-2">
              <span className="text-[12px] font-mono text-foreground/60 shrink-0">You get ≈</span>
              <span className="text-[14px] font-mono font-bold text-foreground truncate">
                {quoteLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                ) : (
                  `${formatAmount(outputAmount)} ${shortTicker}`
                )}
              </span>
            </div>
            {priceImpact > 0.01 && (
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-mono text-foreground/50">Impact</span>
                <span className={`text-[11px] font-mono font-bold ${priceImpact > 5 ? "text-destructive" : "text-foreground/65"}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Price Impact Warning ── */}
        {priceImpact > 5 && numericAmount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/8 rounded-xl text-destructive border border-destructive/15">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-[12px] font-mono font-bold truncate">High impact: {priceImpact.toFixed(2)}%</span>
          </div>
        )}

        {/* ── Indicators + Settings ── */}
        <div className="flex items-center justify-between px-1 min-w-0">
          <div className="flex items-center gap-2.5 text-[11px] font-mono text-foreground/50 shrink min-w-0">
            <span className="flex items-center gap-1 shrink-0">
              <span className="h-2 w-2 rounded-full bg-green-500/70" />MEV
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="h-2 w-2 rounded-full bg-primary/60" />Anti-SW
            </span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[11px] font-mono text-foreground/50">{slippage}% slp</span>
            <AdvancedSettingsSheet
              slippage={slippage}
              onSlippageChange={setSlippage}
              instaBuy={instaBuy}
              onInstaBuyChange={setInstaBuy}
              isBuy={isBuy}
              safetyChecks={safetyChecks}
              onGeneratePnl={() => {
                setProfitCardData({ action: isBuy ? "buy" : "sell", amountSol: numericAmount, tokenTicker: tokenInfo.ticker, tokenName: tokenInfo.name });
                setShowProfitCard(true);
              }}
            />
          </div>
        </div>

        {/* ── Action Button ── */}
        {!isAuthenticated ? (
          <button
            onClick={() => login()}
            className="w-full h-13 rounded-xl font-mono text-[14px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={tradingDisabled || !numericAmount || (!isBondingMode && useJupiterRoute && quoteLoading)}
            className={`w-full h-13 rounded-xl font-mono text-[14px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 ${
              isBuy
                ? "bg-green-500 hover:bg-green-400 text-black"
                : "bg-red-500 hover:bg-red-400 text-white"
            }`}
          >
            {tradingDisabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isBuy ? (
              <>
                BUY
                {numericAmount > 0 && <img src={SOL_LOGO} alt="" className="w-4 h-4 rounded-full" />}
                {numericAmount > 0 && <span className="truncate max-w-[80px]">{numericAmount}</span>}
              </>
            ) : (
              <span className="truncate">SELL {shortTicker}</span>
            )}
          </button>
        )}
      </div>

      <ProfitCardModal open={showProfitCard} onClose={() => setShowProfitCard(false)} data={profitCardData} />
    </>
  );
}
