import { useState, lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wallet, Briefcase, DollarSign, Fingerprint, Rocket, Shield, Ghost, LogOut, Users, Layers } from "lucide-react";
import clawLogo from "@/assets/claw-logo.png";

const PanelWalletBar = lazy(() => import("@/components/panel/PanelWalletBar"));
const PanelPortfolioTab = lazy(() => import("@/components/panel/PanelPortfolioTab"));
const PanelEarningsTab = lazy(() => import("@/components/panel/PanelEarningsTab"));
const PanelNfaTab = lazy(() => import("@/components/panel/PanelNfaTab"));

const PanelMyLaunchesTab = lazy(() => import("@/components/panel/PanelMyLaunchesTab"));
const PanelPhantomTab = lazy(() => import("@/components/panel/PanelPhantomTab"));
const PanelReferralsTab = lazy(() => import("@/components/panel/PanelReferralsTab"));
const RecentNfaAgents = lazy(() => import("@/components/panel/RecentNfaAgents"));
const WalletManagerPanel = lazy(() => import("@/components/wallet/WalletManagerPanel"));

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-transparent border-t-[#F97316] rounded-full animate-spin" />
    </div>
  );
}

export default function PanelPage() {
  const { isAuthenticated, login, logout, user, solanaAddress } = useAuth();
  const { isAdmin } = useIsAdmin(solanaAddress);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "nfas";

  useEffect(() => {
    document.body.classList.add("matrix-hidden");
    return () => document.body.classList.remove("matrix-hidden");
  }, []);

  const setTab = (tab: string) => setSearchParams({ tab });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="md:ml-[48px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
            {/* Glassmorphic login card */}
            <div
              className="w-full max-w-sm rounded-3xl p-8 text-center"
              style={{
                background: "rgba(15,23,42,0.7)",
                border: "1px solid rgba(51,65,85,0.4)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.1))", border: "1px solid rgba(249,115,22,0.2)" }}
              >
                <img src={clawLogo} alt="Claw Mode" className="h-10 w-10 rounded-xl" />
              </div>
              <h1 className="text-xl font-bold text-[#F1F5F9] mb-2">
                Claw Mode Panel
              </h1>
              <p className="text-sm text-[#94A3B8] mb-6 leading-relaxed">
                Connect your wallet to access portfolio, earnings, NFAs, and trading agents.
              </p>
              <Button
                onClick={() => login()}
                className="w-full gap-2 h-12 rounded-2xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", color: "#fff" }}
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
              <div className="flex items-center justify-center gap-4 mt-5">
                <TrustPill icon={<Shield className="w-3 h-3" />} label="Secure" />
                <TrustPill icon={<Fingerprint className="w-3 h-3" />} label="Non-custodial" />
              </div>
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

        {/* Constrained center column — wider for NFA tab */}
        <div className={`w-full mx-auto px-4 md:px-6 lg:px-8 flex-1 flex flex-col ${activeTab === "nfas" ? "max-w-[1400px]" : "max-w-[960px]"}`}>

          {/* Panel Header */}
          <div className="pt-5 pb-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.15)" }}
            >
              <img src={clawLogo} alt="" className="h-6 w-6 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-[#F1F5F9] tracking-tight">Panel</h1>
              <p className="text-[11px] text-[#64748B] font-mono truncate">
                {solanaAddress ? `${solanaAddress.slice(0, 6)}...${solanaAddress.slice(-4)}` : ""}
                {solanaAddress && (
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-emerald-400/80">Connected</span>
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="gap-1.5 text-[11px] text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>

          {/* Wallet Bar */}
          <Suspense fallback={null}>
            <PanelWalletBar />
          </Suspense>

          {/* Tabs */}
          <div className="mt-2 flex-1">
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList
                className="w-full mb-4 p-1 rounded-2xl h-auto flex gap-0.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(51,65,85,0.3)" }}
              >
                <PanelTab value="nfas" icon={<Fingerprint className="h-3.5 w-3.5" />} label="NFAs" active={activeTab === "nfas"} />
                <PanelTab value="portfolio" icon={<Briefcase className="h-3.5 w-3.5" />} label="Portfolio" active={activeTab === "portfolio"} />
                <PanelTab value="earnings" icon={<DollarSign className="h-3.5 w-3.5" />} label="Earnings" active={activeTab === "earnings"} />
                
                <PanelTab value="launches" icon={<Rocket className="h-3.5 w-3.5" />} label="Launches" active={activeTab === "launches"} />
                <PanelTab value="wallets" icon={<Layers className="h-3.5 w-3.5" />} label="Wallets" active={activeTab === "wallets"} />
                <PanelTab value="referrals" icon={<Users className="h-3.5 w-3.5" />} label="Referrals" active={activeTab === "referrals"} />
                {isAdmin && <PanelTab value="phantom" icon={<Ghost className="h-3.5 w-3.5" />} label="Phantom" active={activeTab === "phantom"} />}
              </TabsList>

              <Suspense fallback={<TabLoader />}>
                <TabsContent value="nfas"><PanelNfaTab /></TabsContent>
                <TabsContent value="portfolio"><PanelPortfolioTab /></TabsContent>
                <TabsContent value="earnings"><PanelEarningsTab /></TabsContent>
                
                <TabsContent value="launches"><PanelMyLaunchesTab /></TabsContent>
                <TabsContent value="wallets"><WalletManagerPanel /></TabsContent>
                <TabsContent value="referrals"><PanelReferralsTab /></TabsContent>
                <TabsContent value="phantom"><PanelPhantomTab /></TabsContent>
              </Suspense>
            </Tabs>
          </div>

          {/* Divider */}
          <div className="my-6" style={{ borderTop: "1px solid rgba(51,65,85,0.25)" }} />

          {/* Recent NFA Agents section — extra bottom padding clears sticky footer */}
          <div className="pb-28 sm:pb-32" style={{ paddingBottom: "max(7rem, calc(60px + env(safe-area-inset-bottom, 0px) + 2rem))" }}>
            <Suspense fallback={null}>
              <RecentNfaAgents />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelTab({ value, icon, label, active }: { value: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <TabsTrigger
      value={value}
      className="flex-1 gap-1.5 text-[11px] md:text-xs rounded-xl py-2 transition-all data-[state=active]:bg-white/[0.06] data-[state=active]:shadow-sm"
      style={active ? { color: "#F97316" } : { color: "#64748B" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B]">
      <span className="text-[#22D3EE]">{icon}</span>
      {label}
    </span>
  );
}
