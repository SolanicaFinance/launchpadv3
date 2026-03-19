import { useState, useMemo, useCallback } from "react";
import { formatChange24h } from "@/lib/formatters";
import pancakeswapBunny from "@/assets/pancakeswap-bunny.png";
import { useParams, Link } from "react-router-dom";
import { useFunToken } from "@/hooks/useFunToken";
import { useExternalToken } from "@/hooks/useExternalToken";
import { usePoolState } from "@/hooks/usePoolState";
import { useAuth } from "@/hooks/useAuth";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useBnbPrice } from "@/hooks/useBnbPrice";
import { SOLANA_NETWORK_ID, BSC_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { TradePanelWithSwap } from "@/components/launchpad/TradePanelWithSwap";
import { UniversalTradePanel } from "@/components/launchpad/UniversalTradePanel";
import { MobileTradePanelV2 } from "@/components/launchpad/MobileTradePanelV2";
import { BnbTradePanel } from "@/components/launchpad/BnbTradePanel";
import { EmbeddedWalletCard } from "@/components/launchpad/EmbeddedWalletCard";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { TokenComments } from "@/components/launchpad/TokenComments";
import { CodexChart } from "@/components/launchpad/CodexChart";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  ExternalLink, Copy, Share2, Globe, Twitter, MessageCircle,
  RefreshCw, ArrowLeft, Users, Briefcase, Zap, TrendingUp,
  TrendingDown, Shield, Lock, Activity, BarChart3, ChevronDown,
  ChevronUp,
} from "lucide-react";
import { LeverageTradingBanner } from "@/components/launchpad/LeverageTradingBanner";
import { useToast } from "@/hooks/use-toast";
import { useTwitterProfile } from "@/hooks/useTwitterProfile";
import { BagsBadge } from "@/components/forum/BagsBadge";
import { PumpBadge } from "@/components/forum/PumpBadge";
import { PhantomBadge } from "@/components/forum/PhantomBadge";
import { TokenDataTabs } from "@/components/launchpad/TokenDataTabs";
import { BRAND } from "@/config/branding";

function isEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(addr);
}

function getExplorerUrl(addr: string, isBsc: boolean): string {
  return isBsc ? `https://bscscan.com/token/${addr}` : `https://solscan.io/token/${addr}`;
}

function getTradeUrl(addr: string, isBsc: boolean): string {
  return isBsc
    ? `https://pancakeswap.finance/swap?outputCurrency=${addr}&chain=bsc`
    : `https://solscan.io/token/${addr}`;
}

function getRiskLevel(volume: number, liquidity: number, holders: number): { label: string; className: string } {
  const ratio = liquidity > 0 ? volume / liquidity : 0;
  if (holders >= 100 && liquidity >= 10000 && ratio < 5) return { label: 'Lower Risk', className: 'trade-risk-low' };
  if (holders >= 20 && liquidity >= 1000) return { label: 'Medium Risk', className: 'trade-risk-medium' };
  return { label: 'Higher Risk', className: 'trade-risk-high' };
}

const TOTAL_SUPPLY = 1_000_000_000;
const GRADUATION_THRESHOLD = 85;

function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

function formatSolAmount(amount: number): string {
  if (!amount || amount === 0) return "0.00";
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  return amount.toFixed(4);
}

/* ── Compact USD formatter ── */
function formatUsdCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v > 0) return `$${v.toFixed(6)}`;
  return '$0';
}

/* ────────────────────────────────────────────────────────
   EXTERNAL TOKEN VIEW (tokens not in our DB)
   ──────────────────────────────────────────────────────── */
