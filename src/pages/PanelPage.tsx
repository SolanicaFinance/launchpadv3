import { useState, lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useChain } from "@/contexts/ChainContext";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wallet, Ghost, LogOut, Copy, Check, ExternalLink, Terminal } from "lucide-react";
import saturnLogo from "@/assets/saturn-logo.png";
import { copyToClipboard } from "@/lib/clipboard";
import { BRAND } from "@/config/branding";

const PanelUnifiedDashboard = lazy(() => import("@/components/panel/PanelUnifiedDashboard"));
const PanelPhantomTab = lazy(() => import("@/components/panel/PanelPhantomTab"));
const ServerSendPanel = lazy(() => import("@/components/panel/ServerSendPanel"));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function PanelPage() {
  const { isAuthenticated, isLoading: authLoading, login, logout, user, solanaAddress } = useAuth();
  const { isAdmin } = useIsAdmin(solanaAddress);
  const { chain, chainConfig } = useChain();
  const evmWallet = useEvmWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adminTab, setAdminTab] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("matrix-hidden");
    return () => document.body.classList.remove("matrix-hidden");
  }, []);

  const isBnb = chain === 'bnb';
  const displayAddress = isBnb ? evmWallet.address : solanaAddress;
  const explorerUrl = isBnb
    ? `https://bscscan.com/address/${displayAddress}`
    : `https://solscan.io/account/${displayAddress}`;

  const handleCopy = async () => {
    if (!displayAddress) return;
    const ok = await copyToClipboard(displayAddress);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  // Show loading spinner while Privy initializes (prevents "Connect Wallet" flash)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[48px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <img
                src={saturnLogo}
                alt={BRAND.name}
                className="w-12 h-12 animate-pulse drop-shadow-[0_0_24px_rgba(132,204,22,0.3)]"
              />
              <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[48px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
            <div
              className="w-full max-w-sm rounded-2xl p-8 text-center backdrop-blur-xl"
              style={{
                background: "rgba(0, 8, 20, 0.6)",
                border: "1px solid rgba(132, 204, 22, 0.15)",
                boxShadow: "0 0 40px rgba(132, 204, 22, 0.05)",
              }}
            >
              <img
                src={saturnLogo}
                alt={BRAND.name}
                className="w-16 h-16 mx-auto mb-5 drop-shadow-[0_0_24px_rgba(132,204,22,0.3)]"
              />
              <h1 className="text-xl font-black text-foreground mb-1 tracking-tight font-mono uppercase">
                {BRAND.shortName} Panel
              </h1>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed font-mono">
                Connect wallet to access your portfolio, earnings & trading tools.
              </p>
              <Button
                onClick={() => login()}
                className="w-full gap-2 h-11 rounded-xl text-sm font-bold font-mono uppercase tracking-wider"
                style={{
                  background: "linear-gradient(135deg, #84cc16, #22c55e)",
                  color: "#000",
                }}
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />

        <div className="w-full mx-auto px-4 md:px-6 lg:px-8 flex-1 flex flex-col max-w-[960px]">

          {/* Panel Header */}
          <div className="pt-5 pb-4 flex items-center gap-3">
            <img
              src={saturnLogo}
              alt={BRAND.name}
              className="w-9 h-9 drop-shadow-[0_0_16px_rgba(132,204,22,0.3)] flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black text-foreground tracking-wider font-mono uppercase">
                {BRAND.shortName} Panel
              </h1>
              {displayAddress && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse" />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 font-mono uppercase">
                    {chainConfig.shortName}
                  </span>
                  <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="gap-1.5 text-[11px] text-muted-foreground hover:text-destructive font-mono"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>

          {/* Main Unified Dashboard */}
          <div className="mt-1 flex-1">
            <Suspense fallback={<TabLoader />}>
              {adminTab ? (
                <div>
                  <button
                    onClick={() => setAdminTab(null)}
                    className="text-xs text-muted-foreground hover:text-foreground font-mono mb-4 flex items-center gap-1"
                  >
                    ← Back to Dashboard
                  </button>
                  {adminTab === "phantom" && <PanelPhantomTab />}
                  {adminTab === "server-send" && <ServerSendPanel walletAddress={solanaAddress ?? null} />}
                </div>
              ) : (
                <>
                  <PanelUnifiedDashboard />

                  {/* Admin tools at bottom */}
                  {isAdmin && (
                    <div className="mt-6 flex items-center gap-2 pb-4">
                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Admin:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdminTab("phantom")}
                        className="gap-1 text-[10px] font-mono text-muted-foreground h-7"
                      >
                        <Ghost className="h-3 w-3" /> Phantom
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdminTab("server-send")}
                        className="gap-1 text-[10px] font-mono text-muted-foreground h-7"
                      >
                        <Terminal className="h-3 w-3" /> Send
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Suspense>
          </div>

          <div className="pb-28 sm:pb-32" style={{ paddingBottom: "max(7rem, calc(60px + env(safe-area-inset-bottom, 0px) + 2rem))" }} />
        </div>
      </div>
    </div>
  );
}
