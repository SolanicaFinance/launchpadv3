import { Suspense } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
// Blockhash poller is started lazily in useFastSwap when trading is needed
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TradeSuccessPopup } from "@/components/TradeSuccessPopup";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

function LaunchpadRedirect() {
  const { mintAddress } = useParams();
  return <Navigate to={`/trade/${mintAddress}`} replace />;
}
import { PrivyProviderWrapper } from "@/providers/PrivyProviderWrapper";
import { ChainProvider } from "@/contexts/ChainContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RuntimeConfigBootstrap } from "@/components/RuntimeConfigBootstrap";
import { EvmWalletProvider } from "@/providers/EvmWalletProvider";
import { DomainRouter } from "@/components/DomainRouter";
import { StickyStatsFooter } from "@/components/layout/StickyStatsFooter";
import { MatrixModeProvider } from "@/contexts/MatrixModeContext";
import { BrandingProvider } from "@/contexts/BrandingContext";

// Lazy load FunLauncherPage like all other pages to reduce build memory
const FunLauncherPage = lazyWithRetry(() => import("./pages/FunLauncherPage"));

// Lazy load other pages
const FunTokenDetailPage = lazyWithRetry(() => import("./pages/FunTokenDetailPage"));
const TrendingPage = lazyWithRetry(() => import("./pages/TrendingPage"));
const VanityAdminPage = lazyWithRetry(() => import("./pages/VanityAdminPage"));
const LaunchpadTemplatePage = lazyWithRetry(() => import("./pages/LaunchpadTemplatePage"));
const InvestigateTokenPage = lazyWithRetry(() => import("./pages/InvestigateTokenPage"));
const TradePage = lazyWithRetry(() => import("./pages/TradePage"));
const WidgetPage = lazyWithRetry(() => import("./pages/WidgetPage"));
const SaturnForumPage = lazyWithRetry(() => import("./pages/SaturnForumPage"));
const SaturnCommunityPage = lazyWithRetry(() => import("./pages/SaturnCommunityPage"));
const SaturnPostPage = lazyWithRetry(() => import("./pages/SaturnPostPage"));
const AgentDocsPage = lazyWithRetry(() => import("./pages/AgentDocsPage"));
const AgentDashboardPage = lazyWithRetry(() => import("./pages/AgentDashboardPage"));
const AgentLeaderboardPage = lazyWithRetry(() => import("./pages/AgentLeaderboardPage"));
const AgentProfilePage = lazyWithRetry(() => import("./pages/AgentProfilePage"));
const AgentConnectPage = lazyWithRetry(() => import("./pages/AgentConnectPage"));
const BagsAgentsPage = lazyWithRetry(() => import("./pages/BagsAgentsPage"));
const TradingAgentProfilePage = lazyWithRetry(() => import("./pages/TradingAgentProfilePage"));
const WhitepaperPage = lazyWithRetry(() => import("./pages/WhitepaperPage"));

const CareersPage = lazyWithRetry(() => import("./pages/CareersPage"));
const SaturnModePage = lazyWithRetry(() => import("./pages/SaturnModePage"));
const TunnelDistributePage = lazyWithRetry(() => import("./pages/TunnelDistributePage"));
const CompressedDistributePage = lazyWithRetry(() => import("./pages/CompressedDistributePage"));
const DecompressPage = lazyWithRetry(() => import("./pages/DecompressPage"));
const FunModePage = lazyWithRetry(() => import("./pages/FunModePage"));
const AdminPanelPage = lazyWithRetry(() => import("./pages/AdminPanelPage"));
const BrandingAdminPage = lazyWithRetry(() => import("./pages/BrandingAdminPage"));

