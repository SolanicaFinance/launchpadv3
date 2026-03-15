import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChain } from "@/contexts/ChainContext";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useLaunchpad, formatSolAmount, formatTokenAmount, Token } from "@/hooks/useLaunchpad";
import { useWalletHoldings, TokenHolding as OnChainHolding } from "@/hooks/useWalletHoldings";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { useReferralCode, useReferralDashboard } from "@/hooks/useReferral";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useExportWallet } from "@privy-io/react-auth/solana";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { BRAND } from "@/config/branding";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import QRCode from "react-qr-code";
import {
  Wallet, Briefcase, DollarSign, Rocket, Users, TrendingUp, Coins,
  ArrowRight, Plus, Copy, Check, CheckCircle, Loader2, Gift, ExternalLink,
  ArrowUpRight, ArrowDownLeft, Repeat, Key, ChevronDown, ChevronUp,
  Twitter, Sparkles, BarChart3, Download, Shield, Zap, Target,
  Settings, User, ArrowDownToLine
} from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Area, AreaChart, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { copyToClipboard } from "@/lib/clipboard";

// ─── Lazy modal imports ───
const SendTokenModal = lazy(() => import("@/components/wallet/SendTokenModal"));
const SwapModal = lazy(() => import("@/components/wallet/SwapModal"));
const ReceiveDialog = lazy(() => import("@/components/wallet/ReceiveDialog"));
import { SettingsModal } from "@/components/settings/SettingsModal";
import { AccountSecurityModal } from "@/components/settings/AccountSecurityModal";
import { DepositDialog } from "@/components/wallet/DepositDialog";
import TokenHoldingsList from "@/components/wallet/TokenHoldingsList";
import WalletTransactionHistory from "@/components/wallet/WalletTransactionHistory";

// ─── Mock sparkline data ───
const generateSparkline = (base: number, points = 24) =>
  Array.from({ length: points }, (_, i) => ({
    x: i,
    y: base + (Math.random() - 0.5) * base * 0.3,
  }));

const NEON_LIME = "#84cc16";
const NEON_LIME_GLOW = "#facc15";
const EMERALD = "#22c55e";
const RED = "#ef4444";
const CYAN = "#22d3ee";

interface HoldingWithToken {
  id: string;
  token_id: string;
  wallet_address: string;
  balance: number;
  tokens: {
    id: string;
    mint_address: string;
    name: string;
    ticker: string;
    image_url: string | null;
    price_sol: number;
    status: string;
  } | null;
}

// ─── SECTION HEADER ───
function SectionHeader({
  icon,
  title,
  badge,
  isOpen,
  onToggle,
  accentColor = NEON_LIME,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string | number;
  isOpen: boolean;
  onToggle: () => void;
  accentColor?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-3 px-1 group md:cursor-default"
    >
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
        style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25` }}
      >
        {icon}
      </div>
      <h2 className="text-sm font-black font-mono uppercase tracking-wider text-foreground flex-1 text-left">
        {title}
      </h2>
      {badge !== undefined && (
        <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground">
          {badge}
        </Badge>
      )}
      <div className="md:hidden text-muted-foreground transition-transform">
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>
    </button>
  );
}

// ─── GLASS CARD ───
function GlassCard({ children, className = "", neonBorder = false }: { children: React.ReactNode; className?: string; neonBorder?: boolean }) {
  return (
    <div
      className={`rounded-2xl backdrop-blur-xl transition-all duration-300 ${className}`}
      style={{
        background: "rgba(0, 8, 20, 0.6)",
        border: neonBorder
          ? `1px solid ${NEON_LIME}30`
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: neonBorder
          ? `0 0 30px ${NEON_LIME}08, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

// ─── MINI SPARKLINE ───
function MiniSparkline({ data, color, width = 60, height = 24 }: { data: { x: number; y: number }[]; color: string; width?: number; height?: number }) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} fill={`url(#spark-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── STAT PILL ───
function StatPill({ label, value, sub, color = NEON_LIME, sparkData, tooltip }: {
  label: string; value: string; sub?: string; color?: string;
  sparkData?: { x: number; y: number }[]; tooltip?: string;
}) {
  return (
    <div
      className="relative p-4 rounded-xl group cursor-default"
      style={{
        background: `linear-gradient(135deg, ${color}06, ${color}03)`,
        border: `1px solid ${color}15`,
      }}
      title={tooltip}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-lg md:text-xl font-black font-mono tracking-tight" style={{ color }}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {sparkData && <MiniSparkline data={sparkData} color={color} />}
      </div>
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 20px ${color}08` }}
      />
    </div>
  );
}

