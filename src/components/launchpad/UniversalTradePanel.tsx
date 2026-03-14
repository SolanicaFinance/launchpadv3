import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useJupiterSwap } from "@/hooks/useJupiterSwap";
import { usePumpFunSwap } from "@/hooks/usePumpFunSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Loader2, Wallet, AlertTriangle, ExternalLink, ChevronDown, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRugCheck } from "@/hooks/useRugCheck";
import { VersionedTransaction, Connection, PublicKey } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { ProfitCardModal, ProfitCardData } from "@/components/launchpad/ProfitCardModal";

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
  const { getBuyQuote, getSellQuote, buyToken, sellToken, isLoading: swapLoading } = useJupiterSwap();
  const { swap: pumpFunSwap } = usePumpFunSwap();
  const { signAndSendTransaction, isWalletReady, getBalance } = useSolanaWalletWithPrivy();

  const signAndSendTx = useCallback(async (tx: VersionedTransaction): Promise<{ signature: string; confirmed: boolean }> => {
    return await signAndSendTransaction(tx);
  }, [signAndSendTransaction]);

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

  // Fetch on-chain SPL token balance
  // Use embedded wallet address (actual signer) for balance reads
  const { walletAddress: embeddedWallet, getTokenBalance: getTokenBalancePrivy } = useSolanaWalletWithPrivy();
  const effectiveWallet = embeddedWallet || solanaAddress;

  const refreshTokenBalance = useCallback(async () => {
    if (!isAuthenticated || !effectiveWallet || !token.mint_address) {
      setOnChainTokenBalance(null);
      return;
    }
    try {
      const connection = new Connection(HELIUS_RPC);
      const owner = new PublicKey(effectiveWallet);
      const mint = new PublicKey(token.mint_address);
      const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
      // Sum ALL token accounts for this mint
      const bal = resp.value.reduce((sum, acc) => {
        const ta = acc.account?.data?.parsed?.info?.tokenAmount;
        const v = typeof ta?.uiAmount === 'number' ? ta.uiAmount : (ta?.uiAmountString ? parseFloat(ta.uiAmountString) : 0);
        return sum + (isFinite(v) ? v : 0);
      }, 0);
      setOnChainTokenBalance(bal);
    } catch {
      // Keep previous value on transient errors
    }
  }, [isAuthenticated, effectiveWallet, token.mint_address]);

  // Initial fetch + refresh on trade completion
  useEffect(() => {
    void refreshTokenBalance();
  }, [refreshTokenBalance, isLoading]);

  // Continuous polling every 3s + focus/visibility refresh
  useEffect(() => {
    if (!isAuthenticated || !effectiveWallet || !token.mint_address) return;

    const interval = window.setInterval(() => void refreshTokenBalance(), 3000);
    const onFocus = () => void refreshTokenBalance();
    const onVisibility = () => { if (document.visibilityState === 'visible') void refreshTokenBalance(); };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, effectiveWallet, token.mint_address, refreshTokenBalance]);

  // Fetch Jupiter quotes for graduated tokens
  useEffect(() => {
    if (!preferJupiterRoute) { setQuote(null); setQuoteLoading(false); setJupiterQuoteFailed(false); return; }
    const fetchQuote = async () => {
      if (numericAmount <= 0 || !token.mint_address) { setQuote(null); setJupiterQuoteFailed(false); return; }
      setQuoteLoading(true);
      try {
        const result = isBuy
          ? await getBuyQuote(token.mint_address, numericAmount, slippage * 100)
          : await getSellQuote(token.mint_address, numericAmount, tokenDecimals, slippage * 100);
        if (result) {
          setQuote({ outAmount: result.outAmount, priceImpactPct: result.priceImpactPct });
          setJupiterQuoteFailed(false);
        } else {
          setQuote(null);
          setJupiterQuoteFailed(true); // Fallback to PumpPortal
          console.log('[UniversalTradePanel] Jupiter quote failed, falling back to PumpPortal');
        }
      } catch {
        setQuote(null);
        setJupiterQuoteFailed(true);
      } finally { setQuoteLoading(false); }
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
    if (isBuy && solBalance !== null) {
      setAmount(Math.max(0, solBalance - 0.005).toFixed(4));
    } else if (!isBuy) {
      setAmount(userTokenBalance.toString());
    }
    setSelectedPreset(null);
  };

  const handleSlippagePreset = (val: number) => {
    setSlippage(val); setShowCustomSlippage(false); setCustomSlippage('');
  };

  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) setSlippage(num);
  };

  const handleTrade = async () => {
    if (!numericAmount || numericAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" }); return;
    }
    if (!isBuy && numericAmount > userTokenBalance) {
      toast({ title: "Insufficient token balance", variant: "destructive" }); return;
    }
    if (!solanaAddress) {
      toast({ title: "Please connect your wallet", variant: "destructive" }); return;
    }

    setIsLoading(true);
    const t0 = performance.now();
    try {
      let result: { signature?: string; outputAmount?: number };

      if (useJupiterRoute) {
        if (!signAndSendTx) { toast({ title: "Wallet not ready", variant: "destructive" }); return; }
        result = isBuy
          ? await buyToken(token.mint_address, numericAmount, solanaAddress, signAndSendTx, slippage * 100)
          : await sellToken(token.mint_address, numericAmount, tokenDecimals, solanaAddress, signAndSendTx, slippage * 100);
      } else {
        const pumpResult = await pumpFunSwap(token.mint_address, numericAmount, isBuy, slippage);
        result = { signature: pumpResult.signature, outputAmount: pumpResult.outputAmount };
      }

      const latency = Math.round(performance.now() - t0);
      setLastLatencyMs(latency);
      setShowLatency(true);
      setTimeout(() => setShowLatency(false), 5000);

      if (result.signature) {
        supabase.functions.invoke('launchpad-swap', {
          body: {
            mintAddress: token.mint_address,
            userWallet: solanaAddress,
            amount: numericAmount,
            isBuy,
            profileId: profileId || undefined,
            signature: result.signature,
            outputAmount: result.outputAmount ?? null,
            tokenName: token.name,
            tokenTicker: token.ticker,
            mode: 'alpha_only',
          },
        }).catch((err) => console.warn('[UniversalTradePanel] alpha record failed (non-fatal):', err));
      }

      setAmount(''); setQuote(null); setSelectedPreset(null);

      // Show profit card modal
      setProfitCardData({
        action: isBuy ? 'buy' : 'sell',
        amountSol: numericAmount,
        tokenTicker: token.ticker,
        tokenName: token.name,
        outputAmount: result.outputAmount,
        signature: result.signature,
      });
      setShowProfitCard(true);

      toast({
        title: `${isBuy ? 'Buy' : 'Sell'} successful!`,
        description: (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span>
              {result.outputAmount
                ? (isBuy ? `Bought ${formatAmount(result.outputAmount)} ${token.ticker}` : `Sold for ${formatAmount(result.outputAmount)} SOL`)
                : `${isBuy ? 'Buy' : 'Sell'} confirmed`}
            </span>
            {result.signature && (
              <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ),
      });
    } catch (error) {
      console.error('Trade error:', error);
      toast({ title: "Trade failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLoading = isLoading || swapLoading;

  const { data: rugCheck, isLoading: rugLoading } = useRugCheck(token.mint_address);

  const safetyChecks = [
    { label: "Launched", passed: token.graduated !== false, loading: false },
    { label: "Mint authority revoked", passed: rugCheck?.mintAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Freeze authority revoked", passed: rugCheck?.freezeAuthorityRevoked ?? null, loading: rugLoading },
    { label: "Liquidity locked", passed: rugCheck?.liquidityLocked ?? null, loading: rugLoading },
    { label: "Top 10 < 30%", passed: rugCheck ? rugCheck.topHolderPct < 30 : null, loading: rugLoading },
  ];

  return (
    <>
    <div className="border border-border/40 rounded-lg overflow-hidden bg-[hsl(var(--card))]">
      {/* Buy / Sell Toggle */}
      <div className="grid grid-cols-2">
        <button
          onClick={() => { setTradeType('buy'); setQuote(null); setSelectedPreset(null); }}
          className={`py-3 text-sm font-bold font-mono uppercase tracking-widest transition-all bg-transparent ${
            isBuy
              ? 'text-[#c8ff00] border-b-2 border-[#c8ff00]'
              : 'text-muted-foreground hover:text-foreground border-b border-border/40'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setTradeType('sell'); setQuote(null); setSelectedPreset(null); }}
          className={`py-3 text-sm font-bold font-mono uppercase tracking-widest transition-all bg-transparent ${
            !isBuy
              ? 'text-destructive border-b-2 border-destructive'
              : 'text-muted-foreground hover:text-foreground border-b border-border/40'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Slippage Tolerance - Axiom style, top position */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Slippage</span>
          <div className="flex items-center gap-1">
            {SLIPPAGE_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => handleSlippagePreset(v)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                  slippage === v && !showCustomSlippage
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground bg-background/40'
                }`}
              >
                {v}%
              </button>
            ))}
            <button
              onClick={() => setShowCustomSlippage(!showCustomSlippage)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                showCustomSlippage
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground bg-background/40'
              }`}
            >
              ⚙️
            </button>
            {showCustomSlippage && (
              <div className="relative w-16">
                <Input
                  type="number"
                  placeholder="0.5"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  className="h-5 text-[10px] font-mono pr-4 border-border/40 bg-background/40 rounded-full"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground font-mono">%</span>
              </div>
            )}
          </div>
        </div>

        {/* MEV Protection indicator */}
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Jito MEV Protection</span>
          <span className="text-muted-foreground/40">•</span>
          <span>Anti-sandwich</span>
        </div>

        {/* Insta Buy Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={instaBuy}
            onCheckedChange={setInstaBuy}
            className={`h-5 w-9 ${isBuy ? 'data-[state=checked]:bg-[#c8ff00]' : 'data-[state=checked]:bg-[#ff6666]'}`}
          />
          <span className={`text-xs font-mono font-bold tracking-wider ${isBuy ? 'text-[#c8ff00]' : 'text-[#ff6666]'}`}>
            {isBuy ? 'INSTA BUY' : 'INSTA SELL'}
          </span>
        </div>

        {/* Quick Amount Presets */}
        <div className="flex gap-1.5">
          {isBuy
            ? quickBuyAmounts.map((v, i) => (
                <button
                  key={v}
                  onClick={() => handleQuickAmount(v, i)}
                  className={`flex-1 text-[11px] font-mono font-bold py-2 rounded-md border transition-all ${
                    selectedPreset === i
                      ? 'border-[#4a5a2a] bg-[#3a4a1a] text-[#c8ff00]'
                      : 'border-[#3a4a1a] text-[#8a9a5a] hover:border-[#4a5a2a] hover:bg-[#2a3a0a]/50 bg-transparent'
                  }`}
                >
                  <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="" className="w-3.5 h-3.5 rounded-full inline-block mr-0.5 -mt-px" /> {v}
                </button>
              ))
            : quickSellPct.map((v, i) => (
                <button
                  key={v}
                  onClick={() => handleQuickAmount(v, i)}
                  className={`flex-1 text-[11px] font-mono font-bold py-2 rounded-md border transition-all ${
                    selectedPreset === i
                      ? 'border-[#5a2a2a] bg-[#4a1a1a] text-[#ff6666]'
                      : 'border-[#3a1a1a] text-[#8a5a5a] hover:border-[#5a2a2a] hover:bg-[#2a0a0a]/50 bg-transparent'
                  }`}
                >
                  {v}%
                </button>
              ))}
        </div>

        {/* Input */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isBuy ? 'Amount to buy' : `Amount of ${token.ticker} to sell`}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Bal: {isBuy
                ? (solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—')
                : `${formatAmount(userTokenBalance)} ${token.ticker}`}
            </span>
          </div>
          <div className="relative bg-background/60 border border-border/50 rounded-lg hover:border-border/80 focus-within:border-primary/50 transition-colors">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSelectedPreset(null); }}
              className="border-0 bg-transparent text-xl font-mono h-14 pr-24 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/30"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <button
                onClick={handleMaxClick}
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#2a2a1a] text-[#c8b400] hover:bg-[#3a3a2a] transition-colors border border-[#4a4a2a]"
              >
                MAX
              </button>
              <span className="text-xs font-mono font-bold text-muted-foreground flex items-center gap-1">
                {isBuy
                  ? <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="SOL" className="w-4 h-4 rounded-full" />
                  : token.imageUrl && <img src={token.imageUrl} alt={token.ticker} className="w-4 h-4 rounded-full" />}
                {isBuy ? 'SOL' : token.ticker}
              </span>
            </div>
          </div>
        </div>

        {/* Price Display */}
        <div className="py-1">
          <span className="text-xs font-mono text-muted-foreground">
            1 {token.name} = {token.price_sol ? token.price_sol.toFixed(6) : '—'} SOL
          </span>
        </div>

        {/* Price Impact Warning */}
        {priceImpact > 5 && (
          <div className="flex items-center gap-2 p-2.5 bg-destructive/10 rounded-lg text-destructive text-xs font-mono border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>High price impact: {priceImpact.toFixed(2)}%</span>
          </div>
        )}

        {/* Action Button */}
        {!isAuthenticated ? (
          <Button className="w-full h-12 font-mono text-sm uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white" onClick={() => login()}>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        ) : (
          <div className="space-y-1.5">
            <button
              onClick={handleTrade}
              disabled={buttonLoading || !numericAmount || (useJupiterRoute && !jupiterQuoteFailed && quoteLoading) || !isWalletReady}
              className={`w-full h-12 rounded-lg font-mono text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isBuy
                  ? 'bg-green-500 hover:bg-green-600 text-black'
                  : 'bg-destructive hover:bg-destructive/90 text-white'
              }`}
            >
              {buttonLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : useJupiterRoute && !jupiterQuoteFailed && quoteLoading ? (
                'Getting quote...'
              ) : isBuy ? (
                <span className="flex items-center gap-1">QUICK BUY <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="" className="w-4 h-4 rounded-full" /> {numericAmount || ''}</span>
              ) : (
                <span className="flex items-center gap-1">SELL {token.imageUrl && <img src={token.imageUrl} alt={token.ticker} className="w-4 h-4 rounded-full" />} {token.ticker}</span>
              )}
            </button>
            {showLatency && lastLatencyMs !== null && (
              <p className="text-[10px] font-mono text-primary/60 text-center animate-in fade-in duration-300">
                ⚡ {lastLatencyMs}ms
              </p>
            )}
            {isBuy && !showLatency && (
              <p className="text-[9px] font-mono text-muted-foreground/50 text-center">
                Once you click on Quick Buy, your transaction is sent immediately
              </p>
            )}
          </div>
        )}

        {/* Share P&L */}
        <div className="flex items-center justify-between py-2 border-t border-border/30">
          <span className="text-[10px] font-mono text-muted-foreground">Share your P&L</span>
          <button
            onClick={() => {
              setProfitCardData({
                action: isBuy ? 'buy' : 'sell',
                amountSol: numericAmount || 0,
                tokenTicker: token.ticker,
                tokenName: token.name,
              });
              setShowProfitCard(true);
            }}
            className="text-[10px] font-mono font-bold text-[#c8ff00] hover:text-[#d9ff33] flex items-center gap-1.5 transition-colors bg-[#c8ff00]/10 px-2.5 py-1 rounded-md hover:bg-[#c8ff00]/15"
          >
            🪐 Generate PNL Card
          </button>
        </div>

        {/* Advanced Settings */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center justify-center w-full text-xs font-mono font-bold uppercase tracking-widest text-[#c8ff00] hover:text-[#d9ff33] transition-colors py-2">
            <span>Advanced Settings</span>
            <ChevronDown className={`h-3.5 w-3.5 ml-1.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Safety Checks - horizontal grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {safetyChecks.map((check) => (
                <div key={check.label} className="flex flex-col items-center gap-1 py-2">
                  {check.loading ? (
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  ) : check.passed === true ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : check.passed === false ? (
                    <XCircle className="h-6 w-6 text-destructive" />
                  ) : (
                    <HelpCircle className="h-6 w-6 text-muted-foreground/50" />
                  )}
                  <span className="text-[8px] font-mono text-muted-foreground text-center leading-tight">{check.label}</span>
                </div>
              ))}
            </div>

            {/* Slippage — already shown at top */}

            {/* Trade Info */}
            {numericAmount > 0 && (
              <div className="space-y-1.5 text-[10px] font-mono border-t border-border/30 pt-2.5">
                {outputAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>You Receive</span>
                    <span className="text-foreground/70">
                      {formatAmount(outputAmount)} {isBuy ? token.ticker : 'SOL'}
                    </span>
                  </div>
                )}
                {quote && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Price Impact</span>
                    <span className={priceImpact > 5 ? 'text-destructive' : 'text-foreground/70'}>{priceImpact.toFixed(2)}%</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Slippage</span>
                  <span className="text-foreground/70">{slippage}%</span>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

      </div>
    </div>
      <ProfitCardModal
        open={showProfitCard}
        onClose={() => setShowProfitCard(false)}
        data={profitCardData}
      />
    </>
  );
}