function ExternalTokenView({ token, mintAddress, solPrice, isBsc = false }: { token: import("@/hooks/useExternalToken").ExternalToken; mintAddress: string; solPrice: number; isBsc?: boolean }) {
  const networkId = isBsc ? BSC_NETWORK_ID : SOLANA_NETWORK_ID;
  const privyAvailable = usePrivyAvailable();
  const { solanaAddress } = useAuth();
  const { allAddresses } = useMultiWallet();
  const allWalletAddresses = allAddresses;
  const { toast } = useToast();
  const [mobileTab, setMobileTab] = useState<'trade' | 'chart'>('trade');

  const copyAddress = () => { navigator.clipboard.writeText(mintAddress); toast({ title: "Address copied!" }); };
  const shareToken = () => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!" }); };

  const isPriceUp = token.change24h >= 0;

  const stats = [
    { label: 'MCAP', value: formatUsdCompact(token.marketCapUsd), accent: true },
    { label: 'VOL 24H', value: formatUsdCompact(token.volume24hUsd) },
    { label: 'HOLDERS', value: token.holders.toLocaleString() },
    { label: 'PRICE', value: formatUsdCompact(token.priceUsd) },
    { label: 'LIQ', value: formatUsdCompact(token.liquidity) },
  ];

  return (
    <LaunchpadLayout>
      <div className="trade-page-bg -mx-4 -mt-4 px-4 pt-4 md:mx-0 md:mt-0 md:pl-6 md:pr-4 md:pt-4 md:rounded-xl lg:px-6 lg:pt-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4 pb-32 md:pb-24">

          {/* ── TOP BAR ── */}
          <div className="trade-topbar">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Link to="/trade" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] rounded-lg">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>

              <Avatar className="h-10 w-10 rounded-xl trade-avatar-glow shrink-0">
                <AvatarImage src={token.imageUrl || undefined} className="object-cover" />
                <AvatarFallback className="rounded-xl text-xs font-bold bg-primary/8 text-primary font-mono">
                  {(token.symbol || '??').slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center gap-2.5 min-w-0 shrink">
                <h1 className="text-[15px] font-bold font-mono tracking-tight truncate max-w-[120px] sm:max-w-[180px] md:max-w-[240px] lg:max-w-none text-foreground">{token.name}</h1>
                <span className="text-[13px] font-mono text-muted-foreground/50 shrink-0">${token.symbol}</span>
                {token.migrated && (
                  <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-md bg-green-500/10 text-green-400/90 border border-green-500/15 shrink-0">GRAD</span>
                )}
                {!token.completed && !token.migrated && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/8 text-primary/90 border border-primary/15 flex items-center gap-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />LIVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 ml-auto sm:ml-4 shrink-0">
                <span className="text-[15px] font-mono font-bold text-foreground">{formatUsdCompact(token.priceUsd)}</span>
                {token.change24h !== 0 && (
                  <span className={`trade-price-pill ${isPriceUp ? 'trade-price-pill-up' : 'trade-price-pill-down'}`}>
                    {isPriceUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {formatChange24h(token.change24h)}
                  </span>
                )}
              </div>

              {/* Desktop stats inline */}
              <div className="hidden lg:flex items-center gap-6 ml-6 min-w-0">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">{s.label}</span>
                    <span className={`text-[13px] font-mono font-semibold ${s.accent ? 'text-yellow-400' : 'text-foreground/80'}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={copyAddress}><Copy className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg" onClick={shareToken}><Share2 className="h-3.5 w-3.5" /></Button>
                <div className="hidden md:flex items-center gap-1">
                  {token.websiteUrl && <a href={token.websiteUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><Globe className="h-3.5 w-3.5" /></Button></a>}
                  {token.twitterUrl && <a href={token.twitterUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><Twitter className="h-3.5 w-3.5" /></Button></a>}
                  <a href={getExplorerUrl(mintAddress, isBsc)} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><ExternalLink className="h-3.5 w-3.5" /></Button></a>
                </div>
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
            </div>
          </div>

          {/* Phone stats */}
          <div className="md:hidden grid grid-cols-3 gap-2.5">
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="trade-stat-card">
                <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">{s.label}</p>
                <p className={`text-sm font-mono font-bold mt-1 ${s.accent ? 'text-yellow-400' : 'text-foreground/90'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Leverage Trading Banner - full width */}
          <LeverageTradingBanner />


          {token.graduationPercent !== null && !token.completed && !token.migrated && (
            <div className="trade-glass-panel flex items-center gap-4 px-5 py-3">
              <Zap className="h-4 w-4 text-primary/70 shrink-0" />
              <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider shrink-0">Bonding</span>
              <div className="flex-1 min-w-[80px]">
                <div className="trade-bonding-bar">
                  <div className="trade-bonding-fill" style={{ width: `${Math.max(Math.min(token.graduationPercent, 100), 1)}%` }} />
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-primary shrink-0">{token.graduationPercent.toFixed(1)}%</span>
            </div>
          )}

          {/* Phone tab switcher */}
          <div className="md:hidden">
            <div className="flex bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
              {(['trade', 'chart'] as const).map(tab => (
                <button key={tab} onClick={() => setMobileTab(tab)}
                  className={`flex-1 py-2.5 text-[12px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 rounded-lg ${
                    mobileTab === tab
                      ? 'bg-white/[0.06] text-foreground font-bold'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                  }`}>
                  {tab === 'trade' && <Activity className="h-3.5 w-3.5" />}
                  {tab === 'chart' && <BarChart3 className="h-3.5 w-3.5" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Phone layout */}
          <div className="md:hidden flex flex-col gap-3">
            {mobileTab === 'trade' && (
              <>
                {privyAvailable && (
                  isBsc
                    ? <BnbTradePanel tokenAddress={mintAddress} ticker={token.symbol} name={token.name} imageUrl={token.imageUrl} />
                    : <MobileTradePanelV2
                        externalToken={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }}
                        userTokenBalance={0}
                      />
                )}
                <EmbeddedWalletCard />
              </>
            )}
            {mobileTab === 'chart' && (
              <>
                <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
                  <CodexChart tokenAddress={mintAddress} networkId={networkId} height={360} />
                </div>
                <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} isBsc={isBsc} />
              </>
            )}
          </div>

          {/* Tablet layout */}
          <div className="hidden md:grid lg:hidden grid-cols-12 gap-4">
            <div className="col-span-7 flex flex-col gap-4">
              <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
                <CodexChart tokenAddress={mintAddress} networkId={networkId} height={440} />
              </div>
              <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} isBsc={isBsc} />
              <div className="trade-glass-panel p-4 space-y-2">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40">Contract</h3>
                <div className="flex items-center gap-2">
                  <code className="text-[12px] font-mono text-foreground/60 truncate flex-1">{mintAddress.slice(0, 10)}...{mintAddress.slice(-4)}</code>
                  <button onClick={copyAddress} className="text-muted-foreground/40 hover:text-foreground transition-colors p-1"><Copy className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
            <div className="col-span-5 flex flex-col gap-4">
              <div className="sticky top-4 flex flex-col gap-4">
                {privyAvailable && (
                  isBsc
                    ? <BnbTradePanel tokenAddress={mintAddress} ticker={token.symbol} name={token.name} imageUrl={token.imageUrl} />
                    : <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
                )}
                <LeverageTradingBanner />
                <EmbeddedWalletCard />
              </div>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:grid grid-cols-12 gap-4 flex-1">
            <div className="col-span-9 flex flex-col gap-4">
              <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
                <CodexChart tokenAddress={mintAddress} networkId={networkId} height={420} />
              </div>
              <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} isBsc={isBsc} />
            </div>
            <div className="col-span-3 flex flex-col gap-4">
              {privyAvailable && (
                isBsc
                  ? <BnbTradePanel tokenAddress={mintAddress} ticker={token.symbol} name={token.name} imageUrl={token.imageUrl} />
                  : <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
              )}
              <LeverageTradingBanner />
              <EmbeddedWalletCard />
            </div>
          </div>
        </div>

        {/* Phone bottom bar */}
        <div className="md:hidden fixed left-0 right-0 z-50 trade-mobile-bar" style={{ bottom: '40px', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[12px] font-mono text-muted-foreground/60">{formatUsdCompact(token.priceUsd)}</span>
              {token.change24h !== 0 && (
                <span className={`text-[12px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                  {formatChange24h(token.change24h)}
                </span>
              )}
            </div>
            <button onClick={() => setMobileTab('trade')} className="trade-btn-buy font-mono text-sm font-bold px-7 py-2.5 rounded-lg min-h-[42px] active:scale-95">BUY</button>
            <button onClick={() => setMobileTab('trade')} className="trade-btn-sell font-mono text-sm font-bold px-7 py-2.5 rounded-lg min-h-[42px] active:scale-95">SELL</button>
          </div>
        </div>
      </div>
    </LaunchpadLayout>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN TOKEN DETAIL PAGE
   ════════════════════════════════════════════════════════════════ */
export default function FunTokenDetailPage() {
  const { mintAddress } = useParams<{ mintAddress: string }>();
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const { allAddresses } = useMultiWallet();
  const allWalletAddresses = allAddresses;
  const { solPrice } = useSolPrice();
  const { bnbPrice } = useBnbPrice();
  const { toast } = useToast();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [mobileTab, setMobileTab] = useState<'trade' | 'chart' | 'info'>('chart');

  const isBsc = isEvmAddress(mintAddress || '');
  const networkId = isBsc ? BSC_NETWORK_ID : SOLANA_NETWORK_ID;
  const activePrice = isBsc ? bnbPrice : solPrice;

  const { data: token, isLoading, refetch } = useFunToken(mintAddress || '');
  const { data: externalToken, isLoading: externalLoading } = useExternalToken(mintAddress || '', !isLoading && !token, networkId);
  const { data: codexEnrichment } = useExternalToken(mintAddress || '', !!token && !!mintAddress, networkId);

  const { data: livePoolState, refetch: refetchPoolState } = usePoolState({
    mintAddress: token?.mint_address || '',
    enabled: !!token?.mint_address && token?.status === 'active',
    refetchInterval: 60000,
  });

  const formatUsd = (marketCapSol: number) => {
    const usdValue = Number(marketCapSol || 0) * Number(solPrice || 0);
    if (Number.isFinite(usdValue) && usdValue > 0) {
      if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
      if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
      if (usdValue >= 1) return `$${usdValue.toFixed(2)}`;
      return `$${usdValue.toFixed(4)}`;
    }
    const sol = Number(marketCapSol || 0);
    if (sol <= 0) return "$0";
    if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(2)}M SOL`;
    if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K SOL`;
    if (sol >= 1) return `${sol.toFixed(2)} SOL`;
    return `${sol.toFixed(6)} SOL`;
  };
  const formatCompact = (value: number) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "0";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(2).replace(/\.00$/, "");
  };
  const copyAddress = () => {
    const address = token?.mint_address || mintAddress;
    if (address) { navigator.clipboard.writeText(address); toast({ title: "Address copied!" }); }
  };
  const shareToken = () => {
    if (navigator.share && token) {
      navigator.share({ title: `${token.name} ($${token.ticker})`, text: `Check out ${token.name} on ${BRAND.name}!`, url: window.location.href });
    } else { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied!" }); }
  };
  const handleRefresh = () => { refetch(); refetchPoolState(); toast({ title: "Refreshed" }); };

  const bondingProgress = livePoolState?.bondingProgress ?? token?.bonding_progress ?? 0;
  const realSolReserves = (bondingProgress / 100) * GRADUATION_THRESHOLD;
  const isGraduated = token?.status === 'graduated';
  const isBonding = token?.status === 'active';
  const isPunchToken = (token as any)?.launchpad_type === 'punch';
  const priceChange = (token as any)?.price_change_24h || 0;
  const isPriceUp = priceChange >= 0;

  const { data: twitterProfile } = useTwitterProfile(token?.launch_author);

  // Loading
  if (isLoading || (!token && externalLoading)) {
    return (
      <LaunchpadLayout>
        <div className="trade-page-bg p-3">
          <div className="max-w-[1600px] mx-auto space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 lg:col-span-9"><Skeleton className="h-[70vh] w-full rounded-xl" /></div>
              <div className="hidden md:block md:col-span-5 lg:col-span-3"><Skeleton className="h-[70vh] w-full rounded-xl" /></div>
            </div>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  if (!token && externalToken) {
    return <ExternalTokenView token={externalToken} mintAddress={mintAddress || ''} solPrice={activePrice} isBsc={isBsc} />;
  }

  if (!token) {
    return (
      <LaunchpadLayout>
        <div className="trade-page-bg flex flex-col items-center justify-center py-20">
          <h2 className="text-lg font-bold font-mono">Token not found</h2>
          <p className="text-muted-foreground mt-2 font-mono text-sm">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-4">
            <Button className="px-5 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl">Back to Terminal</Button>
          </Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const tokenForTradePanel = {
    id: token.id, mint_address: token.mint_address || '', name: token.name, ticker: token.ticker,
    description: token.description, image_url: token.image_url, website_url: token.website_url || null,
    twitter_url: token.twitter_url || null, telegram_url: token.telegram_url || null, discord_url: token.discord_url || null,
    creator_wallet: token.creator_wallet, creator_id: null, dbc_pool_address: token.dbc_pool_address,
    damm_pool_address: null, virtual_sol_reserves: 30, virtual_token_reserves: TOTAL_SUPPLY,
    real_sol_reserves: realSolReserves, real_token_reserves: 0, total_supply: TOTAL_SUPPLY,
    bonding_curve_progress: bondingProgress, graduation_threshold_sol: GRADUATION_THRESHOLD,
    price_sol: token.price_sol || 0, market_cap_sol: token.market_cap_sol || 0, volume_24h_sol: token.volume_24h_sol || 0,
    status: isBonding ? 'bonding' : (isGraduated ? 'graduated' : 'failed') as 'bonding' | 'graduated' | 'failed',
    migration_status: 'pending', holder_count: token.holder_count || 0,
    created_at: token.created_at, updated_at: token.updated_at, graduated_at: null, profiles: null,
  };

  const codexPrice = codexEnrichment?.priceUsd;
  const codexHolders = codexEnrichment?.holders;
  const codexMcap = codexEnrichment?.marketCapUsd;

  const formatPriceUsd = (v: number) => {
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    if (v > 0) return `$${v.toFixed(8)}`;
    return '$0';
  };

  const stats = [
    { label: 'MCAP', value: codexMcap && codexMcap > 0 ? `$${codexMcap >= 1000 ? `${(codexMcap / 1000).toFixed(1)}K` : codexMcap.toFixed(0)}` : formatCompact(token.market_cap_sol || 0), accent: true },
    { label: 'VOL 24H', value: codexEnrichment?.volume24hUsd && codexEnrichment.volume24hUsd > 0 ? `$${codexEnrichment.volume24hUsd >= 1000 ? `${(codexEnrichment.volume24hUsd / 1000).toFixed(1)}K` : codexEnrichment.volume24hUsd.toFixed(0)}` : `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
    { label: 'HOLDERS', value: (codexHolders ?? token.holder_count ?? 0).toLocaleString() },
    { label: 'PRICE', value: codexPrice && codexPrice > 0 ? formatPriceUsd(codexPrice) : `${(token.price_sol || 0).toFixed(8)} SOL` },
    { label: 'SUPPLY', value: formatTokenAmount(TOTAL_SUPPLY) },
  ];

  /* ── Reusable sections ── */
  const TradeSection = () => (
    <>
      {!privyAvailable && (
        <div className="trade-glass-panel p-6 text-center">
          <p className="text-muted-foreground text-sm font-mono">Wallet backend unavailable. Reload in a moment.</p>
        </div>
      )}
      {privyAvailable && isBsc && token.mint_address && (
        <BnbTradePanel tokenAddress={token.mint_address} ticker={token.ticker} name={token.name} imageUrl={token.image_url || undefined} />
      )}
      {privyAvailable && !isBsc && isBonding && <TradePanelWithSwap token={tokenForTradePanel} userBalance={0} />}
      {privyAvailable && !isBsc && isGraduated && token.mint_address && (
        <UniversalTradePanel
          token={{ mint_address: token.mint_address, ticker: token.ticker, name: token.name, decimals: 9, price_sol: token.price_sol || 0, imageUrl: token.image_url || undefined }}
          userTokenBalance={0}
        />
      )}
      {privyAvailable && !isBsc && !isBonding && !isGraduated && (
        <div className="trade-glass-panel p-6 text-center">
          <p className="text-muted-foreground text-sm font-mono">Trading not available · Status: {token.status}</p>
        </div>
      )}
    </>
  );

  const ChartSection = ({ chartHeight = 460 }: { chartHeight?: number }) => (
    <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
      <CodexChart tokenAddress={token.mint_address || mintAddress || ''} networkId={networkId} height={chartHeight} />
    </div>
  );

  const TokenDetailsSection = () => {
    const vol = codexEnrichment?.volume24hUsd || (token.volume_24h_sol || 0) * solPrice;
    const liq = codexEnrichment?.liquidity || 0;
    const holders = codexHolders ?? token.holder_count ?? 0;
    const risk = getRiskLevel(vol, liq, holders);
    return (
      <div className="trade-glass-panel p-5 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary/50" /> Token Details
          </h3>
          <span className={`trade-risk-badge ${risk.className}`}>
            <Shield className="h-3 w-3" />{risk.label}
          </span>
        </div>
        {[
          { label: 'Price', value: codexPrice && codexPrice > 0 ? formatPriceUsd(codexPrice) : `${(token.price_sol || 0).toFixed(8)} SOL` },
          { label: 'Market Cap', value: codexMcap && codexMcap > 0 ? `$${codexMcap >= 1000 ? `${(codexMcap / 1000).toFixed(1)}K` : codexMcap.toFixed(0)}` : formatUsd(token.market_cap_sol || 0) },
          { label: 'Volume 24h', value: codexEnrichment?.volume24hUsd && codexEnrichment.volume24hUsd > 0 ? `$${codexEnrichment.volume24hUsd.toFixed(0)}` : `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
          { label: 'Holders', value: holders.toLocaleString() },
          { label: 'Supply', value: formatTokenAmount(TOTAL_SUPPLY) },
          { label: 'Age', value: formatDistanceToNow(new Date(token.created_at), { addSuffix: false }) },
        ].map((row, i) => (
          <div key={i} className="trade-detail-row">
            <span className="text-[12px] font-mono text-muted-foreground/50">{row.label}</span>
            <span className="text-[12px] font-mono text-foreground/80 font-semibold">{row.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const ContractSection = () => {
    if (!token.mint_address) return null;
    return (
      <div className="trade-glass-panel p-5 space-y-2">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40">Contract</h3>
        <div className="flex items-center gap-2">
          <code className="text-[12px] font-mono text-foreground/60 truncate flex-1">{token.mint_address.slice(0, 10)}...{token.mint_address.slice(-4)}</code>
          <button onClick={copyAddress} className="text-muted-foreground/40 hover:text-foreground transition-colors shrink-0 p-2 min-h-[44px] flex items-center justify-center">
            <Copy className="h-4 w-4" />
          </button>
        </div>
        {token.dbc_pool_address && (
          <div>
            <span className="text-[9px] font-mono text-muted-foreground/30 uppercase">Pool</span>
            <code className="text-[12px] font-mono text-foreground/50 truncate block">{token.dbc_pool_address.slice(0, 10)}...{token.dbc_pool_address.slice(-4)}</code>
          </div>
        )}
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

  const CommentsSection = () => (
    <div className="trade-glass-panel p-5 flex-1 min-h-0 overflow-hidden flex flex-col">
      <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground/50 flex items-center gap-2 mb-3">
        <MessageCircle className="h-3.5 w-3.5 text-primary/50" /> Discussion
      </h3>
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        <TokenComments tokenId={token.id} />
      </div>
    </div>
  );

  return (
    <LaunchpadLayout>
      <div className="trade-page-bg -mx-4 -mt-4 px-4 pt-4 md:mx-0 md:mt-0 md:pl-6 md:pr-4 md:pt-4 md:rounded-xl lg:px-6 lg:pt-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4 pb-32 md:pb-24">

          {/* ──── TOP BAR ──── */}
          <div className="trade-topbar">
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Link to="/" className="shrink-0">
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
                {isGraduated && (
                  <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded-md bg-green-500/10 text-green-400/90 border border-green-500/18 shrink-0">GRADUATED</span>
                )}
                {isBonding && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/8 text-primary/90 border border-primary/15 flex items-center gap-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />LIVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 ml-auto sm:ml-4 shrink-0">
                <span className="text-[15px] sm:text-base font-mono font-bold text-foreground">
                  {(token.price_sol || 0).toFixed(8)}
                </span>
                <span className="hidden sm:inline text-[12px] font-mono text-muted-foreground/40">SOL</span>
                {priceChange !== 0 && (
                  <span className={`trade-price-pill ${isPriceUp ? 'trade-price-pill-up' : 'trade-price-pill-down'}`}>
                    {isPriceUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {formatChange24h(priceChange)}
                  </span>
                )}
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
                <div className="hidden md:flex items-center gap-1">
                  {token.website_url && <a href={token.website_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><Globe className="h-3.5 w-3.5" /></Button></a>}
                  {token.twitter_url && <a href={token.twitter_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><Twitter className="h-3.5 w-3.5" /></Button></a>}
                  {token.telegram_url && <a href={token.telegram_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><MessageCircle className="h-3.5 w-3.5" /></Button></a>}
                  {token.mint_address && <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] rounded-lg"><ExternalLink className="h-3.5 w-3.5" /></Button></a>}
                </div>
                {(token as any).launchpad_type === 'bags' && token.mint_address && (
                  <a href={`https://bags.fm/coin/${token.mint_address}`} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex">
                    <Button size="sm" className="h-7 px-2 text-[10px] font-mono gap-1 bg-blue-500/8 hover:bg-blue-500/15 text-blue-400/90 border border-blue-500/18 rounded-lg">
                      <Briefcase className="h-3 w-3" />bags
                    </Button>
                  </a>
                )}
                <div className="hidden lg:flex items-center gap-1">
                  {(token as any).launchpad_type === 'bags' && <BagsBadge mintAddress={token.mint_address || undefined} size="sm" />}
                  {(token as any).launchpad_type === 'pumpfun' && <PumpBadge mintAddress={token.mint_address || undefined} size="sm" />}
                  {(token as any).launchpad_type === 'phantom' && <PhantomBadge mintAddress={token.mint_address || undefined} size="sm" />}
                </div>
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
              {token.launch_author && (
                <a href={`https://x.com/${token.launch_author}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors shrink-0">
                  {twitterProfile?.profileImageUrl && <img src={twitterProfile.profileImageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}
                  @{token.launch_author}
                </a>
              )}
              <span className="text-[9px] font-mono px-2.5 py-1 rounded-full bg-primary/6 text-primary/70 border border-primary/12 flex items-center gap-1 shrink-0">
                <Shield className="h-3 w-3" /> NON-CUSTODIAL
              </span>
            </div>
          </div>

          {/* ── PHONE STATS ── */}
          <div className="md:hidden grid grid-cols-3 gap-2.5">
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="trade-stat-card">
                <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">{s.label}</p>
                <p className={`text-sm font-mono font-bold mt-1 ${s.accent ? 'text-yellow-400' : 'text-foreground/90'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Leverage Trading Banner - Mobile */}
          <div className="md:hidden">
            <LeverageTradingBanner />
          </div>


          {priceChange !== 0 && (
            <div className="md:hidden flex items-center justify-between px-5 py-3 trade-glass-panel">
              <span className="text-[13px] font-mono text-muted-foreground/50">24h Change</span>
              <span className={`trade-price-pill ${isPriceUp ? 'trade-price-pill-up' : 'trade-price-pill-down'} text-sm`}>
                {isPriceUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {formatChange24h(priceChange)}
              </span>
            </div>
          )}

          {/* ── BONDING PROGRESS ── */}
          {isBonding && (
            <div className="trade-glass-panel flex items-center gap-4 px-5 py-3">
              <Zap className="h-4 w-4 text-primary/70 shrink-0" />
              <span className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-wider shrink-0">Bonding</span>
              <div className="flex-1 min-w-[80px]">
                <div className="trade-bonding-bar">
                  <div className="trade-bonding-fill" style={{ width: `${Math.max(Math.min(bondingProgress, 100), 1)}%` }} />
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-primary shrink-0 hidden md:inline">{bondingProgress.toFixed(1)}%</span>
              <span className="text-[12px] font-mono text-muted-foreground/50 shrink-0">{realSolReserves.toFixed(1)}/{GRADUATION_THRESHOLD} SOL</span>
              {livePoolState && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />LIVE
                </span>
              )}
            </div>
          )}

          {/* ── PHONE TAB SWITCHER ── */}
          <div className="md:hidden">
            {(() => {
              const tabs = isPunchToken ? (['chart', 'info'] as const) : (['trade', 'chart', 'info'] as const);
              return (
                <div className="flex bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
                  {tabs.map(tab => (
                    <button key={tab} onClick={() => setMobileTab(tab as any)}
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
              );
            })()}
          </div>

          {/* ═══ MAIN CONTENT — 3 layouts ═══ */}

          {/* PHONE */}
          <div className="md:hidden flex flex-col gap-3">
            {mobileTab === 'trade' && !isPunchToken && (
              <>
                <MobileTradePanelV2
                  bondingToken={isBonding ? tokenForTradePanel : undefined}
                  externalToken={isGraduated && token.mint_address ? { mint_address: token.mint_address, ticker: token.ticker, name: token.name, decimals: 9, price_sol: token.price_sol || 0, imageUrl: token.image_url || undefined } : undefined}
                  userTokenBalance={0}
                />
                <EmbeddedWalletCard />
              </>
            )}
            {mobileTab === 'chart' && (
              <>
                <ChartSection chartHeight={360} />
                <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
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
            <div className={`${isPunchToken ? 'col-span-12' : 'col-span-7'} flex flex-col gap-4`}>
              <ChartSection chartHeight={440} />
              <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
              {isPunchToken && (
                <div className="trade-glass-panel px-5 py-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground/40" />
                  <span className="text-sm font-mono text-muted-foreground/50">Trading coming soon for Punch tokens</span>
                </div>
              )}
              <TokenDetailsSection />
              <ContractSection />
              <DescriptionSection />
            </div>
            {!isPunchToken && (
              <div className="col-span-5 flex flex-col gap-4">
                <div className="sticky top-4 flex flex-col gap-4">
                  <TradeSection />
                  <LeverageTradingBanner />
                  <EmbeddedWalletCard />
                </div>
              </div>
            )}
          </div>

          {/* DESKTOP */}
          <div className="hidden lg:grid grid-cols-12 gap-4 flex-1">
            <div className="col-span-9 flex flex-col gap-4">
              <ChartSection chartHeight={420} />
              <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
            </div>
            <div className="col-span-3 flex flex-col gap-4">
              {isPunchToken ? (
                <div className="trade-glass-panel px-5 py-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground/40" />
                  <span className="text-sm font-mono text-muted-foreground/50">Trading coming soon</span>
                </div>
              ) : (
                <TradeSection />
              )}
              <LeverageTradingBanner />
              {!isPunchToken && <EmbeddedWalletCard />}
              {(token as any).launchpad_type === 'phantom' && (token as any).trading_fee_bps && (
                <div className="trade-glass-panel p-4 space-y-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40">Fee Breakdown</h3>
                  {[
                    { label: 'Total Fee', value: `${((token as any).trading_fee_bps / 100).toFixed(1)}%` },
                    { label: 'Creator', value: `${(((token as any).creator_fee_bps || 0) / 100).toFixed(1)}%`, accent: true },
                    { label: 'Platform', value: `${(((token as any).trading_fee_bps - ((token as any).creator_fee_bps || 0)) / 100).toFixed(1)}%` },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px] font-mono">
                      <span className="text-muted-foreground/50">{r.label}</span>
                      <span className={r.accent ? 'text-primary' : 'text-foreground/70'}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {(token as any).fee_mode === 'holder_rewards' && (
                <div className="trade-glass-panel p-4 space-y-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/40 flex items-center gap-2">
                    <Users className="h-3 w-3 text-green-400/70" /> Holder Rewards
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/18">ON</span>
                  </h3>
                  <div className="space-y-1 text-[11px] font-mono text-muted-foreground/50">
                    <p className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Top 50 holders share 50% fees</p>
                    <p className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Proportional to balance</p>
                    <p className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Auto SOL payouts every 5 min</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* PHONE bottom bar */}
      {!isPunchToken && (
        <div className="md:hidden fixed left-0 right-0 z-50 trade-mobile-bar" style={{ bottom: '48px', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}>
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[12px] font-mono text-muted-foreground/50">{(token.price_sol || 0).toFixed(6)} SOL</span>
              {priceChange !== 0 && (
                <span className={`text-[12px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                  {formatChange24h(priceChange)}
                </span>
              )}
            </div>
            <button onClick={() => setMobileTab('trade')} className="trade-btn-buy font-mono text-sm font-bold min-w-[76px] px-6 py-2.5 rounded-lg min-h-[42px] active:scale-95">BUY</button>
            <button onClick={() => setMobileTab('trade')} className="trade-btn-sell font-mono text-sm font-bold min-w-[76px] px-6 py-2.5 rounded-lg min-h-[42px] active:scale-95">SELL</button>
          </div>
        </div>
      )}
    </LaunchpadLayout>
  );
}