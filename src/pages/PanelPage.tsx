import { useState, lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useChain } from "@/contexts/ChainContext";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wallet, Briefcase, DollarSign, Rocket, Ghost, LogOut, Users, Copy, Check, ExternalLink, Terminal } from "lucide-react";
import saturnLogo from "@/assets/saturn-logo.png";
import { copyToClipboard } from "@/lib/clipboard";
import { BRAND } from "@/config/branding";

const PanelWalletBar = lazy(() => import("@/components/panel/PanelWalletBar"));
const PanelPortfolioTab = lazy(() => import("@/components/panel/PanelPortfolioTab"));
const PanelEarningsTab = lazy(() => import("@/components/panel/PanelEarningsTab"));
const PanelMyLaunchesTab = lazy(() => import("@/components/panel/PanelMyLaunchesTab"));
const PanelPhantomTab = lazy(() => import("@/components/panel/PanelPhantomTab"));
const PanelReferralsTab = lazy(() => import("@/components/panel/PanelReferralsTab"));
const PanelWalletTab = lazy(() => import("@/components/wallet/PanelWalletTab"));
const ServerSendPanel = lazy(() => import("@/components/panel/ServerSendPanel"));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function PanelPage() {
  const { isAuthenticated, login, logout, user, solanaAddress } = useAuth();
  const { isAdmin } = useIsAdmin(solanaAddress);
  const { chain, chainConfig } = useChain();
  const evmWallet = useEvmWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "portfolio";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.body.classList.add("matrix-hidden");
    return () => document.body.classList.remove("matrix-hidden");
  }, []);

  const setTab = (tab: string) => setSearchParams({ tab });

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[48px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
            <div
              className="w-full max-w-sm rounded-md p-8 text-center border border-border/40"
              style={{
                background: "hsl(var(--card))",
              }}
            >
              <img
                src={saturnLogo}
                alt={BRAND.name}
                className="w-16 h-16 mx-auto mb-5 drop-shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
              />
              <h1 className="text-xl font-black text-foreground mb-1 tracking-tight font-mono uppercase">
                Saturn Panel
              </h1>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed font-mono">
                Connect wallet to access your portfolio, earnings & trading tools.
              </p>
              <Button
                onClick={() => login()}
                className="w-full gap-2 h-11 rounded-md text-sm font-bold font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="w-9 h-9 drop-shadow-[0_0_16px_hsl(var(--primary)/0.3)] flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black text-foreground tracking-wider font-mono uppercase">
                Saturn Panel
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

          {/* Wallet Bar */}
          <Suspense fallback={null}>
            <PanelWalletBar />
          </Suspense>

          {/* Tabs */}
          <div className="mt-3 flex-1">
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList
                className="w-full mb-5 p-1 rounded-md h-auto flex gap-0.5 bg-card border border-border/40"
              >
                <PanelTab value="portfolio" icon={<Briefcase className="h-3.5 w-3.5" />} label="Portfolio" active={activeTab === "portfolio"} />
                <PanelTab value="earnings" icon={<DollarSign className="h-3.5 w-3.5" />} label="Earnings" active={activeTab === "earnings"} />
                <PanelTab value="launches" icon={<Rocket className="h-3.5 w-3.5" />} label="Launches" active={activeTab === "launches"} />
                <PanelTab value="wallets" icon={<Wallet className="h-3.5 w-3.5" />} label="Wallet" active={activeTab === "wallets"} />
                <PanelTab value="referrals" icon={<Users className="h-3.5 w-3.5" />} label="Referrals" active={activeTab === "referrals"} />
                {isAdmin && <PanelTab value="phantom" icon={<Ghost className="h-3.5 w-3.5" />} label="Phantom" active={activeTab === "phantom"} />}
                {isAdmin && <PanelTab value="server-send" icon={<Terminal className="h-3.5 w-3.5" />} label="Send" active={activeTab === "server-send"} />}
              </TabsList>

              <Suspense fallback={<TabLoader />}>
                <TabsContent value="portfolio"><PanelPortfolioTab /></TabsContent>
                <TabsContent value="earnings"><PanelEarningsTab /></TabsContent>
                <TabsContent value="launches"><PanelMyLaunchesTab /></TabsContent>
                <TabsContent value="wallets"><PanelWalletTab /></TabsContent>
                <TabsContent value="referrals"><PanelReferralsTab /></TabsContent>
                <TabsContent value="phantom"><PanelPhantomTab /></TabsContent>
                <TabsContent value="server-send"><ServerSendPanel walletAddress={solanaAddress ?? null} /></TabsContent>
              </Suspense>
            </Tabs>
          </div>

          <div className="pb-28 sm:pb-32" style={{ paddingBottom: "max(7rem, calc(60px + env(safe-area-inset-bottom, 0px) + 2rem))" }} />
        </div>
      </div>
    </div>
  );
}

function PanelTab({ value, icon, label, active }: { value: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <TabsTrigger
      value={value}
      className={`flex-1 gap-1.5 text-[11px] md:text-xs rounded-sm py-2 font-mono uppercase tracking-wider transition-all
        ${active
          ? "bg-primary/10 text-primary shadow-[inset_0_-2px_0_hsl(var(--primary))]"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        }
        data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]
      `}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}