const BannerMakerPage = lazyWithRetry(() => import("./pages/BannerMakerPage"));
const AlphaTrackerPage = lazyWithRetry(() => import("./pages/AlphaTrackerPage"));
const XTrackerPage = lazyWithRetry(() => import("./pages/XTrackerPage"));
const DiscoverPage = lazyWithRetry(() => import("./pages/DiscoverPage"));
const UserProfilePage = lazyWithRetry(() => import("./pages/UserProfilePage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const PanelPage = lazyWithRetry(() => import("./pages/PanelPage"));
const MerchStorePage = lazyWithRetry(() => import("./pages/MerchStorePage"));
const LeveragePage = lazyWithRetry(() => import("./pages/LeveragePage"));
const PunchPage = lazyWithRetry(() => import("./pages/PunchPage"));
const PunchTestPage = lazyWithRetry(() => import("./pages/PunchTestPage"));
const PunchGamesPage = lazyWithRetry(() => import("./pages/PunchGamesPage"));
const PunchTokenDetailPage = lazyWithRetry(() => import("./pages/PunchTokenDetailPage"));
const ReferralRedirectPage = lazyWithRetry(() => import("./pages/ReferralRedirectPage"));
const WalletTrackerPage = lazyWithRetry(() => import("./pages/WalletTrackerPage"));
const CreateTokenPage = lazyWithRetry(() => import("./pages/CreateTokenPage"));
const AllTokensPage = lazyWithRetry(() => import("./pages/AllTokensPage"));
const RewardsPage = lazyWithRetry(() => import("./pages/RewardsPage"));
const PortfolioPage = lazyWithRetry(() => import("./pages/PortfolioPage"));

const HomePage = lazyWithRetry(() => import("./pages/HomePage"));

// Domain-aware root: render PunchTestPage on punchlaunch.fun, HomePage otherwise
function DomainRoot() {
  const hostname = window.location.hostname;
  const isPunch = hostname === "punchlaunch.fun" || hostname === "www.punchlaunch.fun";
  if (isPunch) {
    return <Suspense fallback={<RouteLoader />}><PunchTestPage /></Suspense>;
  }
  return <Suspense fallback={<RouteLoader />}><HomePage /></Suspense>;
}

// Minimal loading spinner for route transitions
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center relative z-[1]">
      <div className="w-6 h-6 border-2 border-transparent border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// Configure QueryClient with performance optimizations
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce refetches
      gcTime: 1000 * 60 * 10, // 10 minutes cache
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      retry: 1, // Only retry once on failure
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RuntimeConfigBootstrap />
    <BrandingProvider>
    <PrivyProviderWrapper>
      <ChainProvider>
        <EvmWalletProvider>
          <MatrixModeProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <Sonner />
            <ErrorBoundary>
              <BrowserRouter>
              <TradeSuccessPopup />
              <StickyStatsFooter />
                
                <DomainRouter />
                <Suspense fallback={<RouteLoader />}>
                   <div className="relative z-[1]">
                   <Routes>
                    <Route path="/" element={<DomainRoot />} />
                    <Route path="/tokens" element={<AllTokensPage />} />
                    <Route path="/launchpad" element={<CreateTokenPage />} />
                    <Route path="/launchpad/create" element={<CreateTokenPage />} />
                    <Route path="/terminal" element={<FunLauncherPage />} />
                    
                     {/* Chain-specific launch routes */}
                     <Route path="/launch" element={<Navigate to="/launch/solana" replace />} />
                     <Route path="/launch/:chain" element={<FunLauncherPage />} />
                    <Route path="/trade/:mintAddress" element={<FunTokenDetailPage />} />
                    <Route path="/launchpad/:mintAddress" element={<LaunchpadRedirect />} />
                    <Route path="/trending" element={<TrendingPage />} />
                    <Route path="/vanity-admin" element={<VanityAdminPage />} />
                    <Route path="/site" element={<LaunchpadTemplatePage />} />
                    <Route path="/admin" element={<AdminPanelPage />} />
                    <Route path="/admin/branding" element={<BrandingAdminPage />} />
                    <Route path="/admin/twitter" element={<Navigate to="/admin?tab=xbots" replace />} />
                    <Route path="/admin/treasury" element={<Navigate to="/admin?tab=treasury" replace />} />
                    <Route path="/trade" element={<TradePage />} />
                     <Route path="/alpha-tracker" element={<AlphaTrackerPage />} />
                     <Route path="/x-tracker" element={<XTrackerPage />} />
                     <Route path="/discover" element={<DiscoverPage />} />
                     <Route path="/profile/:identifier" element={<UserProfilePage />} />
                    <Route path="/investigate-token" element={<InvestigateTokenPage />} />
                    <Route path="/widget/:type" element={<WidgetPage />} />
                    <Route path="/agents" element={<SaturnForumPage />} />
                    <Route path="/t/:ticker" element={<SaturnCommunityPage />} />
                    <Route path="/t/:ticker/post/:postId" element={<SaturnPostPage />} />
                    <Route path="/agents/docs" element={<AgentDocsPage />} />
                    <Route path="/agents/dashboard" element={<AgentDashboardPage />} />
                    <Route path="/agents/leaderboard" element={<AgentLeaderboardPage />} />
                    <Route path="/agent/:agentId" element={<AgentProfilePage />} />
                    <Route path="/agents/claim" element={<Navigate to="/panel?tab=earnings" replace />} />
                    <Route path="/agents/connect" element={<AgentConnectPage />} />
                    
                    <Route path="/agents/bags" element={<BagsAgentsPage />} />
                    <Route path="/agents/trading" element={<Navigate to="/agents?tab=trading" replace />} />
                    <Route path="/trading-agents" element={<Navigate to="/agents?tab=trading" replace />} />
                    <Route path="/agents/trading/:id" element={<TradingAgentProfilePage />} />
                    <Route path="/admin/clawbook" element={<Navigate to="/admin?tab=forum" replace />} />
                    <Route path="/admin/agent-logs" element={<Navigate to="/admin?tab=agent-logs" replace />} />
                    <Route path="/admin/influencer-replies" element={<Navigate to="/admin?tab=promo" replace />} />
                    <Route path="/admin/promo-mentions" element={<Navigate to="/admin?tab=promo" replace />} />
                    <Route path="/admin/deployer-dust" element={<Navigate to="/admin?tab=deployer" replace />} />
                    
                    <Route path="/partnerfees" element={<Navigate to="/admin?tab=partner-fees" replace />} />
                    <Route path="/whitepaper" element={<WhitepaperPage />} />
                    
                     <Route path="/sdk" element={<Navigate to="/" replace />} />
                     <Route path="/opentuna" element={<Navigate to="/" replace />} />
                     <Route path="/api" element={<Navigate to="/" replace />} />
                     <Route path="/api/docs" element={<Navigate to="/" replace />} />
                    <Route path="/careers" element={<CareersPage />} />
                    <Route path="/admin/x-bots" element={<Navigate to="/admin?tab=xbots" replace />} />
                    <Route path="/admin/follower-scan" element={<Navigate to="/admin?tab=follower-scan" replace />} />
                    <Route path="/claw" element={<SaturnModePage />} />
                    <Route path="/claw/adminlaunch" element={<Navigate to="/admin?tab=saturn-launch" replace />} />
                    
                    <Route path="/admin/tunnel-distribute" element={<TunnelDistributePage />} />
                    <Route path="/admin/compressed-distribute" element={<CompressedDistributePage />} />
                    <Route path="/decompress" element={<DecompressPage />} />
                     <Route path="/fun" element={<FunModePage />} />
                     
                     <Route path="/panel" element={<PanelPage />} />
                     <Route path="/merch" element={<MerchStorePage />} />
                     <Route path="/leverage" element={<LeveragePage />} />
                     <Route path="/banner-maker" element={<BannerMakerPage />} />
                     <Route path="/portfolio" element={<PortfolioPage />} />
                     <Route path="/earnings" element={<Navigate to="/panel?tab=earnings" replace />} />
                     <Route path="/punch" element={<PunchPage />} />
                     <Route path="/punch-test" element={<PunchTestPage />} />
                     <Route path="/punch/token/:mintAddress" element={<PunchTokenDetailPage />} />
                     <Route path="/punch-games" element={<PunchGamesPage />} />
                     <Route path="/link/:code" element={<ReferralRedirectPage />} />
                     <Route path="/wallet-tracker" element={<WalletTrackerPage />} />
                     <Route path="/rewards" element={<RewardsPage />} />
                     <Route path="*" element={<NotFound />} />
                  </Routes>
                  </div>
                </Suspense>
              </BrowserRouter>
            </ErrorBoundary>
          </TooltipProvider>
          </MatrixModeProvider>
        </EvmWalletProvider>
      </ChainProvider>
    </PrivyProviderWrapper>
    </BrandingProvider>
  </QueryClientProvider>
);

export default App;