// ─── CSV EXPORT ───
function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── MAIN COMPONENT ───
export default function PanelUnifiedDashboard() {
  const { solanaAddress, profileId, user } = useAuth();
  const { chain, chainConfig } = useChain();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { walletAddress: solWalletAddress, isWalletReady, getBalance } = useSolanaWalletWithPrivy();
  const { useUserTokens, useUserEarnings, claimFees } = useLaunchpad();
  const { referralCode, referralLink, referralCount } = useReferralCode();
  const { stats: refStats, recentReferrals, recentRewards } = useReferralDashboard();
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const queryClient = useQueryClient();

  const isBnb = chain === 'bnb';
  const isSolana = chain === 'solana';
  const activeAddress = isBnb ? evmAddress : (solWalletAddress || solanaAddress);
  const walletAddr = isSolana ? solWalletAddress : evmAddress;
  const currencySymbol = chainConfig.nativeCurrency.symbol;
  const explorerUrl = chainConfig.explorerUrl;

  // ─── Data fetching ───
  // On-chain wallet holdings (real balances from RPC)
  const { data: onChainHoldings = [], isLoading: loadingOnChainHoldings } = useWalletHoldings(walletAddr);
  
  // Get metadata for held tokens from edge function
  const heldMints = useMemo(() => onChainHoldings.map(h => h.mint).filter(Boolean), [onChainHoldings]);
  const { data: tokenMetaMap = {} } = useTokenMetadata(heldMints);
  
  // Also fetch price data from fun_tokens for held mints
  const { data: funTokenPriceMap } = useQuery({
    queryKey: ['portfolio-fun-token-prices', heldMints.sort().join(',')],
    queryFn: async () => {
      if (heldMints.length === 0) return new Map<string, { name: string; ticker: string; image_url: string | null; price_sol: number; market_cap_sol: number }>();
      
      // Query both tables for price data
      const [tokensResult, funTokensResult] = await Promise.all([
        supabase.from('tokens').select('mint_address, name, ticker, image_url, price_sol, market_cap_sol').in('mint_address', heldMints),
        supabase.from('fun_tokens').select('mint_address, name, ticker, image_url, price_sol, market_cap_sol').in('mint_address', heldMints),
      ]);
      
      const map = new Map<string, { name: string; ticker: string; image_url: string | null; price_sol: number; market_cap_sol: number }>();
      for (const t of (tokensResult.data || [])) {
        if (t.mint_address) map.set(t.mint_address, t as any);
      }
      for (const t of (funTokensResult.data || [])) {
        if (t.mint_address && !map.has(t.mint_address)) map.set(t.mint_address, t as any);
      }
      return map;
    },
    enabled: heldMints.length > 0,
    staleTime: 30_000,
  });
  
  // Build unified holdings with metadata + prices for portfolio display
  const holdings = useMemo(() => {
    return onChainHoldings
      .map(h => {
        const meta = tokenMetaMap[h.mint];
        const dbInfo = funTokenPriceMap?.get(h.mint);
        const decimals = h.decimals || meta?.decimals || 6;
        const uiBalance = h.balance / Math.pow(10, decimals);
        
        return {
          id: h.mint,
          token_id: h.mint,
          wallet_address: walletAddr || '',
          balance: uiBalance,
          tokens: {
            id: h.mint,
            mint_address: h.mint,
            name: dbInfo?.name || meta?.name || h.mint.slice(0, 6),
            ticker: dbInfo?.ticker || meta?.symbol || h.mint.slice(0, 4).toUpperCase(),
            image_url: dbInfo?.image_url || meta?.image || null,
            price_sol: dbInfo?.price_sol || 0,
            status: 'active',
          },
        } as HoldingWithToken;
      })
      .filter(h => h.balance > 0);
  }, [onChainHoldings, tokenMetaMap, funTokenPriceMap, walletAddr]);
  
  const loadingHoldings = loadingOnChainHoldings;
  
  const { data: createdTokens = [], isLoading: loadingCreated } = useUserTokens(activeAddress);
  const { data: earningsData, isLoading: loadingEarnings, refetch: refetchEarnings } = useUserEarnings(activeAddress, profileId);

  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [claimingTokenId, setClaimingTokenId] = useState<string | null>(null);

  // Section open states (always open on desktop)
  const [portfolioOpen, setPortfolioOpen] = useState(true);
  const [earningsOpen, setEarningsOpen] = useState(true);
  const [launchesOpen, setLaunchesOpen] = useState(true);
  const [walletOpen, setWalletOpen] = useState(true);
  const [referralsOpen, setReferralsOpen] = useState(true);

  // Modals
  const [sendOpen, setSendOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSecurityOpen, setAccountSecurityOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [hasSeenDepositPrompt, setHasSeenDepositPrompt] = useState(false);
  const [launchPage, setLaunchPage] = useState(1);
  const [portfolioPage, setPortfolioPage] = useState(1);
  const PORTFOLIO_PER_PAGE = 5;

  // Profile for settings modal
  const [profile, setProfile] = useState<{ display_name?: string | null; avatar_url?: string | null; username?: string | null } | null>(null);
  useEffect(() => {
    if (!activeAddress) return;
    const fetchProfile = async () => {
      const col = isBnb ? "evm_wallet_address" : "solana_wallet_address";
      const { data } = await supabase.from("profiles").select("display_name, avatar_url, username").eq(col, activeAddress).maybeSingle();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [activeAddress, isBnb, settingsOpen]);

  // Export wallet
  let exportWalletFn: any = null;
  try {
    const { exportWallet } = useExportWallet();
    exportWalletFn = exportWallet;
  } catch { /* not available */ }

  // Balance fetch
  useEffect(() => {
    if (!walletAddr) return;
    let cancelled = false;
    const fetchBal = async () => {
      try {
        if (isSolana) {
          if (!isWalletReady) return;
          const bal = await getBalance();
          if (!cancelled) setBalance(bal);
        } else if (isBnb && evmAddress) {
          const { fetchBnbBalance } = await import("@/lib/bscRpc");
          const bal = await fetchBnbBalance(evmAddress);
          if (!cancelled) setBalance(bal);
        }
      } catch { /* ignore */ }
    };
    fetchBal();
    const interval = setInterval(fetchBal, 5_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isWalletReady, walletAddr, isSolana, isBnb, evmAddress, getBalance]);

  // Auto-open deposit dialog when balance is 0 on first panel load
  useEffect(() => {
    if (balance === null || balance > 0) return;
    if (hasSeenDepositPrompt) return;
    const timer = setTimeout(() => {
      setDepositOpen(true);
      setHasSeenDepositPrompt(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [balance, hasSeenDepositPrompt]);

  // Portfolio stats
  const portfolioStats = useMemo(() => {
    const typedHoldings = holdings as HoldingWithToken[];
    const totalValue = typedHoldings.reduce((sum, h) => {
      if (!h.tokens) return sum;
      return sum + (h.balance * h.tokens.price_sol);
    }, 0);
    const totalTokens = typedHoldings.length;
    const unclaimedEarnings = earningsData?.earnings?.reduce(
      (sum: number, e: { unclaimed_sol: number }) => sum + (e.unclaimed_sol || 0), 0
    ) || 0;
    return { totalValue, totalTokens, unclaimedEarnings };
  }, [holdings, earningsData]);

  // Mock sparkline data (deterministic per stat)
  const valueSparkline = useMemo(() => generateSparkline(portfolioStats.totalValue || 0.001), [portfolioStats.totalValue]);
  const earningsSparkline = useMemo(() => generateSparkline(earningsData?.summary?.totalEarned || 0.001), [earningsData]);

  const handleCopy = async () => {
    if (!activeAddress) return;
    const ok = await copyToClipboard(activeAddress);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleRefCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setRefCopied(true);
    toast({ title: "Copied!", description: "Referral link copied" });
    setTimeout(() => setRefCopied(false), 2000);
  };

  const handleClaim = async (tokenId: string) => {
    if (!activeAddress) return;
    setClaimingTokenId(tokenId);
    try {
      const result = await claimFees.mutateAsync({
        tokenId, walletAddress: activeAddress, profileId: profileId || undefined,
      });
      toast({ title: "Fees claimed!", description: `${formatSolAmount(result.claimedAmount)} ${currencySymbol}` });
      refetchEarnings();
    } catch (error) {
      toast({ title: "Claim failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setClaimingTokenId(null);
    }
  };

  // Pie chart data for portfolio — only tokens with value
  const pieData = useMemo(() => {
    const typedHoldings = holdings as HoldingWithToken[];
    const items = typedHoldings
      .filter(h => h.tokens && h.balance * h.tokens.price_sol > 0.0001)
      .map(h => ({
        name: h.tokens!.ticker,
        value: h.balance * h.tokens!.price_sol,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return items;
  }, [holdings]);

  // Filter holdings for display — hide dust (< 0.0001 SOL value)
  const displayHoldings = useMemo(() => {
    return (holdings as HoldingWithToken[])
      .filter(h => h.tokens && h.balance * h.tokens.price_sol >= 0.0001)
      .sort((a, b) => (b.balance * (b.tokens?.price_sol || 0)) - (a.balance * (a.tokens?.price_sol || 0)));
  }, [holdings]);

  const portfolioTotalPages = Math.max(1, Math.ceil(displayHoldings.length / PORTFOLIO_PER_PAGE));
  const paginatedHoldings = displayHoldings.slice((portfolioPage - 1) * PORTFOLIO_PER_PAGE, portfolioPage * PORTFOLIO_PER_PAGE);
  const dustCount = (holdings as HoldingWithToken[]).length - displayHoldings.length;

  const PIE_COLORS = [NEON_LIME, EMERALD, CYAN, NEON_LIME_GLOW, "#a78bfa", "#f97316"];

  const MIN_CLAIM_SOL = 0.05;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ═══════════════════════════════════════════ */}
      {/* HERO SUMMARY CARD */}
      {/* ═══════════════════════════════════════════ */}
      <GlassCard neonBorder className="p-5 md:p-6 relative overflow-hidden">
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${NEON_LIME}08, transparent 60%)`,
          }}
        />

        {/* Balance + Address */}
        <div className="relative z-10 text-center mb-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">Total Balance</p>
          <h2 className="text-3xl md:text-4xl font-black font-mono tracking-tight" style={{ color: NEON_LIME }}>
            {balance !== null ? balance.toFixed(4) : "0.0000"}
            <span className="text-base text-muted-foreground ml-2">{currencySymbol}</span>
          </h2>
          {activeAddress && (
            <button
              onClick={handleCopy}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[11px] font-mono text-muted-foreground hover:text-foreground"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: EMERALD }} />
              {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
              {copied ? <Check className="h-3 w-3" style={{ color: NEON_LIME }} /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="relative z-10 grid grid-cols-3 gap-2 md:gap-3">
          <StatPill
            label="Portfolio Value"
            value={`${formatSolAmount(portfolioStats.totalValue)} ${currencySymbol}`}
            tooltip="Sum of all token holdings at current price"
            sparkData={valueSparkline}
            color={NEON_LIME}
          />
          <StatPill
            label="Holdings"
            value={String(portfolioStats.totalTokens)}
            sub="tokens"
            color={CYAN}
          />
          <StatPill
            label="Unclaimed"
            value={`${formatSolAmount(portfolioStats.unclaimedEarnings)} ${currencySymbol}`}
            tooltip="Unclaimed creator fees from your tokens"
            sparkData={earningsSparkline}
            color={EMERALD}
          />
        </div>

        {/* Quick Actions Row */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Settings className="h-3 w-3" /> Settings
          </button>
          <button
            onClick={() => setAccountSecurityOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <User className="h-3 w-3" /> Account & Security
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setDepositOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-mono font-black uppercase tracking-wider transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${NEON_LIME}, ${EMERALD})`,
              color: "#000",
              boxShadow: `0 0 20px ${NEON_LIME}30, 0 0 6px ${NEON_LIME}20`,
            }}
          >
            <ArrowDownToLine className="h-4 w-4" /> Deposit
          </button>
        </div>

      </GlassCard>

      {/* ═══════════════════════════════════════════ */}
      {/* PORTFOLIO SECTION */}
      {/* ═══════════════════════════════════════════ */}
      <GlassCard className="overflow-hidden">
        <Collapsible open={portfolioOpen} onOpenChange={setPortfolioOpen}>
          <div className="px-4 pt-2 border-b border-white/5">
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader
                  icon={<Briefcase className="h-4 w-4" style={{ color: NEON_LIME }} />}
                  title="Portfolio"
                  badge={portfolioStats.totalTokens}
                  isOpen={portfolioOpen}
                  onToggle={() => setPortfolioOpen(!portfolioOpen)}
                />
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4 space-y-4">
              {/* Pie chart + holdings side by side on desktop */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Pie chart */}
                {pieData.length > 0 && (
                  <div className="w-full md:w-48 flex flex-col items-center justify-center shrink-0">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {pieData.map((d, i) => (
                        <span key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Holdings list */}
                <div className="flex-1 min-w-0">
                  {loadingHoldings ? (
                    <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
                  ) : (holdings as HoldingWithToken[]).length === 0 ? (
                    <div className="text-center py-10">
                      <div
                        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: `${NEON_LIME}10`, border: `1px solid ${NEON_LIME}20` }}
                      >
                        <Coins className="h-6 w-6" style={{ color: NEON_LIME, opacity: 0.5 }} />
                      </div>
                      <p className="text-sm font-medium text-foreground/80 mb-1">Start building your portfolio</p>
                      <p className="text-xs text-muted-foreground mb-4">Discover and trade tokens to grow your holdings</p>
                      <Link to="/">
                        <Button
                          className="gap-2 font-mono text-xs uppercase tracking-wider"
                          style={{ background: `linear-gradient(135deg, ${NEON_LIME}, ${EMERALD})`, color: "#000" }}
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Explore Tokens
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {paginatedHoldings.map((holding) => {
                          if (!holding.tokens) return null;
                          const value = holding.balance * holding.tokens.price_sol;
                          return (
                            <div
                              key={holding.id}
                              className="p-3 flex items-center gap-3 rounded-xl transition-all duration-200 group"
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              <Link to={`/trade/${holding.tokens.mint_address}`} className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-9 w-9 rounded-lg ring-1 ring-white/10">
                                  <AvatarImage src={holding.tokens.image_url || undefined} />
                                  <AvatarFallback className="rounded-lg text-[10px] font-bold bg-white/5">
                                    {holding.tokens.ticker.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm truncate">{holding.tokens.name}</span>
                                    <span className="text-[10px] font-mono text-muted-foreground">${holding.tokens.ticker}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground font-mono">{formatTokenAmount(holding.balance)}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold font-mono" style={{ color: NEON_LIME }}>
                                    {value >= 0.001 ? formatSolAmount(value) : "<0.001"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{currencySymbol}</p>
                                </div>
                              </Link>
                              <Link
                                to={`/trade/${holding.tokens.mint_address}`}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 px-2 py-1 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider transition-all
                                           bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:border-destructive/40"
                              >
                                Sell
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                      {/* Pagination */}
                      {portfolioTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={portfolioPage <= 1}
                            onClick={() => setPortfolioPage(p => Math.max(1, p - 1))}
                            className="text-[10px] font-mono"
                          >
                            ← Prev
                          </Button>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {portfolioPage}/{portfolioTotalPages}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={portfolioPage >= portfolioTotalPages}
                            onClick={() => setPortfolioPage(p => Math.min(portfolioTotalPages, p + 1))}
                            className="text-[10px] font-mono"
                          >
                            Next →
                          </Button>
                        </div>
                      )}
                      {dustCount > 0 && (
                        <p className="text-[10px] text-muted-foreground/50 mt-2 text-center font-mono">
                          {dustCount} dust token{dustCount > 1 ? 's' : ''} hidden (&lt;0.0001 SOL)
                        </p>
                      )}
                      {/* Export button */}
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const data = displayHoldings
                              .filter(h => h.tokens)
                              .map(h => ({
                                Token: h.tokens!.name,
                                Ticker: h.tokens!.ticker,
                                Balance: h.balance,
                                Value_SOL: (h.balance * h.tokens!.price_sol).toFixed(6),
                              }));
                            exportToCSV(data, "saturn-portfolio.csv");
                            toast({ title: "Exported", description: "Portfolio CSV downloaded" });
                          }}
                        >
                          <Download className="h-3 w-3" />
                          Export CSV
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>

      {/* ═══════════════════════════════════════════ */}
      {/* EARNINGS SECTION */}
      {/* ═══════════════════════════════════════════ */}
      <GlassCard className="overflow-hidden">
        <Collapsible open={earningsOpen} onOpenChange={setEarningsOpen}>
          <div className="px-4 pt-2 border-b border-white/5">
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader
                  icon={<DollarSign className="h-4 w-4" style={{ color: EMERALD }} />}
                  title="Earnings"
                  badge={earningsData?.earnings?.length || 0}
                  isOpen={earningsOpen}
                  onToggle={() => setEarningsOpen(!earningsOpen)}
                  accentColor={EMERALD}
                />
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4 space-y-4">
              {/* Earnings summary row */}
              <div className="grid grid-cols-2 gap-2">
                <StatPill
                  label="Total Earned"
                  value={`${formatSolAmount(earningsData?.summary?.totalEarned || 0)} ${currencySymbol}`}
                  color={EMERALD}
                />
                <StatPill
                  label="Unclaimed"
                  value={`${formatSolAmount(earningsData?.summary?.totalUnclaimed || 0)} ${currencySymbol}`}
                  color={NEON_LIME_GLOW}
                />
              </div>


              {/* Recent claims */}
              {earningsData?.claims?.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Recent Claims</h3>
                  <div className="space-y-1.5">
                    {earningsData.claims.slice(0, 5).map((claim: any) => (
                      <div
                        key={claim.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl text-xs"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: EMERALD }} />
                        <span className="font-mono font-bold" style={{ color: EMERALD }}>{formatSolAmount(claim.amount_sol)} {currencySymbol}</span>
                        <span className="text-muted-foreground text-[10px] flex-1">{new Date(claim.created_at).toLocaleDateString()}</span>
                        <a href={`${explorerUrl}/tx/${claim.signature}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[10px]">View</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>

      {/* ═══════════════════════════════════════════ */}
      {/* LAUNCHES SECTION */}
      {/* ═══════════════════════════════════════════ */}
      <GlassCard className="overflow-hidden">
        <Collapsible open={launchesOpen} onOpenChange={setLaunchesOpen}>
          <div className="px-4 pt-2 border-b border-white/5">
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader
                  icon={<Rocket className="h-4 w-4" style={{ color: NEON_LIME_GLOW }} />}
                  title="Launches"
                  badge={createdTokens.length}
                  isOpen={launchesOpen}
                  onToggle={() => setLaunchesOpen(!launchesOpen)}
                  accentColor={NEON_LIME_GLOW}
                />
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4 space-y-4">
              {(() => {
                const LAUNCH_PAGE_SIZE = 6;
                const totalPages = Math.ceil(createdTokens.length / LAUNCH_PAGE_SIZE);
                const paginatedTokens = createdTokens.slice((launchPage - 1) * LAUNCH_PAGE_SIZE, launchPage * LAUNCH_PAGE_SIZE);
                const earningsMap = new Map((earningsData?.earnings || []).map((e: any) => [e.token_id, e]));

                if (loadingCreated) return (
                  <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
                );
                if (createdTokens.length === 0) return (
                  <div
                    className="rounded-xl p-8 text-center"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                      style={{ background: `${NEON_LIME_GLOW}10`, border: `1px solid ${NEON_LIME_GLOW}20` }}
                    >
                      <Rocket className="h-6 w-6" style={{ color: NEON_LIME_GLOW, opacity: 0.5 }} />
                    </div>
                    <p className="text-sm font-medium text-foreground/80 mb-1">You haven't created any tokens yet</p>
                    <p className="text-xs text-muted-foreground mb-4">Create and launch your own token in minutes</p>
                    <Link to="/">
                      <Button
                        className="gap-2 font-mono text-xs uppercase tracking-wider"
                        style={{ background: `linear-gradient(135deg, ${NEON_LIME_GLOW}, #ea580c)`, color: "#000" }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Launch Your First Token
                      </Button>
                    </Link>
                  </div>
                );
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {paginatedTokens.map((token: Token) => {
                        const earning = earningsMap.get(token.id) as any;
                        const unclaimed = earning?.unclaimed_sol || 0;
                        return (
                          <div
                            key={token.id}
                            className="p-3 rounded-xl transition-all duration-200"
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <Link to={`/trade/${token.mint_address}`} className="block group">
                              <div className="flex items-center gap-3 mb-2">
                                <Avatar className="h-9 w-9 rounded-lg ring-1 ring-white/10">
                                  <AvatarImage src={token.image_url || undefined} />
                                  <AvatarFallback className="rounded-lg text-[10px] font-bold bg-white/5">
                                    {token.ticker.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{token.name}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground">${token.ticker}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] capitalize shrink-0"
                                  style={{
                                    borderColor: token.status === 'graduated' ? `${EMERALD}40` : `${NEON_LIME}40`,
                                    color: token.status === 'graduated' ? EMERALD : NEON_LIME,
                                  }}
                                >
                                  {token.status || "active"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">MCAP</span>
                                <span className="font-mono font-bold" style={{ color: NEON_LIME }}>
                                  {solPrice && token.market_cap_sol
                                    ? (() => {
                                        const usd = token.market_cap_sol * solPrice;
                                        if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
                                        if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
                                        return `$${usd.toFixed(0)}`;
                                      })()
                                    : `${formatSolAmount(token.market_cap_sol)} ${currencySymbol}`}
                                </span>
                              </div>
                            </Link>
                            {unclaimed > 0 && (
                              <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="text-[10px] text-muted-foreground">Claimable: <span className="font-mono" style={{ color: NEON_LIME_GLOW }}>{formatSolAmount(unclaimed)} {currencySymbol}</span></span>
                                <Button
                                  size="sm"
                                  className="h-6 text-[10px] font-mono uppercase px-3"
                                  style={{
                                    background: unclaimed >= MIN_CLAIM_SOL
                                      ? `linear-gradient(135deg, ${NEON_LIME}, ${EMERALD})`
                                      : undefined,
                                    color: unclaimed >= MIN_CLAIM_SOL ? "#000" : undefined,
                                  }}
                                  variant={unclaimed >= MIN_CLAIM_SOL ? "default" : "outline"}
                                  disabled={unclaimed < MIN_CLAIM_SOL || claimingTokenId === token.id}
                                  onClick={(e) => { e.preventDefault(); handleClaim(token.id); }}
                                >
                                  {claimingTokenId === token.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : unclaimed < MIN_CLAIM_SOL ? "Min 0.05" : "Claim"}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] font-mono"
                          disabled={launchPage <= 1}
                          onClick={() => setLaunchPage(p => p - 1)}
                        >
                          Previous
                        </Button>
                        <span className="text-[10px] font-mono text-muted-foreground">{launchPage} / {totalPages}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] font-mono"
                          disabled={launchPage >= totalPages}
                          onClick={() => setLaunchPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>

      {/* ═══════════════════════════════════════════ */}
      {/* WALLET SECTION */}
      {/* ═══════════════════════════════════════════ */}
      <GlassCard className="overflow-hidden">
        <Collapsible open={walletOpen} onOpenChange={setWalletOpen}>
          <div className="px-4 pt-2 border-b border-white/5">
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader
                  icon={<Wallet className="h-4 w-4" style={{ color: CYAN }} />}
                  title="Wallet"
                  isOpen={walletOpen}
                  onToggle={() => setWalletOpen(!walletOpen)}
                  accentColor={CYAN}
                />
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4 space-y-4">
              {/* Quick actions */}
              <div className={`grid ${isSolana && exportWalletFn ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                {[
                  { icon: <ArrowUpRight className="h-4 w-4" />, label: "Send", onClick: () => setSendOpen(true) },
                  { icon: <ArrowDownLeft className="h-4 w-4" />, label: "Receive", onClick: () => setReceiveOpen(true) },
                  { icon: <Repeat className="h-4 w-4" />, label: "Swap", onClick: () => setSwapOpen(true) },
                  ...(isSolana && exportWalletFn
                    ? [{ icon: <Key className="h-4 w-4" />, label: "Export", onClick: async () => { try { await exportWalletFn({ address: solWalletAddress || undefined }); } catch {} } }]
                    : []),
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200 hover:scale-105 group"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid rgba(255,255,255,0.06)`,
                    }}
                  >
                    <span style={{ color: CYAN }} className="group-hover:scale-110 transition-transform">{action.icon}</span>
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground font-mono">{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Security badge */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
                style={{ background: `${EMERALD}08`, border: `1px solid ${EMERALD}15` }}
              >
                <Shield className="h-3.5 w-3.5 shrink-0" style={{ color: EMERALD }} />
                <span className="text-muted-foreground">Embedded wallet secured by Privy • </span>
                <span style={{ color: EMERALD }} className="font-mono font-bold">High Security</span>
              </div>

              {/* Token holdings & activity */}
              <TokenHoldingsList
                walletAddress={walletAddr}
                solBalance={isSolana ? balance : null}
                onSendToken={(mint, symbol, bal, decimals) => {
                  setSendOpen(true);
                }}
              />

              <div>
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Recent Activity</h3>
                <WalletTransactionHistory walletAddress={walletAddr} pageSize={5} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>

      {/* ═══════════════════════════════════════════ */}
      {/* REFERRALS SECTION */}
      {/* ═══════════════════════════════════════════ */}
      <GlassCard className="overflow-hidden">
        <Collapsible open={referralsOpen} onOpenChange={setReferralsOpen}>
          <div className="px-4 pt-2 border-b border-white/5">
            <CollapsibleTrigger asChild>
              <div>
                <SectionHeader
                  icon={<Users className="h-4 w-4" style={{ color: "#f97316" }} />}
                  title="Referrals"
                  badge={refStats.totalReferrals}
                  isOpen={referralsOpen}
                  onToggle={() => setReferralsOpen(!referralsOpen)}
                  accentColor="#f97316"
                />
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4 space-y-4">
              {/* Referral link card */}
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-3.5 w-3.5 text-[#f97316]" />
                  <p className="text-xs font-bold">Your Referral Link</p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Earn <span className="text-[#f97316] font-bold">50%</span> of trading fees from referred users.
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 px-3 py-2 rounded-lg text-[10px] font-mono text-foreground/60 truncate"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {referralLink || "Loading..."}
                  </div>
                  <Button
                    onClick={handleRefCopy}
                    size="sm"
                    className="gap-1 rounded-lg shrink-0 h-8 text-[10px] font-mono"
                    style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff" }}
                    disabled={!referralLink}
                  >
                    {refCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {refCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatPill label="Referrals" value={String(refStats.totalReferrals)} color={CYAN} />
                <StatPill label="Total Earned" value={`${formatSolAmount(refStats.totalRewardsSol)} SOL`} color={EMERALD} />
                <StatPill label="This Month" value={`${formatSolAmount(refStats.rewardsThisMonth)} SOL`} color="#f97316" />
              </div>

              {/* Recent referrals */}
              {recentReferrals.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent Sign-ups</h3>
                  <div className="space-y-1">
                    {recentReferrals.slice(0, 5).map((ref: any) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${CYAN}15` }}>
                            <Users className="h-2.5 w-2.5" style={{ color: CYAN }} />
                          </div>
                          <span className="font-mono text-muted-foreground">
                            {ref.referred_wallet ? `${ref.referred_wallet.slice(0, 4)}...${ref.referred_wallet.slice(-4)}` : "Anonymous"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(ref.created_at), { addSuffix: true })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent rewards */}
              {recentRewards.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Recent Rewards</h3>
                  <div className="space-y-1">
                    {recentRewards.slice(0, 5).map((rw: any) => (
                      <div
                        key={rw.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${EMERALD}15` }}>
                            <DollarSign className="h-2.5 w-2.5" style={{ color: EMERALD }} />
                          </div>
                          <span className="font-mono font-bold" style={{ color: EMERALD }}>+{Number(rw.reward_sol).toFixed(4)} SOL</span>
                          <span className="text-muted-foreground">from {Number(rw.trade_sol_amount).toFixed(2)} SOL trade</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(rw.created_at), { addSuffix: true })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How it works */}
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
              >
                <h3 className="text-[10px] font-bold text-foreground mb-1.5 font-mono uppercase">How It Works</h3>
                <ol className="text-[10px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Share your unique referral link</li>
                  <li>They sign up and start trading on Saturn</li>
                  <li>You earn <span className="text-[#f97316] font-semibold">50%</span> of their trading fees</li>
                  <li>Rewards tracked in real-time</li>
                </ol>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>

      {/* Modals */}
      <Suspense fallback={null}>
        {sendOpen && (
          <SendTokenModal
            open={sendOpen}
            onOpenChange={setSendOpen}
            preselectedMint={isSolana ? "SOL" : "BNB"}
            preselectedSymbol={currencySymbol}
            preselectedBalance={balance || 0}
            preselectedDecimals={isSolana ? 9 : 18}
          />
        )}
        {swapOpen && <SwapModal open={swapOpen} onOpenChange={setSwapOpen} />}
        {receiveOpen && <ReceiveDialog open={receiveOpen} onOpenChange={setReceiveOpen} walletAddress={walletAddr || ""} />}
      </Suspense>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        onProfileUpdate={() => {}}
      />
      <AccountSecurityModal open={accountSecurityOpen} onClose={() => setAccountSecurityOpen(false)} />
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        address={walletAddr || activeAddress || ""}
        chain={isBnb ? "bnb" : "solana"}
        getBalance={isSolana ? getBalance : undefined}
        onDepositDetected={() => {
          // Immediately refresh balance
          if (isSolana && isWalletReady) {
            getBalance().then(bal => setBalance(bal)).catch(() => {});
          }
          // Invalidate holdings queries
          queryClient.invalidateQueries({ queryKey: ['user-holdings', walletAddr] });
        }}
      />

      {/* Floating mobile deposit CTA — always visible on mobile when balance is low */}
      {(balance === null || balance < 0.01) && (
        <button
          onClick={() => setDepositOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full font-mono font-bold text-xs shadow-2xl animate-bounce hover:animate-none transition-all"
          style={{
            background: `linear-gradient(135deg, ${NEON_LIME}, ${EMERALD})`,
            color: "#000",
            boxShadow: `0 0 20px ${NEON_LIME}40, 0 4px 16px rgba(0,0,0,0.4)`,
          }}
        >
          <ArrowDownToLine className="h-4 w-4" />
          Deposit to Trade
        </button>
      )}
    </div>
  );
}
