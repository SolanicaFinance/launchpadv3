import { Suspense, lazy } from "react";
import { startBlockhashPoller } from "@/lib/blockhashCache";

// Start blockhash poller immediately on module load for instant trade execution
startBlockhashPoller();
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
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

// Critical: Load FunLauncherPage eagerly for instant home page
import FunLauncherPage from "./pages/FunLauncherPage";

// Lazy load other pages
const FunTokenDetailPage = lazy(() => import("./pages/FunTokenDetailPage"));
const TrendingPage = lazy(() => import("./pages/TrendingPage"));
const VanityAdminPage = lazy(() => import("./pages/VanityAdminPage"));
const LaunchpadTemplatePage = lazy(() => import("./pages/LaunchpadTemplatePage"));
const InvestigateTokenPage = lazy(() => import("./pages/InvestigateTokenPage"));
const TradePage = lazy(() => import("./pages/TradePage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const ApiDashboardPage = lazy(() => import("./pages/ApiDashboardPage"));
const WidgetPage = lazy(() => import("./pages/WidgetPage"));
const ClawBookPage = lazy(() => import("./pages/ClawBookPage"));
const SubClawPage = lazy(() => import("./pages/SubClawPage"));
const ClawPostPage = lazy(() => import("./pages/ClawPostPage"));
const AgentDocsPage = lazy(() => import("./pages/AgentDocsPage"));
const AgentDashboardPage = lazy(() => import("./pages/AgentDashboardPage"));
const AgentLeaderboardPage = lazy(() => import("./pages/AgentLeaderboardPage"));
const AgentProfilePage = lazy(() => import("./pages/AgentProfilePage"));

const AgentConnectPage = lazy(() => import("./pages/AgentConnectPage"));

const BagsAgentsPage = lazy(() => import("./pages/BagsAgentsPage"));

const TradingAgentProfilePage = lazy(() => import("./pages/TradingAgentProfilePage"));
const WhitepaperPage = lazy(() => import("./pages/WhitepaperPage"));
const ClawSDKPage = lazy(() => import("./pages/ClawSDKPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const ClawModePage = lazy(() => import("./pages/ClawModePage"));

const TunnelDistributePage = lazy(() => import("./pages/TunnelDistributePage"));
const CompressedDistributePage = lazy(() => import("./pages/CompressedDistributePage"));
const DecompressPage = lazy(() => import("./pages/DecompressPage"));
const FunModePage = lazy(() => import("./pages/FunModePage"));
const AdminPanelPage = lazy(() => import("./pages/AdminPanelPage"));
// NFA pages removed
const BannerMakerPage = lazy(() => import("./pages/BannerMakerPage"));
const AlphaTrackerPage = lazy(() => import("./pages/AlphaTrackerPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PanelPage = lazy(() => import("./pages/PanelPage"));

const PunchPage = lazy(() => import("./pages/PunchPage"));
const PunchTestPage = lazy(() => import("./pages/PunchTestPage"));
const PunchGamesPage = lazy(() => import("./pages/PunchGamesPage"));
const PunchTokenDetailPage = lazy(() => import("./pages/PunchTokenDetailPage"));

// Domain-aware root: render PunchTestPage on punchlaunch.fun, FunLauncherPage otherwise
function PunchDomainRoot() {
  const hostname = window.location.hostname;
  const isPunch = hostname === "punchlaunch.fun" || hostname === "www.punchlaunch.fun";
  if (isPunch) {
    return <Suspense fallback={<RouteLoader />}><PunchTestPage /></Suspense>;
  }
  return <FunLauncherPage />;
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
    <PrivyProviderWrapper>
      <ChainProvider>
        <EvmWalletProvider>
          <MatrixModeProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <Sonner />
            <ErrorBoundary>
              <BrowserRouter>
              <StickyStatsFooter />
                
                <DomainRouter />
                <Suspense fallback={<RouteLoader />}>
                   <div className="relative z-[1]">
                   <Routes>
                    <Route path="/" element={<PunchDomainRoot />} />
                    
                    {/* Chain-specific launch routes */}
                    <Route path="/launch" element={<Navigate to="/launch/solana" replace />} />
                    <Route path="/launch/solana" element={<FunLauncherPage />} />
                    <Route path="/launch/base" element={<FunLauncherPage />} />
                    <Route path="/launch/ethereum" element={<FunLauncherPage />} />
                    <Route path="/launch/bnb" element={<FunLauncherPage />} />
                    <Route path="/trade/:mintAddress" element={<FunTokenDetailPage />} />
                    <Route path="/launchpad/:mintAddress" element={<LaunchpadRedirect />} />
                    <Route path="/trending" element={<TrendingPage />} />
                    <Route path="/vanity-admin" element={<VanityAdminPage />} />
                    <Route path="/site" element={<LaunchpadTemplatePage />} />
                    <Route path="/admin" element={<AdminPanelPage />} />
                    <Route path="/admin/twitter" element={<Navigate to="/admin?tab=xbots" replace />} />
                    <Route path="/admin/treasury" element={<Navigate to="/admin?tab=treasury" replace />} />
                    <Route path="/trade" element={<TradePage />} />
                     <Route path="/alpha-tracker" element={<AlphaTrackerPage />} />
                     <Route path="/discover" element={<DiscoverPage />} />
                     <Route path="/profile/:identifier" element={<UserProfilePage />} />
                    <Route path="/investigate-token" element={<InvestigateTokenPage />} />
                    <Route path="/api" element={<ApiDashboardPage />} />
                    <Route path="/api/docs" element={<ApiDocsPage />} />
                    <Route path="/widget/:type" element={<WidgetPage />} />
                    <Route path="/agents" element={<ClawBookPage />} />
                    <Route path="/t/:ticker" element={<SubClawPage />} />
                    <Route path="/t/:ticker/post/:postId" element={<ClawPostPage />} />
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
                    <Route path="/admin/clawbook" element={<Navigate to="/admin?tab=clawbook" replace />} />
                    <Route path="/admin/agent-logs" element={<Navigate to="/admin?tab=agent-logs" replace />} />
                    <Route path="/admin/influencer-replies" element={<Navigate to="/admin?tab=promo" replace />} />
                    <Route path="/admin/promo-mentions" element={<Navigate to="/admin?tab=promo" replace />} />
                    <Route path="/admin/deployer-dust" element={<Navigate to="/admin?tab=deployer" replace />} />
                    <Route path="/admin/colosseum" element={<Navigate to="/admin?tab=colosseum" replace />} />
                    <Route path="/partnerfees" element={<Navigate to="/admin?tab=partner-fees" replace />} />
                    <Route path="/whitepaper" element={<WhitepaperPage />} />
                    
                     <Route path="/sdk" element={<ClawSDKPage />} />
                     <Route path="/opentuna" element={<Navigate to="/sdk" replace />} />
                    <Route path="/careers" element={<CareersPage />} />
                    <Route path="/admin/x-bots" element={<Navigate to="/admin?tab=xbots" replace />} />
                    <Route path="/admin/follower-scan" element={<Navigate to="/admin?tab=follower-scan" replace />} />
                    <Route path="/claw" element={<ClawModePage />} />
                    <Route path="/claw/adminlaunch" element={<Navigate to="/admin?tab=claw-launch" replace />} />
                    
                    <Route path="/admin/tunnel-distribute" element={<TunnelDistributePage />} />
                    <Route path="/admin/compressed-distribute" element={<CompressedDistributePage />} />
                    <Route path="/decompress" element={<DecompressPage />} />
                     <Route path="/fun" element={<FunModePage />} />
                     
                     <Route path="/panel" element={<PanelPage />} />
                     <Route path="/banner-maker" element={<BannerMakerPage />} />
                     <Route path="/portfolio" element={<Navigate to="/panel?tab=portfolio" replace />} />
                     <Route path="/earnings" element={<Navigate to="/panel?tab=earnings" replace />} />
                     <Route path="/punch" element={<PunchPage />} />
                     <Route path="/punch-test" element={<PunchTestPage />} />
                     <Route path="/punch/token/:mintAddress" element={<PunchTokenDetailPage />} />
                     <Route path="/punch-games" element={<PunchGamesPage />} />
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
  </QueryClientProvider>
);

export default App;
