import { useState, useMemo } from "react";
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
import { BagsBadge } from "@/components/clawbook/BagsBadge";
import { PumpBadge } from "@/components/clawbook/PumpBadge";
import { PhantomBadge } from "@/components/clawbook/PhantomBadge";
import { TokenDataTabs } from "@/components/launchpad/TokenDataTabs";

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
    : `https://axiom.trade/meme/${addr}?chain=sol`;
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
      <div className="min-h-screen -m-4 p-2 md:p-3" style={{ backgroundColor: 'hsl(222 47% 7%)' }}>
        <div className="max-w-[1600px] mx-auto flex flex-col gap-1.5 pb-32 md:pb-24">

          {/* TOP BAR */}
          <div className="terminal-panel-flush rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 lg:py-1.5">
              <Link to="/trade" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </Button>
              </Link>

              <Avatar className="h-9 w-9 md:h-8 md:w-8 rounded-lg border border-border/40 shrink-0">
                <AvatarImage src={token.imageUrl || undefined} className="object-cover" />
                <AvatarFallback className="rounded-lg text-[10px] font-bold bg-primary/10 text-primary font-mono">
                  {(token.symbol || '??').slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-center gap-1.5 min-w-0 shrink">
                <h1 className="text-sm font-bold font-mono tracking-tight truncate max-w-[100px] sm:max-w-[140px] md:max-w-[200px] lg:max-w-none">{token.name}</h1>
                <span className="text-xs md:text-[11px] font-mono text-muted-foreground shrink-0">${token.symbol}</span>
                {token.migrated && (
                  <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 shrink-0">GRAD</span>
                )}
                {!token.completed && !token.migrated && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20 flex items-center gap-0.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />LIVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-auto sm:ml-2 shrink-0">
                <span className="text-sm sm:text-xs font-mono font-bold text-foreground">{formatUsdCompact(token.priceUsd)}</span>
                {token.change24h !== 0 && (
                  <span className={`text-xs sm:text-[11px] font-mono font-semibold flex items-center gap-0.5 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                    {isPriceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPriceUp ? '+' : ''}{Math.abs(token.change24h).toFixed(1)}%
                  </span>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-3 ml-2 min-w-0">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">{s.label}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'terminal-stat-teal' : 'text-foreground/90'}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-0.5 shrink-0 ml-1 sm:ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground" onClick={copyAddress}><Copy className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground" onClick={shareToken}><Share2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <div className="hidden md:flex items-center gap-0.5">
                  {token.websiteUrl && <a href={token.websiteUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><Globe className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.twitterUrl && <a href={token.twitterUrl} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><Twitter className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  <a href={getExplorerUrl(mintAddress, isBsc)} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>
                </div>
                <a href={getTradeUrl(mintAddress, isBsc)} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-8 lg:h-7 px-2 text-[9px] font-mono gap-0.5 bg-accent/15 hover:bg-accent/25 text-accent-foreground rounded flex items-center">
                    {isBsc ? (
                      <>
                        <img src={pancakeswapBunny} alt="PancakeSwap" className="h-4 w-4 rounded-full object-cover flex-shrink-0" />
                        <span className="hidden sm:inline">PancakeSwap</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        <span className="hidden sm:inline">Axiom</span>
                      </>
                    )}
                  </Button>
                </a>
              </div>
            </div>

            <div className="hidden sm:flex lg:hidden items-center gap-3 px-3 py-1.5 overflow-x-auto scrollbar-none border-t border-border/10">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">{s.label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'terminal-stat-teal' : 'text-foreground/90'}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phone stats */}
          <div className="md:hidden grid grid-cols-3 gap-px terminal-panel-flush overflow-hidden rounded-lg" style={{ backgroundColor: 'hsl(222 30% 10%)' }}>
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="px-3 py-2.5 text-center" style={{ backgroundColor: 'hsl(222 30% 8% / 0.9)' }}>
                <p className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider">{s.label}</p>
                <p className={`text-sm font-mono font-bold mt-0.5 ${s.accent ? 'terminal-stat-teal' : 'text-foreground'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Graduation progress */}
          {token.graduationPercent !== null && !token.completed && !token.migrated && (
            <div className="terminal-panel-flush flex items-center gap-3 px-4 py-3 md:py-2.5 lg:py-2 rounded-lg">
              <Zap className="h-4 w-4 md:h-3.5 md:w-3.5 lg:h-3 lg:w-3 terminal-stat-orange shrink-0" />
              <span className="text-[10px] md:text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Bonding</span>
              <div className="flex-1 min-w-[80px]">
                <div className="w-full rounded-full overflow-hidden bg-white/10" style={{ height: '10px' }}>
                  <div className="rounded-full bg-cyan-400" style={{ height: '10px', width: `${Math.max(Math.min(token.graduationPercent, 100), 1)}%`, boxShadow: '0 0 12px rgba(34,211,238,0.5)', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <span className="text-xs md:text-[11px] lg:text-[10px] font-mono font-bold terminal-stat-orange shrink-0">{token.graduationPercent.toFixed(1)}%</span>
            </div>
          )}

          {/* Phone tab switcher */}
          <div className="md:hidden">
            <div className="grid grid-cols-2 gap-px terminal-panel-flush rounded-lg overflow-hidden">
              {(['trade', 'chart'] as const).map(tab => (
                <button key={tab} onClick={() => setMobileTab(tab)}
                  className={`py-3 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 min-h-[48px] ${
                    mobileTab === tab ? 'bg-primary/10 text-primary font-bold border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground bg-card/20 active:bg-card/40'
                  }`}>
                  {tab === 'trade' && <Activity className="h-4 w-4" />}
                  {tab === 'chart' && <BarChart3 className="h-4 w-4" />}
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
                  <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
                )}
                <EmbeddedWalletCard />
              </>
            )}
            {mobileTab === 'chart' && (
              <>
                <div className="terminal-panel-flush rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
                  <CodexChart tokenAddress={mintAddress} height={340} />
                </div>
                <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} />
              </>
            )}
          </div>

          {/* Tablet layout */}
          <div className="hidden md:grid lg:hidden grid-cols-12 gap-2">
            <div className="col-span-7 flex flex-col gap-2">
              <div className="terminal-panel-flush rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
                <CodexChart tokenAddress={mintAddress} height={420} />
              </div>
              <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} />
              <div className="terminal-panel-flush rounded-lg p-3 space-y-1.5">
                <h3 className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">Contract</h3>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] font-mono text-foreground/70 truncate flex-1">{mintAddress.slice(0, 10)}...{mintAddress.slice(-4)}</code>
                  <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors p-1"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
            <div className="col-span-5 flex flex-col gap-2">
              <div className="sticky top-2 flex flex-col gap-2">
                {privyAvailable && (
                  <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
                )}
                <EmbeddedWalletCard />
              </div>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:grid grid-cols-12 gap-1.5 flex-1">
            <div className="col-span-9 flex flex-col gap-1.5">
              <div className="terminal-panel-flush rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
                <CodexChart tokenAddress={mintAddress} height={380} />
              </div>
              <TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={token.priceUsd || 0} />
            </div>
            <div className="col-span-3 flex flex-col gap-1.5">
              {privyAvailable && (
                <UniversalTradePanel token={{ mint_address: mintAddress, ticker: token.symbol, name: token.name, decimals: token.decimals, graduated: token.completed || token.migrated, price_sol: solPrice > 0 ? token.priceUsd / solPrice : 0, imageUrl: token.imageUrl }} userTokenBalance={0} />
              )}
              <EmbeddedWalletCard />
              <div className="terminal-panel-flush rounded-lg p-2.5 space-y-1.5">
                <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1"><Activity className="h-3 w-3" /> Token Details</h3>
                {[
                  { label: 'Price', value: formatUsdCompact(token.priceUsd) },
                  { label: 'Market Cap', value: formatUsdCompact(token.marketCapUsd) },
                  { label: 'Volume 24h', value: formatUsdCompact(token.volume24hUsd) },
                  { label: 'Holders', value: token.holders.toLocaleString() },
                  { label: 'Liquidity', value: formatUsdCompact(token.liquidity) },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between text-[10px] font-mono py-1 border-b border-border/10 last:border-0">
                    <span className="text-muted-foreground/70">{row.label}</span>
                    <span className="text-foreground/85 font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="terminal-panel-flush rounded-lg p-2.5 space-y-1.5">
                <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">Contract</h3>
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
      <div className="md:hidden fixed left-0 right-0 z-50" style={{ bottom: '40px', backgroundColor: 'hsl(222 30% 7% / 0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid hsl(222 20% 16%)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground truncate">{formatUsdCompact(token.priceUsd)}</span>
            {token.change24h !== 0 && (
              <span className={`text-[10px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                {isPriceUp ? '+' : ''}{token.change24h.toFixed(1)}%
              </span>
            )}
          </div>
          <button onClick={() => setMobileTab('trade')} className="font-mono text-xs font-bold px-5 py-2.5 rounded-lg min-h-[44px] transition-all active:scale-95 bg-primary text-primary-foreground">BUY</button>
          <button onClick={() => setMobileTab('trade')} className="font-mono text-xs font-bold px-5 py-2.5 rounded-lg min-h-[44px] transition-all active:scale-95 bg-secondary text-destructive border border-destructive/30">SELL</button>
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
    // Fallback: show SOL value with K/M formatting
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
        text: `Check out ${token.name} on Claw Mode!`,
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
        <div className="terminal-bg min-h-screen p-2">
          <div className="max-w-[1600px] mx-auto space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <Skeleton className="md:col-span-7 lg:col-span-9 h-[70vh] rounded-lg" />
              <Skeleton className="hidden md:block md:col-span-5 lg:col-span-3 h-[70vh] rounded-lg" />
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
        <div className="terminal-bg min-h-screen flex flex-col items-center justify-center py-20">
          <h2 className="text-lg font-bold font-mono">Token not found</h2>
          <p className="text-muted-foreground mt-1 font-mono text-xs">This token doesn't exist or has been removed.</p>
          <Link to="/" className="mt-3">
            <Button className="btn-terminal-cta px-4 py-1.5 text-xs">Back to Terminal</Button>
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
        <div className="terminal-panel-flush rounded-lg p-6 md:p-4 text-center">
          <p className="text-muted-foreground text-sm md:text-xs font-mono">Wallet backend unavailable right now. Reload in a moment.</p>
        </div>
      )}
      {privyAvailable && isBonding && <TradePanelWithSwap token={tokenForTradePanel} userBalance={0} />}
      {privyAvailable && isGraduated && token.mint_address && (
        <UniversalTradePanel
          token={{ mint_address: token.mint_address, ticker: token.ticker, name: token.name, decimals: 9, price_sol: token.price_sol || 0, imageUrl: token.image_url || undefined }}
          userTokenBalance={0}
        />
      )}
      {privyAvailable && !isBonding && !isGraduated && (
        <div className="terminal-panel-flush rounded-lg p-6 md:p-4 text-center">
          <p className="text-muted-foreground text-sm md:text-xs font-mono">Trading not available · Status: {token.status}</p>
        </div>
      )}
    </>
  );

  const ChartSection = ({ chartHeight = 460 }: { chartHeight?: number }) => (
    <div className="terminal-panel-flush rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      <CodexChart tokenAddress={token.mint_address || mintAddress || ''} height={chartHeight} />
    </div>
  );

  const TokenDetailsSection = () => (
    <div className="border border-border/40 rounded-lg bg-[hsl(var(--card))] p-4 md:p-3 lg:p-2.5 space-y-2 md:space-y-1.5">
      <h3 className="text-[10px] md:text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1">
        <Activity className="h-3 w-3" /> Token Details
      </h3>
      <div className="space-y-0">
        {[
          { label: 'Price', value: codexPrice && codexPrice > 0 ? formatPriceUsd(codexPrice) : `${(token.price_sol || 0).toFixed(8)} SOL` },
          { label: 'Market Cap', value: codexMcap && codexMcap > 0 ? `$${codexMcap >= 1000 ? `${(codexMcap / 1000).toFixed(1)}K` : codexMcap.toFixed(0)}` : formatUsd(token.market_cap_sol || 0) },
          { label: 'Volume 24h', value: codexEnrichment?.volume24hUsd && codexEnrichment.volume24hUsd > 0 ? `$${codexEnrichment.volume24hUsd.toFixed(0)}` : `${formatSolAmount(token.volume_24h_sol || 0)} SOL` },
          { label: 'Holders', value: (codexHolders ?? token.holder_count ?? 0).toLocaleString() },
          { label: 'Supply', value: formatTokenAmount(TOTAL_SUPPLY) },
        ].map((row, i) => (
          <div key={i} className="flex justify-between text-xs md:text-[11px] lg:text-[10px] font-mono py-2 md:py-1.5 lg:py-1 border-b border-border/10 last:border-0">
            <span className="text-muted-foreground/70">{row.label}</span>
            <span className="text-foreground/85 font-medium">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const ContractSection = () => {
    if (!token.mint_address) return null;
    return (
      <div className="border border-border/40 rounded-lg bg-[hsl(var(--card))] p-4 md:p-3 lg:p-2.5 space-y-1.5">
        <h3 className="text-[10px] md:text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">Contract</h3>
        <div className="flex items-center gap-2">
          <code className="text-xs md:text-[10px] lg:text-[9px] font-mono text-foreground/70 truncate flex-1">
            {token.mint_address.slice(0, 10)}...{token.mint_address.slice(-4)}
          </code>
          <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-2 md:p-1 min-h-[44px] md:min-h-[36px] flex items-center justify-center">
            <Copy className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>
        </div>
        {token.dbc_pool_address && (
          <div>
            <span className="text-[9px] md:text-[8px] font-mono text-muted-foreground/60 uppercase">Pool</span>
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
      <div className="border border-border/40 rounded-lg bg-[hsl(var(--card))] p-4 md:p-3 lg:p-2.5">
        <p className={`text-xs md:text-[11px] lg:text-[10px] text-muted-foreground/80 font-mono leading-relaxed ${!showFullDesc ? 'line-clamp-2' : ''}`}>
          {token.description}
        </p>
        {token.description.length > 100 && (
          <button
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="text-xs md:text-[10px] font-mono text-accent-foreground hover:underline mt-1 flex items-center gap-0.5 min-h-[44px] md:min-h-[36px]"
          >
            {showFullDesc ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> More</>}
          </button>
        )}
      </div>
    );
  };

  const CommentsSection = () => (
    <div className="border border-border/40 rounded-lg bg-[hsl(var(--card))] p-4 md:p-3 lg:p-2.5 flex-1 min-h-0 overflow-hidden flex flex-col">
      <h3 className="text-[10px] md:text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1 mb-2">
        <MessageCircle className="h-3 w-3" /> Discussion
      </h3>
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        <TokenComments tokenId={token.id} />
      </div>
    </div>
  );

  return (
    <LaunchpadLayout>
      {/* Solid navy bg */}
      <div className="min-h-screen -m-4 p-2 md:p-3" style={{ backgroundColor: 'hsl(222 47% 7%)' }}>
        <div className="max-w-[1600px] mx-auto flex flex-col gap-1.5 pb-32 md:pb-24">

          {/* ──── TOP BAR ──── */}
          <div className="terminal-panel-flush rounded-lg overflow-hidden">
            {/* ROW 1: Logo + Name + Price + Actions */}
            <div className="flex items-center gap-2 px-3 py-2 lg:py-1.5">
              <Link to="/" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </Button>
              </Link>

              <Avatar className="h-9 w-9 md:h-8 md:w-8 rounded-lg border border-border/40 shrink-0">
                <AvatarImage src={token.image_url || undefined} className="object-cover" />
                <AvatarFallback className="rounded-lg text-[10px] font-bold bg-primary/10 text-primary font-mono">
                  {(token.ticker || '??').slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              {/* Name + Symbol + LIVE */}
              <div className="flex items-center gap-1.5 min-w-0 shrink">
                <h1 className="text-sm font-bold font-mono tracking-tight truncate max-w-[100px] sm:max-w-[140px] md:max-w-[200px] lg:max-w-none">{token.name}</h1>
                <span className="text-xs md:text-[11px] font-mono text-muted-foreground shrink-0">${token.ticker}</span>
                {isGraduated && (
                  <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 shrink-0">GRAD</span>
                )}
                {isBonding && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20 flex items-center gap-0.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />LIVE
                  </span>
                )}
              </div>

              {/* Price + 24h change — always visible, prominent on mobile */}
              <div className="flex items-center gap-1.5 ml-auto sm:ml-2 shrink-0">
                <span className="text-sm sm:text-xs font-mono font-bold text-foreground">
                  {(token.price_sol || 0).toFixed(8)}
                </span>
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground">SOL</span>
                {priceChange !== 0 && (
                  <span className={`text-xs sm:text-[11px] font-mono font-semibold flex items-center gap-0.5 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                    {isPriceUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPriceUp ? '+' : ''}{Math.abs(priceChange).toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Inline stats — lg+ only */}
              <div className="hidden lg:flex items-center gap-3 ml-2 min-w-0">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">{s.label}</span>
                    <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'terminal-stat-teal' : 'text-foreground/90'}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Actions — compact on mobile */}
              <div className="flex items-center gap-0.5 shrink-0 ml-1 sm:ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-8 sm:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground" onClick={handleRefresh}><RefreshCw className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-8 sm:w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground" onClick={copyAddress}><Copy className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground" onClick={shareToken}><Share2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button>
                <div className="hidden md:flex items-center gap-0.5">
                  {token.website_url && <a href={token.website_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><Globe className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.twitter_url && <a href={token.twitter_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><Twitter className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.telegram_url && <a href={token.telegram_url} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><MessageCircle className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                  {token.mint_address && <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 lg:h-7 lg:w-7 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5 lg:h-3 lg:w-3" /></Button></a>}
                </div>
                <a href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-8 lg:h-7 px-2 text-[9px] font-mono gap-0.5 bg-accent/15 hover:bg-accent/25 text-accent-foreground rounded">
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    <span className="hidden sm:inline">Axiom</span>
                  </Button>
                </a>
                {(token as any).launchpad_type === 'bags' && token.mint_address && (
                  <a href={`https://bags.fm/coin/${token.mint_address}`} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex">
                    <Button size="sm" className="h-8 lg:h-7 px-2 text-[9px] font-mono gap-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded">
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
            <div className="hidden sm:flex lg:hidden items-center gap-3 px-3 py-1.5 overflow-x-auto scrollbar-none border-t border-border/10">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">{s.label}</span>
                  <span className={`text-[11px] font-mono font-semibold ${s.accent ? 'terminal-stat-teal' : 'text-foreground/90'}`}>{s.value}</span>
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
              <span className="text-[8px] font-mono px-1.5 py-px rounded bg-accent/10 text-accent-foreground border border-accent/20 flex items-center gap-0.5 shrink-0">
                <Shield className="h-2.5 w-2.5" /> NON-CUSTODIAL
              </span>
            </div>

            {/* Creator — lg+ (in row 1 area, but only shown on desktop) */}
            {/* Already included in inline stats row above for lg+ */}
          </div>

          {/* ──── PHONE ONLY: Stats row ──── */}
          <div className="md:hidden grid grid-cols-3 gap-px terminal-panel-flush overflow-hidden rounded-lg" style={{ backgroundColor: 'hsl(222 30% 10%)' }}>
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="px-3 py-2.5 text-center" style={{ backgroundColor: 'hsl(222 30% 8% / 0.9)' }}>
                <p className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider">{s.label}</p>
                <p className={`text-sm font-mono font-bold mt-0.5 ${s.accent ? 'terminal-stat-teal' : 'text-foreground'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ──── PHONE ONLY: Price change ──── */}
          {priceChange !== 0 && (
            <div className="md:hidden flex items-center justify-between px-4 py-2 terminal-panel-flush rounded-lg">
              <span className="text-xs font-mono text-muted-foreground">24h Change</span>
              <span className={`text-sm font-mono font-bold flex items-center gap-1 ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                {isPriceUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isPriceUp ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}

          {/* ──── BONDING PROGRESS ──── */}
          {isBonding && (
            <div className="terminal-panel-flush flex items-center gap-3 px-4 py-3 md:py-2.5 lg:py-2 rounded-lg">
              <Zap className="h-4 w-4 md:h-3.5 md:w-3.5 lg:h-3 lg:w-3 terminal-stat-orange shrink-0" />
              <span className="text-[10px] md:text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Bonding</span>
              {/* Progress bar */}
              <div className="flex-1 min-w-[80px]">
                <div className="w-full rounded-full overflow-hidden bg-white/10" style={{ height: '10px' }}>
                  <div
                    className="rounded-full bg-cyan-400"
                    style={{
                      height: '10px',
                      width: `${Math.max(Math.min(bondingProgress, 100), 1)}%`,
                      boxShadow: '0 0 12px rgba(34,211,238,0.5)',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
              <span className="text-xs md:text-[11px] lg:text-[10px] font-mono font-bold terminal-stat-orange shrink-0 hidden md:inline">{bondingProgress.toFixed(1)}%</span>
              <span className="text-xs md:text-[10px] lg:text-[9px] font-mono text-muted-foreground shrink-0">{realSolReserves.toFixed(1)}/{GRADUATION_THRESHOLD} SOL</span>
              {livePoolState && (
                <span className="flex items-center gap-1 text-[10px] md:text-[9px] lg:text-[8px] font-mono text-red-400 shrink-0">
                  <span className="h-2 w-2 md:h-1.5 md:w-1.5 lg:h-1 lg:w-1 rounded-full bg-red-400 animate-pulse" />LIVE
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
                <div className={`grid gap-px terminal-panel-flush rounded-lg overflow-hidden ${isPunchToken ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setMobileTab(tab as any)}
                      className={`py-3 text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 min-h-[48px] ${
                        mobileTab === tab
                          ? 'bg-primary/10 text-primary font-bold border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground bg-card/20 active:bg-card/40'
                      }`}
                    >
                      {tab === 'trade' && <Activity className="h-4 w-4" />}
                      {tab === 'chart' && <BarChart3 className="h-4 w-4" />}
                      {tab === 'comments' && <MessageCircle className="h-4 w-4" />}
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
                <TradeSection />
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
                <div className="terminal-panel-flush rounded-lg px-4 py-3 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">Trading coming soon for Punch tokens</span>
                </div>
              )}
              <TokenDetailsSection />
              <ContractSection />
              <DescriptionSection />
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
          <div className="hidden lg:grid grid-cols-12 gap-1.5 flex-1">
            {/* Left: Chart + DataTabs */}
            <div className="col-span-9 flex flex-col gap-1.5">
              <ChartSection chartHeight={380} />
              <TokenDataTabs tokenAddress={token.mint_address || mintAddress || ''} holderCount={codexHolders ?? token.holder_count ?? 0} userWallet={solanaAddress || undefined} userWallets={allWalletAddresses} currentPriceUsd={codexPrice || 0} />
            </div>
            {/* Right: Trade + Info + Comments + Wallet */}
            <div className="col-span-3 flex flex-col gap-1.5">
              {isPunchToken ? (
                <div className="terminal-panel-flush rounded-lg px-4 py-3 flex items-center gap-2">
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
              {(token as any).fee_mode === 'holder_rewards' && (
                <div className="terminal-panel-flush rounded-lg p-2.5 space-y-1.5">
                  <h3 className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5 text-green-400" /> Holder Rewards
                    <span className="text-[7px] px-1 py-px rounded bg-green-500/15 text-green-400 border border-green-500/20">ON</span>
                  </h3>
                  <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground/80">
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Top 50 holders share 50% fees</p>
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Proportional to balance</p>
                    <p className="flex items-center gap-1"><span className="text-green-400">✓</span> Auto SOL payouts every 5 min</p>
                  </div>
                </div>
              )}
              <CommentsSection />
            </div>
          </div>

        </div>
      </div>

      {/* ──── PHONE ONLY: Bottom-fixed quick action bar ──── */}
      {!isPunchToken && (
        <div className="md:hidden fixed left-0 right-0 z-50" style={{ bottom: '40px', backgroundColor: 'hsl(222 30% 7% / 0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid hsl(222 20% 16%)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground truncate">
                {(token.price_sol || 0).toFixed(6)} SOL
              </span>
              {priceChange !== 0 && (
                <span className={`text-[10px] font-mono font-bold ${isPriceUp ? 'text-green-400' : 'text-destructive'}`}>
                  {isPriceUp ? '+' : ''}{priceChange.toFixed(1)}%
                </span>
              )}
            </div>
            <button
              onClick={() => setMobileTab('trade')}
              className="font-mono text-xs font-bold px-5 py-2.5 rounded-lg min-h-[44px] transition-all active:scale-95 bg-primary text-primary-foreground"
            >
              BUY
            </button>
            <button
              onClick={() => setMobileTab('trade')}
              className="font-mono text-xs font-bold px-5 py-2.5 rounded-lg min-h-[44px] transition-all active:scale-95"
              style={{ background: 'hsl(222 20% 16%)', color: 'hsl(0 72% 60%)', border: '1px solid hsl(0 72% 40% / 0.3)' }}
            >
              SELL
            </button>
          </div>
        </div>
      )}
    </LaunchpadLayout>
  );
}
