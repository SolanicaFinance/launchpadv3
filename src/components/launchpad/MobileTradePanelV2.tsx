import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRealSwap } from "@/hooks/useRealSwap";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { usePumpFunSwap } from "@/hooks/usePumpFunSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useRugCheck } from "@/hooks/useRugCheck";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, AlertTriangle, ExternalLink, Settings2 } from "lucide-react";
import { AdvancedSettingsSheet } from "./AdvancedSettingsSheet";
import { ProfitCardModal, type ProfitCardData } from "./ProfitCardModal";
import { VersionedTransaction, Connection, PublicKey } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { recordAlphaTrade } from "@/lib/recordAlphaTrade";
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
  const { executeRealSwap, isLoading: bondingSwapLoading, getBalance } = useRealSwap();
  const { getBuyQuote, getSellQuote, buyToken, sellToken, isLoading: jupiterLoading } = useJupiterSwap();
  const { swap: pumpFunSwap } = usePumpFunSwap();
  const { signAndSendTransaction, isWalletReady, walletAddress: embeddedWallet, getTokenBalance: getTokenBalancePrivy } = useSolanaWalletWithPrivy();
  const { toast } = useToast();

  const signAndSendTx = useCallback(async (tx: VersionedTransaction): Promise<{ signature: string; confirmed: boolean }> => {
    return await signAndSendTransaction(tx);
  }, [signAndSendTransaction]);

  const isBondingMode = !!bondingToken;
  const tokenInfo = bondingToken
    ? { mint_address: bondingToken.mint_address, ticker: bondingToken.ticker, name: bondingToken.name, decimals: 6, price_sol: bondingToken.price_sol, imageUrl: bondingToken.image_url || undefined }
    : externalToken!;

  const mintAddress = tokenInfo.mint_address;
  const tokenDecimals = tokenInfo.decimals || 9;

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
      let signature = "";
      let resultOutputAmount: number | undefined;

      if (isBondingMode && bondingToken) {
        const result = await executeRealSwap(bondingToken, numericAmount, isBuy, slippage * 100);
        signature = result.signature;

        // Record bonding curve trade to alpha tracker (was previously skipped)
        if (signature) {
          await recordAlphaTrade({
            walletAddress: solanaAddress!,
            tokenMint: mintAddress,
            tokenName: tokenInfo.name,
            tokenTicker: tokenInfo.ticker,
            tradeType: isBuy ? 'buy' : 'sell',
            amountSol: numericAmount,
            txHash: signature,
            chain: 'solana',
          });
        }
      } else {
        if (useJupiterRoute) {
          const result = isBuy
            ? await buyToken(mintAddress, numericAmount, solanaAddress, signAndSendTx, slippage * 100)
            : await sellToken(mintAddress, numericAmount, tokenDecimals, solanaAddress, signAndSendTx, slippage * 100);
          signature = result.signature || "";
          resultOutputAmount = result.outputAmount;
        } else {
          const result = await pumpFunSwap(mintAddress, numericAmount, isBuy, slippage);
          signature = result.signature;
          resultOutputAmount = result.outputAmount;
        }

        if (signature) {
          // Client-side direct insert — awaited
          await recordAlphaTrade({
            walletAddress: solanaAddress!,
            tokenMint: mintAddress,
            tokenName: tokenInfo.name,
            tokenTicker: tokenInfo.ticker,
            tradeType: isBuy ? 'buy' : 'sell',
            amountSol: numericAmount,
            amountTokens: resultOutputAmount ?? undefined,
            txHash: signature,
            chain: 'solana',
          });

          // Edge function (secondary, non-blocking)
          supabase.functions.invoke("launchpad-swap", {
            body: { mintAddress, userWallet: solanaAddress, amount: numericAmount, isBuy, profileId: profileId || undefined, signature, outputAmount: resultOutputAmount ?? null, tokenName: tokenInfo.name, tokenTicker: tokenInfo.ticker, mode: "alpha_only" },
          }).catch(() => {});
        }
      }

      setAmount("");
      setQuote(null);
      setSelectedPreset(null);
      getBalance().then(setSolBalance).catch(() => {});
      void refreshTokenBalance();
      window.setTimeout(() => void refreshTokenBalance(), 1500);
      window.setTimeout(() => void refreshTokenBalance(), 5000);

      setProfitCardData({ action: isBuy ? "buy" : "sell", amountSol: numericAmount, tokenTicker: tokenInfo.ticker, tokenName: tokenInfo.name, outputAmount: resultOutputAmount, signature });
      setShowProfitCard(true);

      toast({
        title: `${isBuy ? "Buy" : "Sell"} successful!`,
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>{isBuy ? `Bought ${tokenInfo.ticker}` : `Sold ${tokenInfo.ticker}`}</span>
            {signature && (
              <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ),
      });
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

  const tradingDisabled = isLoading || bondingSwapLoading || jupiterLoading;

  // Truncate ticker for display on small screens
  const shortTicker = tokenInfo.ticker.length > 8 ? tokenInfo.ticker.slice(0, 7) + '…' : tokenInfo.ticker;

  return (
    <>
      {/* overflow-hidden prevents any child from causing horizontal scroll */}
      <div className="flex flex-col gap-2 overflow-hidden">
        {/* ── Segmented BUY / SELL — 36px tall, min-touch 44px via padding ── */}
        <div className="flex h-9 rounded-lg bg-secondary/30 border border-border/30 p-0.5 relative">
          <div
            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-200 ${
              isBuy ? "left-0.5 bg-green-500/15 border border-green-500/30" : "left-[calc(50%+2px)] bg-destructive/15 border border-destructive/30"
            }`}
          />
          <button
            onClick={() => { setTradeType("buy"); setSelectedPreset(null); setQuote(null); }}
            className={`flex-1 relative z-10 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-colors min-h-[44px] -my-1 ${
              isBuy ? "text-green-400" : "text-muted-foreground"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => { setTradeType("sell"); setSelectedPreset(null); setQuote(null); }}
            className={`flex-1 relative z-10 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-colors min-h-[44px] -my-1 ${
              !isBuy ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            Sell
          </button>
        </div>

        {/* ── Amount Input ── */}
        <div className="space-y-1 mb-1">
          <div className="flex justify-between items-center px-0.5 min-w-0 gap-2">
            <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground shrink-0">
              {isBuy ? "You pay" : "You sell"}
            </span>
            <button
              onClick={handleMaxClick}
              className="text-[10px] sm:text-[11px] font-mono text-muted-foreground truncate hover:text-foreground transition-colors"
              title="Click to use max"
            >
              Bal: {isBuy
                ? solBalance !== null ? `${solBalance.toFixed(3)} SOL` : "—"
                : `${formatAmount(userTokenBalance)} ${shortTicker}`}
            </button>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border/40 bg-secondary/30 focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/30 transition-all">
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
              className="w-full h-11 font-mono font-bold pl-3 pr-[88px] bg-transparent text-foreground placeholder:text-muted-foreground/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-ellipsis overflow-hidden"
              style={{ fontSize: 'clamp(14px, 4vw, 16px)' }}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 shrink-0">
              <button
                onClick={handleMaxClick}
                className="h-7 px-2 rounded-md font-mono text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 shrink-0"
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

        {/* ── Quick Amount Chips — grid 2x2 on tiny screens, flex row on wider ── */}
        <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
          {(isBuy ? quickBuyAmounts : quickSellPct).map((v, i) => (
            <button
              key={v}
              onClick={() => handleQuickAmount(v, i)}
              className={`h-9 min-h-[44px] rounded-md font-mono text-[10px] sm:text-[11px] font-semibold border transition-all active:scale-95 flex items-center justify-center gap-0.5 sm:gap-1 ${
                selectedPreset === i
                  ? isBuy
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border/30 text-muted-foreground bg-secondary/20 hover:bg-secondary/40"
              }`}
            >
              {isBuy && <img src={SOL_LOGO} alt="" className="w-3 h-3 rounded-full shrink-0 hidden xs:block" />}
              {isBuy ? v : `${v}%`}
            </button>
          ))}
        </div>

        {/* ── Compact Preview ── */}
        {numericAmount > 0 && (
          <div className="rounded-lg bg-secondary/30 border border-border/20 px-2.5 sm:px-3 py-2 space-y-1">
            <div className="flex justify-between items-center min-w-0 gap-2">
              <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground shrink-0">You get ≈</span>
              <span className="text-[12px] sm:text-sm font-mono font-bold text-foreground truncate">
                {quoteLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : (
                  `${formatAmount(outputAmount)} ${shortTicker}`
                )}
              </span>
            </div>
            {priceImpact > 0.01 && (
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-muted-foreground">Impact</span>
                <span className={`text-[10px] font-mono font-semibold ${priceImpact > 5 ? "text-destructive" : "text-muted-foreground"}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Price Impact Warning ── */}
        {priceImpact > 5 && numericAmount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-destructive/10 rounded-lg text-destructive border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold truncate">High impact: {priceImpact.toFixed(2)}%</span>
          </div>
        )}

        {/* ── Inline Indicators + Settings — compact row ── */}
        <div className="flex items-center justify-between px-0.5 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-mono text-muted-foreground/60 shrink min-w-0">
            <span className="flex items-center gap-0.5 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />MEV
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />Anti-SW
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/60">{slippage}% slp</span>
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

        {/* ── Action Button — 48px tall, full-width, always visible ── */}
        {!isAuthenticated ? (
          <button
            onClick={() => login()}
            className="w-full h-12 rounded-lg font-mono text-sm font-bold bg-green-500 hover:bg-green-600 text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={tradingDisabled || !numericAmount || (!isBondingMode && useJupiterRoute && quoteLoading)}
            className={`w-full h-12 rounded-lg font-mono text-[13px] sm:text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-1.5 ${
              isBuy
                ? "bg-green-500 hover:bg-green-600 text-black"
                : "bg-destructive hover:bg-destructive/90 text-white"
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
