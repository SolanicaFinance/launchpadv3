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
import { useToast } from "@/hooks/use-toast";
import { useTwitterProfile } from "@/hooks/useTwitterProfile";
import { BagsBadge } from "@/components/forum/BagsBadge";
import { PumpBadge } from "@/components/forum/PumpBadge";
import { PhantomBadge } from "@/components/forum/PhantomBadge";
import { TokenDataTabs } from "@/components/launchpad/TokenDataTabs";
import { BRAND } from "@/config/branding";

/** Detect if an address is an EVM hex address (0x...) */
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

/** Lightweight view for tokens not in our database — fetched from Codex on-chain data */
function ExternalTokenView({ token, mintAddress, solPrice, isBsc = false }: { token: import("@/hooks/useExternalToken").ExternalToken; mintAddress: string; solPrice: number; isBsc?: boolean }) {
  const networkId = isBsc ? BSC_NETWORK_ID : SOLANA_NETWORK_ID;
  const privyAvailable = usePrivyAvailable();
  const { solanaAddress } = useAuth();
  const { managedWallets } = useMultiWallet();
  const allWalletAddresses = useMemo(() => managedWallets.map(w => w.address), [managedWallets]);
  const { toast } = useToast();
  const [mobileTab, setMobileTab] = useState<'trade' | 'chart'>('trade');

  const copyAddress = () => {
    navigator.clipboard.writeText(mintAddress);
    toast({ title: "Address copied!" });
  };
  const shareToken = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!" });
  };

  const formatUsdCompact = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v > 0) return `$${v.toFixed(6)}`;
    return '$0';
  };

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
      <div className="trade-page-bg -m-4 p-2.5 md:p-4">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-2.5 pb-32 md:pb-24">

          {/* TOP BAR */}
          <div className="trade-topbar overflow-hidden">
            <div className="flex items-center gap-2.5 px-3 py-2.5 lg:py-2">
              <Link to="/trade" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5">
                  <ArrowLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </Button>
              </Link>

              <Avatar className="h-9 w-9 md:h-8 md:w-8 rounded-lg trade-avatar-glow shrink-0">
                <AvatarImage src={token.imageUrl || undefined} className="object-cover" />
                <AvatarFallback className="rounded-lg text-[10px] font-bold bg-primary/10 text-primary font-mono">
                  {(token.symbol || '??').slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center gap-1.5 min-w-0 shrink">
                <h1 className="text-sm font-bold font-mono tracking-tight truncate max-w-[100px] sm:max-w-[140px] md:max-w-[200px] lg:max-w-none">{token.name}</h1>
                <span className="text-xs md:text-[11px] font-mono text-muted-foreground shrink-0">${token.symbol}</span>
                {token.migrated && (
                  <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-green-500/12 text-green-400 border border-green-500/20 shrink-0">GRAD</span>
                )}
                {!token.completed && !token.migrated && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-0.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />LIVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto sm:ml-2 shrink-0">
                <span className="text-sm sm:text-xs font-mono font-bold text-foreground">{formatUsdCompact(token.priceUsd)}</span>
                {token.change24h !== 0 && (
                  <span className={`trade-price-pill ${isPriceUp ? 'trade-price-pill-up' : 'trade-price-pill-down'}`}>
                    {isPriceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatChange24h(token.change24h)}
                  </span>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-4 ml-3 min-w-0">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">{s.label}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'text-primary' : 'text-foreground/90'}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-0.5 shrink-0 ml-1 sm:ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={copyAddress}><Copy className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={shareToken}><Share2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <div className="hidden md:flex items-center gap-0.5">
                  {token.websiteUrl && <a href={token.websiteUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><Globe className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.twitterUrl && <a href={token.twitterUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><Twitter className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  <a href={getExplorerUrl(mintAddress, isBsc)} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>
                </div>
                <a href={getExplorerUrl(mintAddress, isBsc)} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-8 lg:h-7 px-2.5 text-[9px] font-mono gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg">
                    <ExternalLink className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">Explorer</span>
                  </Button>
                </a>
              </div>
            </div>

            <div className="hidden sm:flex lg:hidden items-center gap-4 px-3 py-2 overflow-x-auto scrollbar-none border-t border-border/10">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">{s.label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'text-primary' : 'text-foreground/90'}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone stats */}
          <div className="md:hidden grid grid-cols-3 gap-1.5">
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="trade-stat-card">
                <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">{s.label}</p>
                <p className={`text-sm font-mono font-bold mt-1 ${s.accent ? 'text-primary' : 'text-foreground'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Graduation progress */}
          {token.graduationPercent !== null && !token.completed && !token.migrated && (
            <div className="trade-glass-panel flex items-center gap-3 px-4 py-3 md:py-2.5 lg:py-2">
              <Zap className="h-4 w-4 md:h-3.5 md:w-3.5 lg:h-3 lg:w-3 text-primary shrink-0" />
              <span className="text-[10px] md:text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Bonding</span>
              <div className="flex-1 min-w-[80px]">
                <div className="trade-bonding-bar">
                  <div className="trade-bonding-fill" style={{ width: `${Math.max(Math.min(token.graduationPercent, 100), 1)}%` }} />
                </div>
              </div>
              <span className="text-xs md:text-[11px] lg:text-[10px] font-mono font-bold text-primary shrink-0">{token.graduationPercent.toFixed(1)}%</span>
            </div>
          )}

          {/* Phone tab switcher */}
          <div className="md:hidden">
            <div className="flex bg-muted/30 rounded-lg p-0.5 border border-border/20">
              {(['trade', 'chart'] as const).map(tab => (
                <button key={tab} onClick={() => setMobileTab(tab)}
                  className={`flex-1 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1 rounded-md ${
                    mobileTab === tab
                      ? 'bg-secondary/80 text-foreground font-semibold border-b-2 border-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {tab === 'trade' && <Activity className="h-3 w-3" />}
                  {tab === 'chart' && <BarChart3 className="h-3 w-3" />}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Phone layout */}
          <div className="md:hidden flex flex-col gap-2">
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
                  <CodexChart tokenAddress={mintAddress} networkId={networkId} height={340} />
                </div>
                <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} isBsc={isBsc} />
              </>
            )}
          </div>

          {/* Tablet layout */}
          <div className="hidden md:grid lg:hidden grid-cols-12 gap-2">
            <div className="col-span-7 flex flex-col gap-2">
              <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
                <CodexChart tokenAddress={mintAddress} networkId={networkId} height={420} />
              </div>
              <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} isBsc={isBsc} />
              <div className="trade-glass-panel p-3 space-y-1.5">
                <h3 className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Contract</h3>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] font-mono text-foreground/70 truncate flex-1">{mintAddress.slice(0, 10)}...{mintAddress.slice(-4)}</code>
                  <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors p-1"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
            <div className="col-span-5 flex flex-col gap-2">
              <div className="sticky top-2 flex flex-col gap-2">
                {privyAvailable && (
                  isBsc
                    ? <BnbTradePanel tokenAddress={mintAddress} ticker={token.symbol} name={token.name} imageUrl={token.imageUrl} />
                    : <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
                )}
                <EmbeddedWalletCard />
              </div>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:grid grid-cols-12 gap-2 flex-1">
            <div className="col-span-9 flex flex-col gap-2">
              <div className="trade-glass-panel-glow trade-chart-wrapper overflow-hidden">
                <CodexChart tokenAddress={mintAddress} networkId={networkId} height={380} />
              </div>
              <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} isBsc={isBsc} />
            </div>
            <div className="col-span-3 flex flex-col gap-2">
              {privyAvailable && (
                isBsc
                  ? <BnbTradePanel tokenAddress={mintAddress} ticker={token.symbol} name={token.name} imageUrl={token.imageUrl} />
                  : <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
              )}
              <EmbeddedWalletCard />
              <div className="trade-glass-panel p-3 space-y-1.5">
                <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1"><Activity className="h-3 w-3" /> Token Details</h3>
                {[
                  { label: 'Price', value: formatUsdCompact(token.priceUsd) },
                  { label: 'Market Cap', value: formatUsdCompact(token.marketCapUsd) },
                  { label: 'Volume 24h', value: formatUsdCompact(token.volume24hUsd) },
                  { label: 'Holders', value: token.holders.toLocaleString() },
                  { label: 'Liquidity', value: formatUsdCompact(token.liquidity) },
                ].map((row, i) => (
                  <div key={i} className="trade-detail-row">
                    <span className="text-[10px] font-mono text-muted-foreground/60">{row.label}</span>
                    <span className="text-[10px] font-mono text-foreground/85 font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="trade-glass-panel p-3 space-y-1.5">
                <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Contract</h3>
                <div className="flex items-center gap-2">
                  <code className="text-[9px] font-mono text-foreground/70 truncate flex-1">{mintAddress.slice(0, 10)}...{mintAddress.slice(-4)}</code>
                  <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors p-1"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phone bottom bar */}
      <div className="md:hidden fixed left-0 right-0 z-50 trade-mobile-bar" style={{ bottom: '40px', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground truncate">{formatUsdCompact(token.priceUsd)}</span>
            {token.change24h !== 0 && (
              <span className={`text-[10px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                {formatChange24h(token.change24h)}
              </span>
            )}
          </div>
          <button onClick={() => setMobileTab('trade')} className="trade-btn-buy font-mono text-xs font-bold px-6 py-2.5 rounded-lg min-h-[44px] active:scale-95">BUY</button>
          <button onClick={() => setMobileTab('trade')} className="trade-btn-sell font-mono text-xs font-bold px-6 py-2.5 rounded-lg min-h-[44px] active:scale-95">SELL</button>
        </div>
      </div>
    </LaunchpadLayout>
  );
}

export default function FunTokenDetailPage() {
  const { mintAddress } = useParams<{ mintAddress: string }>();
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const { managedWallets } = useMultiWallet();
  const allWalletAddresses = useMemo(() => managedWallets.map(w => w.address), [managedWallets]);
  const { solPrice } = useSolPrice();
  const { bnbPrice } = useBnbPrice();
  const { toast } = useToast();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [mobileTab, setMobileTab] = useState<'trade' | 'chart' | 'comments'>('chart');

  // Detect if this is a BSC token (0x prefix)
  const isBsc = isEvmAddress(mintAddress || '');
  const networkId = isBsc ? BSC_NETWORK_ID : SOLANA_NETWORK_ID;
  const activePrice = isBsc ? bnbPrice : solPrice;

  const { data: token, isLoading, refetch } = useFunToken(mintAddress || '');
  
  // Fallback: fetch from Codex if not in our database
  const { data: externalToken, isLoading: externalLoading } = useExternalToken(
    mintAddress || '',
    !isLoading && !token,
    networkId
  );

  // Also fetch Codex data for internal tokens — gives accurate price, holders, mcap
  const { data: codexEnrichment } = useExternalToken(
    mintAddress || '',
    !!token && !!mintAddress,
    networkId
  );

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
    if (address) {
      navigator.clipboard.writeText(address);
      toast({ title: "Address copied!" });
    }
  };

  const shareToken = () => {
    if (navigator.share && token) {
      navigator.share({
        title: `${token.name} ($${token.ticker})`,
        text: `Check out ${token.name} on ${BRAND.name}!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!" });
    }
  };

  const handleRefresh = () => {
    refetch();
    refetchPoolState();
    toast({ title: "Refreshed" });
  };

  const bondingProgress = livePoolState?.bondingProgress ?? token?.bonding_progress ?? 0;
  const realSolReserves = (bondingProgress / 100) * GRADUATION_THRESHOLD;
  const isGraduated = token?.status === 'graduated';
  const isBonding = token?.status === 'active';
  const isPunchToken = (token as any)?.launchpad_type === 'punch';
  const priceChange = (token as any)?.price_change_24h || 0;
  const isPriceUp = priceChange >= 0;

  const { data: twitterProfile } = useTwitterProfile(token?.launch_author);

  // Loading (either DB or external)
  if (isLoading || (!token && externalLoading)) {
    return (
      <LaunchpadLayout>
        <div className="trade-page-bg p-2">
          <div className="max-w-[1600px] mx-auto space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-7 lg:col-span-9">
                <Skeleton className="h-[70vh] w-full rounded-lg" />
              </div>
              <div className="hidden md:block md:col-span-5 lg:col-span-3">
                <Skeleton className="h-[70vh] w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  // External token (not in our DB but found on-chain via Codex)
  if (!token && externalToken) {
    return <ExternalTokenView token={externalToken} mintAddress={mintAddress || ''} solPrice={activePrice} isBsc={isBsc} />;
  }

  // Not found anywhere
  if (!token) {
    return (
      <LaunchpadLayout>
        <div className="trade-page-bg flex flex-col items-center justify-center py-20">
          <h2 className="text-lg font-bold font-mono">Token not found</h2>
          <p className="text-muted-foreground mt-1 font-mono text-xs">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-3">
            <Button className="px-4 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20">Back to Terminal</Button>
          </Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const tokenForTradePanel = {
    id: token.id,
    mint_address: token.mint_address || '',
    name: token.name,
    ticker: token.ticker,
    description: token.description,
    image_url: token.image_url,
    website_url: token.website_url || null,
    twitter_url: token.twitter_url || null,
    telegram_url: token.telegram_url || null,
    discord_url: token.discord_url || null,
    creator_wallet: token.creator_wallet,
    creator_id: null,
    dbc_pool_address: token.dbc_pool_address,
    damm_pool_address: null,
    virtual_sol_reserves: 30,
    virtual_token_reserves: TOTAL_SUPPLY,
    real_sol_reserves: realSolReserves,
    real_token_reserves: 0,
    total_supply: TOTAL_SUPPLY,
    bonding_curve_progress: bondingProgress,
    graduation_threshold_sol: GRADUATION_THRESHOLD,
    price_sol: token.price_sol || 0,
    market_cap_sol: token.market_cap_sol || 0,
    volume_24h_sol: token.volume_24h_sol || 0,
    status: isBonding ? 'bonding' : (isGraduated ? 'graduated' : 'failed') as 'bonding' | 'graduated' | 'failed',
    migration_status: 'pending',
    holder_count: token.holder_count || 0,
    created_at: token.created_at,
    updated_at: token.updated_at,
    graduated_at: null,
    profiles: null,
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

  /* ────────────────────────── Reusable sub-sections ────────────────────────── */

  const TradeSection = () => (
    <>
      {!privyAvailable && (
        <div className="trade-glass-panel p-6 md:p-4 text-center">
          <p className="text-muted-foreground text-sm md:text-xs font-mono">Wallet backend unavailable right now. Reload in a moment.</p>
        </div>
      )}
      {privyAvailable && isBsc && token.mint_address && (
        <BnbTradePanel
          tokenAddress={token.mint_address}
          ticker={token.ticker}
          name={token.name}
          imageUrl={token.image_url || undefined}
        />
      )}
      {privyAvailable && !isBsc && isBonding && <TradePanelWithSwap token={tokenForTradePanel} userBalance={0} />}
      {privyAvailable && !isBsc && isGraduated && token.mint_address && (
        <UniversalTradePanel
          token={{ mint_address: token.mint_address, ticker: token.ticker, name: token.name, decimals: 9, price_sol: token.price_sol || 0, imageUrl: token.image_url || undefined }}
          userTokenBalance={0}
        />
      )}
      {privyAvailable && !isBsc && !isBonding && !isGraduated && (
        <div className="trade-glass-panel p-6 md:p-4 text-center">
          <p className="text-muted-foreground text-sm md:text-xs font-mono">Trading not available · Status: {token.status}</p>
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
      <div className="trade-glass-panel p-4 md:p-3 lg:p-3 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] md:text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-primary/60" /> Token Details
          </h3>
          <span className={`trade-risk-badge ${risk.className}`}>
            <Shield className="h-2.5 w-2.5" />
            {risk.label}
          </span>
        </div>
        <div className="space-y-0">
          {[
            { label: 'Price', value: codexPrice && codexPrice > 0 ? formatPriceUsd(codexPrice) : `${(token.price_sol || 0).toFixed(8)} SOL` },
            { label: 'Market Cap', value: codexMcap && codexMcap > 0 ? `$${codexMcap >= 1000 ? `${(codexMcap / 1000).toFixed(1)}K` : codexMcap.toFixed(0)}` : formatUsd(token.market_cap_sol || 0) },
            { label: 'Volume 24h', value: codexEnrichment?.volume24hUsd && codexEnrichment.volume24hUsd > 0 ? `$${codexEnrichment.volume24hUsd.toFixed(0)}` : `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
            { label: 'Holders', value: holders.toLocaleString() },
            { label: 'Supply', value: formatTokenAmount(TOTAL_SUPPLY) },
            { label: 'Age', value: formatDistanceToNow(new Date(token.created_at), { addSuffix: false }) },
          ].map((row, i) => (
            <div key={i} className="trade-detail-row">
              <span className="text-[11px] md:text-[10px] font-mono text-muted-foreground/60">{row.label}</span>
              <span className="text-[11px] md:text-[10px] font-mono text-foreground/85 font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ContractSection = () => {
    if (!token.mint_address) return null;
    return (
      <div className="trade-glass-panel p-4 md:p-3 lg:p-3 space-y-1.5">
        <h3 className="text-[10px] md:text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Contract</h3>
        <div className="flex items-center gap-2">
          <code className="text-xs md:text-[10px] lg:text-[9px] font-mono text-foreground/70 truncate flex-1">
            {token.mint_address.slice(0, 10)}...{token.mint_address.slice(-4)}
          </code>
          <button onClick={copyAddress} className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-2 md:p-1 min-h-[44px] md:min-h-[36px] flex items-center justify-center">
            <Copy className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>
        </div>
        {token.dbc_pool_address && (
          <div>
            <span className="text-[9px] md:text-[8px] font-mono text-muted-foreground/50 uppercase">Pool</span>
            <code className="text-xs md:text-[10px] lg:text-[9px] font-mono text-foreground/70 truncate block">
              {token.dbc_pool_address.slice(0, 10)}...{token.dbc_pool_address.slice(-4)}
            </code>
          </div>
        )}
      </div>
    );
  };

  const DescriptionSection = () => {
    if (!token.description) return null;
    return (
      <div className="trade-glass-panel p-4 md:p-3 lg:p-3">
        <p className={`text-xs md:text-[11px] lg:text-[10px] text-muted-foreground/80 font-mono leading-relaxed ${!showFullDesc ? 'line-clamp-2' : ''}`}>
          {token.description}
        </p>
        {token.description.length > 100 && (
          <button
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="text-xs md:text-[10px] font-mono text-primary/70 hover:text-primary mt-1 flex items-center gap-0.5 min-h-[44px] md:min-h-[36px] transition-colors"
          >
            {showFullDesc ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> More</>}
          </button>
        )}
      </div>
    );
  };
  const PnlSimulator = () => {
    const [simSol, setSimSol] = useState('');
    const [simMultiplier, setSimMultiplier] = useState('2');
    const simAmount = parseFloat(simSol) || 0;
    const simMult = parseFloat(simMultiplier) || 2;
    const simProfit = simAmount * (simMult - 1);
    const simProfitPct = ((simMult - 1) * 100).toFixed(0);

    return (
      <div className="trade-pnl-panel p-3 space-y-2">
        <h3 className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5">
          <TrendingUp className="h-2.5 w-2.5 text-primary/60" /> PNL Simulator
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="number"
              placeholder="SOL amount"
              value={simSol}
              onChange={(e) => setSimSol(e.target.value)}
              className="w-full bg-hsl(222 28% 8% / 0.8) border border-border/30 rounded-md px-2.5 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 trade-input-glow focus:outline-none"
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/50">×</span>
          <select
            value={simMultiplier}
            onChange={(e) => setSimMultiplier(e.target.value)}
            className="bg-hsl(222 28% 8% / 0.8) border border-border/30 rounded-md px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none trade-input-glow appearance-none cursor-pointer"
          >
            {[2, 3, 5, 10, 20, 50, 100].map(m => (
              <option key={m} value={m}>{m}x</option>
            ))}
          </select>
        </div>
        {simAmount > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-mono text-muted-foreground/60">Profit at {simMult}x</span>
            <span className="text-[11px] font-mono font-bold text-green-400">
              +{simProfit.toFixed(2)} SOL ({simProfitPct}%)
            </span>
          </div>
        )}
      </div>
    );
  };

  const CommentsSection = () => (
    <div className="trade-glass-panel p-4 md:p-3 lg:p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
      <h3 className="text-[10px] md:text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5 mb-2">
        <MessageCircle className="h-3 w-3 text-primary/60" /> Discussion
      </h3>
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        <TokenComments tokenId={token.id} />
      </div>
    </div>
  );

  return (
    <LaunchpadLayout>
      <div className="trade-page-bg -m-4 p-2.5 md:p-4">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-2.5 pb-32 md:pb-24">

          {/* ──── TOP BAR ──── */}
          <div className="trade-topbar overflow-hidden">
            {/* ROW 1: Logo + Name + Price + Actions */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 lg:py-2">
              <Link to="/" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5">
                  <ArrowLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </Button>
              </Link>

              <Avatar className="h-10 w-10 md:h-9 md:w-9 rounded-lg trade-avatar-glow shrink-0">
                <AvatarImage src={token.image_url || undefined} className="object-cover" />
                <AvatarFallback className="rounded-lg text-[10px] font-bold bg-primary/10 text-primary font-mono">
                  {(token.ticker || '??').slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              {/* Name + Symbol + LIVE */}
              <div className="flex items-center gap-1.5 min-w-0 shrink">
                <h1 className="text-base md:text-sm font-bold font-mono tracking-tight truncate max-w-[100px] sm:max-w-[140px] md:max-w-[200px] lg:max-w-none">{token.name}</h1>
                <span className="text-xs md:text-[11px] font-mono text-muted-foreground/70 shrink-0">${token.ticker}</span>
                {isGraduated && (
                  <span className="hidden sm:inline text-[9px] font-mono px-2 py-0.5 rounded-md bg-green-500/12 text-green-400 border border-green-500/20 shrink-0">GRADUATED</span>
                )}
                {isBonding && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />LIVE
                  </span>
                )}
              </div>

              {/* Price + 24h change */}
              <div className="flex items-center gap-2 ml-auto sm:ml-3 shrink-0">
                <span className="text-base sm:text-sm font-mono font-bold text-foreground">
                  {(token.price_sol || 0).toFixed(8)}
                </span>
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground/50">SOL</span>
                {priceChange !== 0 && (
                  <span className={`trade-price-pill ${isPriceUp ? 'trade-price-pill-up' : 'trade-price-pill-down'}`}>
                    {isPriceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatChange24h(priceChange)}
                  </span>
                )}
              </div>

              {/* Inline stats — lg+ only */}
              <div className="hidden lg:flex items-center gap-4 ml-3 min-w-0">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">{s.label}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'text-primary' : 'text-foreground/90'}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 ml-1 sm:ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-8 sm:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={handleRefresh}><RefreshCw className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-8 sm:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={copyAddress}><Copy className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={shareToken}><Share2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <div className="hidden md:flex items-center gap-0.5">
                  {token.website_url && <a href={token.website_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><Globe className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.twitter_url && <a href={token.twitter_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><Twitter className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.telegram_url && <a href={token.telegram_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><MessageCircle className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.mint_address && <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground hover:bg-primary/5"><ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                </div>
                 {(token as any).launchpad_type === 'bags' && token.mint_address && (
                  <a href={`https://bags.fm/coin/${token.mint_address}`} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex">
                    <Button size="sm" className="h-8 lg:h-7 px-2.5 text-[9px] font-mono gap-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg">
                      <Briefcase className="h-2.5 w-2.5" />bags
                    </Button>
                  </a>
                )}
                <div className="hidden lg:flex items-center gap-0.5">
                  {(token as any).launchpad_type === 'bags' && <BagsBadge mintAddress={token.mint_address || undefined} size="sm" />}
                  {(token as any).launchpad_type === 'pumpfun' && <PumpBadge mintAddress={token.mint_address || undefined} size="sm" />}
                  {(token as any).launchpad_type === 'phantom' && <PhantomBadge mintAddress={token.mint_address || undefined} size="sm" />}
                </div>
              </div>
            </div>

            {/* ROW 2: Secondary stats — visible on sm-lg, scrollable */}
            <div className="hidden sm:flex lg:hidden items-center gap-4 px-3 py-2 overflow-x-auto scrollbar-none border-t border-border/10">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">{s.label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'text-primary' : 'text-foreground/90'}`}>{s.value}</span>
                </div>
              ))}
              {/* Creator */}
              {token.launch_author && (
                <a href={`https://x.com/${token.launch_author}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  {twitterProfile?.profileImageUrl && <img src={twitterProfile.profileImageUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}
                  @{token.launch_author}
                </a>
              )}
              {/* Trust pills */}
              <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/15 flex items-center gap-1 shrink-0">
                <Shield className="h-2.5 w-2.5" /> NON-CUSTODIAL
              </span>
            </div>
          </div>

          {/* ──── PHONE ONLY: Stats row ──── */}
          <div className="md:hidden grid grid-cols-3 gap-1">
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="trade-stat-card">
                <p className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest">{s.label}</p>
                <p className={`text-xs font-mono font-bold mt-0.5 ${s.accent ? 'text-primary' : 'text-foreground'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ──── PHONE ONLY: Price change ──── */}
          {priceChange !== 0 && (
            <div className="md:hidden flex items-center justify-between px-4 py-2.5 trade-glass-panel">
              <span className="text-xs font-mono text-muted-foreground/60">24h Change</span>
              <span className={`trade-price-pill ${isPriceUp ? 'trade-price-pill-up' : 'trade-price-pill-down'} text-sm`}>
                {isPriceUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {formatChange24h(priceChange)}
              </span>
            </div>
          )}

          {/* ──── BONDING PROGRESS ──── */}
          {isBonding && (
            <div className="trade-glass-panel-glow flex items-center gap-2.5 px-3 py-2 md:py-2 lg:py-2">
              <Zap className="h-3.5 w-3.5 md:h-3.5 md:w-3.5 lg:h-3 lg:w-3 text-primary shrink-0" />
              <span className="text-[9px] md:text-[9px] font-mono text-muted-foreground/70 uppercase tracking-wider shrink-0">Bonding</span>
              <div className="flex-1 min-w-[80px]">
                <div className="trade-bonding-bar">
                  <div className="trade-bonding-fill" style={{ width: `${Math.max(Math.min(bondingProgress, 100), 1)}%` }} />
                </div>
              </div>
              <span className="text-[11px] md:text-[11px] lg:text-[10px] font-mono font-bold text-primary shrink-0 hidden md:inline">{bondingProgress.toFixed(1)}%</span>
              <span className="text-[10px] md:text-[10px] lg:text-[9px] font-mono text-muted-foreground/60 shrink-0">{realSolReserves.toFixed(1)}/{GRADUATION_THRESHOLD} SOL</span>
              {livePoolState && (
                <span className="flex items-center gap-1 text-[9px] md:text-[9px] lg:text-[8px] font-mono text-red-400 shrink-0">
                  <span className="h-1.5 w-1.5 md:h-1.5 md:w-1.5 lg:h-1 lg:w-1 rounded-full bg-red-400 animate-pulse" />LIVE
                </span>
              )}
            </div>
          )}

          {/* ──── PHONE ONLY: Tab switcher ──── */}
          <div className="md:hidden">
            {(() => {
              const tabs = isPunchToken
                ? (['chart', 'comments'] as const)
                : (['trade', 'chart', 'comments'] as const);
              return (
                <div className={`flex bg-muted/30 rounded-lg p-0.5 border border-border/20`}>
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setMobileTab(tab as any)}
                      className={`flex-1 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1 rounded-md ${
                        mobileTab === tab
                          ? 'bg-secondary/80 text-foreground font-semibold border-b-2 border-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab === 'trade' && <Activity className="h-3 w-3" />}
                      {tab === 'chart' && <BarChart3 className="h-3 w-3" />}
                      {tab === 'comments' && <MessageCircle className="h-3 w-3" />}
                      {tab}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ════════════════════════════════════════════════════════════════
               MAIN CONTENT — 3 layouts:
               Phone (<md):  single column, tab-switched
               Tablet (md):  2-col — chart+info left (7), trade+wallet right (5)
               Desktop (lg): 3-zone — chart+trade left (9), info+comments right (3)
             ════════════════════════════════════════════════════════════════ */}

          {/* ── PHONE layout (< md) ── */}
          <div className="md:hidden flex flex-col gap-2">
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
                <ChartSection chartHeight={340} />
                <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
              </>
            )}
            {mobileTab === 'comments' && (
              <>
                <TokenDetailsSection />
                <ContractSection />
                <DescriptionSection />
                <PnlSimulator />
                <CommentsSection />
              </>
            )}
          </div>

          {/* ── TABLET layout (md to lg) ── */}
          <div className="hidden md:grid lg:hidden grid-cols-12 gap-2">
            <div className={`${isPunchToken ? 'col-span-12' : 'col-span-7'} flex flex-col gap-2`}>
              <ChartSection chartHeight={420} />
              <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
              {isPunchToken && (
                <div className="trade-glass-panel px-4 py-3 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">Trading coming soon for Punch tokens</span>
                </div>
              )}
              <TokenDetailsSection />
              <ContractSection />
              <DescriptionSection />
              <PnlSimulator />
              <CommentsSection />
            </div>
            {!isPunchToken && (
              <div className="col-span-5 flex flex-col gap-2">
                <div className="sticky top-2 flex flex-col gap-2">
                  <TradeSection />
                  <EmbeddedWalletCard />
                </div>
              </div>
            )}
          </div>

          {/* ── DESKTOP layout (lg+) ── */}
          <div className="hidden lg:grid grid-cols-12 gap-2 flex-1">
            {/* Left: Chart + DataTabs */}
            <div className="col-span-9 flex flex-col gap-2">
              <ChartSection chartHeight={380} />
              <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
            </div>
            {/* Right: Trade + Info + Comments + Wallet */}
            <div className="col-span-3 flex flex-col gap-2">
              {isPunchToken ? (
                <div className="trade-glass-panel px-4 py-3 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">Trading coming soon for Punch tokens</span>
                </div>
              ) : (
                <TradeSection />
              )}
              {!isPunchToken && <EmbeddedWalletCard />}
              <TokenDetailsSection />
              <ContractSection />
              <DescriptionSection />
              {(token as any).launchpad_type === 'phantom' && (token as any).trading_fee_bps && (
                <div className="trade-glass-panel p-3 space-y-1.5">
                  <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Fee Breakdown</h3>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/70">Total Fee</span>
                    <span className="text-foreground">{((token as any).trading_fee_bps / 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/70">Creator</span>
                    <span className="text-primary">{(((token as any).creator_fee_bps || 0) / 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground/70">Platform</span>
                    <span className="text-muted-foreground">{(((token as any).trading_fee_bps - ((token as any).creator_fee_bps || 0)) / 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}
              {(token as any).fee_mode === 'holder_rewards' && (
                <div className="trade-glass-panel p-3 space-y-1.5">
                  <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1.5">
                    <Users className="h-2.5 w-2.5 text-green-400" /> Holder Rewards
                    <span className="text-[7px] px-1.5 py-px rounded-md bg-green-500/12 text-green-400 border border-green-500/20">ON</span>
                  </h3>
                  <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground/70">
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Top 50 holders share 50% fees</p>
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Proportional to balance</p>
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Auto SOL payouts every 5 min</p>
                  </div>
                </div>
              )}
              <PnlSimulator />
              <CommentsSection />
            </div>
          </div>

        </div>
      </div>

      {/* ──── PHONE ONLY: Bottom-fixed quick action bar ──── */}
      {!isPunchToken && (
        <div className="md:hidden fixed left-0 right-0 z-50 trade-mobile-bar" style={{ bottom: '40px', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground truncate">
                {(token.price_sol || 0).toFixed(6)} SOL
              </span>
              {priceChange !== 0 && (
                <span className={`text-[10px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                  {formatChange24h(priceChange)}
                </span>
              )}
            </div>
            <button
              onClick={() => setMobileTab('trade')}
              className="trade-btn-buy font-mono text-xs font-bold px-6 py-2.5 rounded-lg min-h-[44px] active:scale-95"
            >
              BUY
            </button>
            <button
              onClick={() => setMobileTab('trade')}
              className="trade-btn-sell font-mono text-xs font-bold px-6 py-2.5 rounded-lg min-h-[44px] active:scale-95"
            >
              SELL
            </button>
          </div>
        </div>
      )}
    </LaunchpadLayout>
  );
}
