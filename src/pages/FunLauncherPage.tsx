import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { TokenCard } from "@/components/launchpad/TokenCard";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useJustLaunched } from "@/hooks/useJustLaunched";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions } from "@/hooks/useFunFeeData";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useChainRoute } from "@/hooks/useChainRoute";
import { useChain } from "@/contexts/ChainContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BaseLauncher } from "@/components/launchpad/BaseLauncher";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { PromoteModal } from "@/components/launchpad/PromoteModal";
import { CreateTokenModal } from "@/components/launchpad/CreateTokenModal";
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { Link, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  PartyPopper, XCircle, ExternalLink, Copy, CheckCircle,
  AlertCircle, Flame,
} from "lucide-react";

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  tokenId?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

// Filter tabs removed — Axiom layout uses column-based organization

export default function FunLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const { solanaAddress } = useAuth();
  const { tokens, totalCount, isLoading: tokensLoading, refetch } = useFunTokensPaginated(1, 100);
  const { tokens: justLaunchedTokens, isLoading: justLaunchedLoading } = useJustLaunched();
  
  const { chain, chainConfig, isSolana, isChainEnabled } = useChainRoute();
  const { setChain } = useChain();
  const [searchParams, setSearchParams] = useSearchParams();

  const [claimsPage, setClaimsPage] = useState(1);
  const [creatorFeesPage, setCreatorFeesPage] = useState(1);
  const pageSize = 15;

  const { data: claimsData, isLoading: claimsLoading } = useFunFeeClaims({ page: claimsPage, pageSize });
  const feeClaims = claimsData?.items ?? [];
  const claimsCount = claimsData?.count ?? 0;

  const { data: claimsSummary } = useFunFeeClaimsSummary();
  const { data: distributions = [] } = useFunDistributions();
  // removed: topPerformers, agentStats, tokenPromotions (no longer used in Axiom layout)
  const { onlineCount } = useVisitorTracking();

  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteTokenId, setPromoteTokenId] = useState<string | null>(null);
  const [promoteTokenName, setPromoteTokenName] = useState("");
  const [promoteTokenTicker, setPromoteTokenTicker] = useState("");
  // activeFilter removed — Axiom layout uses column-based organization
  const [adminWallet] = useState("");
  const { isAdmin } = useIsAdmin(adminWallet || null);

  // Create token dialog — triggered by ?create=1 URL param
  const showCreateDialog = searchParams.get("create") === "1";
  const openCreateDialog = () => setSearchParams({ create: "1" });
  const closeCreateDialog = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("create");
    setSearchParams(newParams);
  };

  const totalClaimed = claimsSummary?.totalClaimedSol ?? 0;
  const totalPayouts = useMemo(() => distributions.reduce((sum, d) => sum + Number(d.amount_sol || 0), 0), [distributions]);
  const creatorDistributions = useMemo(() => distributions.filter((d) => d.distribution_type === "creator" && d.status === "completed"), [distributions]);
  // promotedTokenIds removed — Axiom layout doesn't use promotions

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;
  const formatSOL = (amount: number) => {
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    if (amount >= 1) return amount.toFixed(2);
    if (amount >= 0.01) return amount.toFixed(4);
    return amount > 0 ? amount.toFixed(5) : "0.00";
  };
  const formatUsd = (mcapSol: number | null | undefined) => {
    if (!mcapSol || !solPrice) return "$0";
    const usd = mcapSol * solPrice;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };
  const formatAge = (dt: string) => formatDistanceToNow(new Date(dt), { addSuffix: false })
    .replace("about ", "").replace(" hours", "h").replace(" hour", "h")
    .replace(" minutes", "m").replace(" minute", "m").replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo");

  const handleLaunchSuccess = useCallback(() => refetch(), [refetch]);
  const handleShowResult = useCallback((result: LaunchResult) => {
    setLaunchResult(result);
    setShowResultModal(true);
  }, []);

  // Token filtering now handled inside AxiomTerminalGrid

  return (
    <div className="min-h-screen relative z-[1] overflow-x-hidden">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        {/* Top bar */}
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />

        {/* Ticker bar */}
        {isSolana && <TokenTickerBar />}

        {/* Chain Not Enabled Banner */}
        {!isChainEnabled && (
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: "rgba(234,179,8,0.1)", borderBottom: "1px solid rgba(234,179,8,0.3)" }}>
            <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-500">
              <span className="font-semibold">{chainConfig.name}</span> launch is coming soon! Switch to Solana to launch now.
            </p>
          </div>
        )}

        {/* Base Chain Launcher */}
        {chain === 'base' && (
          <div className="p-4"><BaseLauncher /></div>
        )}

        {/* Coming Soon for non-Solana, non-base */}
        {!isSolana && chain !== 'base' && (
          <div className="flex flex-col items-center justify-center flex-1 py-20 space-y-4">
            <AlertCircle className="h-12 w-12 text-primary" />
            <h2 className="text-xl font-bold text-white">{chainConfig.name} Coming Soon</h2>
            <p className="text-sm" style={{ color: "#888" }}>Switch to Solana to launch tokens now!</p>
            <Button onClick={() => setChain('solana')}>Switch to Solana</Button>
          </div>
        )}

        {isSolana && (
          <main className="flex-1">
            {/* Launch Countdown */}
            <div className="px-4 pt-3">
              <LaunchCountdown compact />
            </div>

            {/* Trending / Just Launched horizontal scroll */}
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Flame className="h-3.5 w-3.5 text-success" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Just Launched
                </span>
                <span className="text-[10px] text-muted-foreground/50">— Last 24h</span>
              </div>

              {/* Horizontal scroll of Just Launched cards */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {justLaunchedLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-[150px] h-[195px] rounded-xl bg-surface">
                      <Skeleton className="w-full h-full rounded-xl skeleton-shimmer" />
                    </div>
                  ))
                  : justLaunchedTokens.length === 0
                  ? (
                    <div className="flex items-center gap-2 py-4 px-3 rounded-xl bg-surface border border-border empty-state-fade">
                      <span className="text-[11px] text-muted-foreground">No new tokens in the last 48h — check back soon!</span>
                    </div>
                  )
                  : justLaunchedTokens.slice(0, 12).map(token => (
                    <Link
                      key={token.id}
                      to={`/trade/${token.mint_address || token.id}`}
                      className="flex-shrink-0 w-[150px] rounded-xl overflow-hidden group hover-lift bg-surface border border-border hover:border-success"
                    >
                      {/* Image */}
                      <div className="relative w-full" style={{ paddingBottom: "65%" }}>
                        <div className="absolute inset-0">
                          {token.image_url ? (
                            <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-muted text-success">
                              {token.ticker?.slice(0, 2)}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-1/2 pf-img-overlay" />
                          <div className="absolute bottom-1 left-1.5">
                            <span className="text-[10px] font-bold font-mono text-white">
                              {formatUsd(token.market_cap_sol)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-1.5">
                        <div className="text-[11px] font-semibold text-foreground truncate">{token.name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-success">${token.ticker}</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{formatAge(token.created_at)}</span>
                        </div>
                        {(token as any).description && (
                          <p className="text-[9px] leading-tight mt-0.5 line-clamp-1 text-muted-foreground">{(token as any).description}</p>
                        )}
                      </div>
                    </Link>
                  ))
                }
              </div>
            </div>

            {/* King of the Hill — premium glassmorphic cards */}
            <div className="px-4 pt-4">
              <KingOfTheHill />
            </div>

            {/* Online indicator */}
            <div className="px-4 pt-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
              <span className="text-[11px] font-mono text-muted-foreground">
                <span className="text-foreground font-semibold">{onlineCount ?? '—'}</span> online
              </span>
            </div>

            {/* Token Grid */}
            <div className="px-4 pt-4 pb-16">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {tokensLoading
                  ? Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-surface border border-border overflow-hidden">
                      <Skeleton className="w-full aspect-[16/9] skeleton-shimmer" />
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
                        <Skeleton className="h-3 w-1/2 skeleton-shimmer" />
                        <Skeleton className="h-2 w-full skeleton-shimmer" />
                      </div>
                    </div>
                  ))
                  : tokens.map(token => (
                    <TokenCard key={token.id} token={token} solPrice={solPrice} />
                  ))
                }
              </div>
            </div>

          </main>
        )}
      </div>

      {/* Launch Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="bg-card border border-primary/30 rounded-2xl !w-[calc(100vw-2rem)] !max-w-[420px] !left-1/2 !-translate-x-1/2 p-0 overflow-hidden">
          <div className="relative px-5 pt-6 pb-4">
            <DialogHeader className="text-center">
              <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold text-foreground">
                {launchResult?.success ? (
                  <><PartyPopper className="h-6 w-6 text-primary" />Token Launched!</>
                ) : (
                  <><XCircle className="h-6 w-6 text-destructive" />Launch Failed</>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-center">
                {launchResult?.success ? "Your token is now live on the blockchain" : launchResult?.error || "Something went wrong"}
              </DialogDescription>
            </DialogHeader>
          </div>
          {launchResult?.success && (
            <div className="px-5 pb-6 space-y-3">
              {launchResult.imageUrl && (
                <div className="flex justify-center">
                  <img src={launchResult.imageUrl} alt="Token" className="w-20 h-20 rounded-xl object-cover border border-border" />
                </div>
              )}
              <div className="text-center">
                <p className="font-bold text-foreground">{launchResult.name}</p>
                <p className="text-muted-foreground text-sm">${launchResult.ticker}</p>
              </div>
              {launchResult.mintAddress && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary">
                  <code className="text-xs font-mono text-foreground/80 flex-1 truncate">{launchResult.mintAddress}</code>
                  <button onClick={() => copyToClipboard(launchResult.mintAddress!)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copiedAddress === launchResult.mintAddress ? <CheckCircle className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                {launchResult.tradeUrl && (
                  <Button asChild className="flex-1">
                    <Link to={launchResult.tradeUrl}>View Token</Link>
                  </Button>
                )}
                {launchResult.solscanUrl && (
                  <Button asChild variant="outline" size="icon">
                    <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Token Modal */}
      <CreateTokenModal open={showCreateDialog} onClose={closeCreateDialog} />

      {/* Promote Modal */}
      {showPromoteModal && promoteTokenId && (
        <PromoteModal
          isOpen={showPromoteModal}
          onClose={() => setShowPromoteModal(false)}
          tokenId={promoteTokenId}
          tokenName={promoteTokenName}
          tokenTicker={promoteTokenTicker}
          promoterWallet={solanaAddress || ""}
        />
      )}
    </div>
  );
}
