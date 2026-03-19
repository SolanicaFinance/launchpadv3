import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock, Wallet, Rocket, Database, Megaphone, Bot, ScrollText,
  Users, Shield, Loader2, Wand2, Layers, Repeat, Radio
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

const ADMIN_PASSWORD = "saturn135@";

// Lazy load all admin content
const TreasuryAdminContent = lazy(() => import("./TreasuryAdminPage").then(m => ({ default: m.default })));
const XBotAdminPage = lazy(() => import("./XBotAdminPage"));
const AgentLogsAdminPage = lazy(() => import("./AgentLogsAdminPage"));
const FollowerScanPage = lazy(() => import("./FollowerScanPage"));
const InfluencerRepliesAdminPage = lazy(() => import("./InfluencerRepliesAdminPage"));
const PromoMentionsAdminPage = lazy(() => import("./PromoMentionsAdminPage"));
const DeployerDustAdminPage = lazy(() => import("./DeployerDustAdminPage"));
const SaturnForumAdminPage = lazy(() => import("./SaturnForumAdminPage"));
const SaturnAdminLaunchPage = lazy(() => import("./SaturnAdminLaunchPage"));
const PartnerFeesPage = lazy(() => import("./PartnerFeesPage"));
const XPostRestylerPage = lazy(() => import("./XPostRestylerPage"));
const BrandAssetsPage = lazy(() => import("./BrandAssetsPage"));
const BatchLaunchAdminPage = lazy(() => import("./BatchLaunchAdminPage"));
const AssistedSwapsAdminPage = lazy(() => import("./AssistedSwapsAdminPage"));
const DustCampaignTabLazy = lazy(() => import("@/components/admin/DustCampaignTab").then(m => ({ default: m.DustCampaignTab })));
const DexListingAdminTab = lazy(() => import("./DexListingAdminTab"));

import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { BRAND } from "@/config/branding";

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const TAB_CONFIG = [
  { value: "treasury", label: "Treasury", icon: Wallet },
  { value: "batch-launch", label: "Batch", icon: Layers },
  { value: "announcements", label: "Announce", icon: Megaphone },
  { value: "deployer", label: "Deployer", icon: Database },
  { value: "xbots", label: "X Bots", icon: Bot },
  { value: "agent-logs", label: "Logs", icon: ScrollText },
  { value: "follower-scan", label: "Followers", icon: Users },
  { value: "promo", label: "Promo", icon: Shield },
  { value: "forum", label: BRAND.forumName, icon: Shield },
  { value: "saturn-launch", label: "Launch", icon: Rocket },
  { value: "partner-fees", label: "Fees", icon: Wallet },
  { value: "x-restyler", label: "Restyler", icon: Wand2 },
  { value: "brand-assets", label: "Assets", icon: Wand2 },
  { value: "assisted-swaps", label: "Swaps", icon: Repeat },
  { value: "brand-dust", label: "Dust", icon: Radio },
  { value: "dex-listing", label: "Dex List", icon: Layers },
] as const;

export default function AdminPanelPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeTab = searchParams.get("tab") || "treasury";

  useEffect(() => {
    if (localStorage.getItem("admin_panel_auth_v2") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setError("");
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem("admin_panel_auth_v2", "true");
      localStorage.setItem("treasury_admin_auth", "true");
    } else {
      setError("Incorrect password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("admin_panel_auth_v2");
    localStorage.removeItem("treasury_admin_auth");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="md:ml-[48px] flex flex-col min-h-screen">
          <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
          <main className="flex-1 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <CardTitle>Admin Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="Enter admin password"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                <Button className="w-full" onClick={handleLogin}>
                  <Lock className="w-4 h-4 mr-2" />
                  Unlock
                </Button>
              </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 md:px-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div className="border-l-2 border-primary pl-4">
                <h1 className="font-mono text-sm text-primary uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Admin Panel
                </h1>
                <p className="font-mono text-xs text-muted-foreground mt-1">All admin tools in one place</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) => setSearchParams({ tab: v })}
              className="w-full"
            >
              <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="inline-flex flex-wrap gap-1 h-auto p-1 w-full md:w-auto">
                  {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} className="flex items-center gap-1 text-[11px] px-2 py-1.5 whitespace-nowrap">
                      <Icon className="h-3 w-3" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="treasury" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <TreasuryAdminContent />
                </Suspense>
              </TabsContent>

              <TabsContent value="batch-launch" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <BatchLaunchAdminPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="announcements" className="mt-6">
                <AnnouncementManager />
              </TabsContent>

              <TabsContent value="deployer" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <DeployerDustAdminPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="xbots" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <XBotAdminPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="agent-logs" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <AgentLogsAdminPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="follower-scan" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <FollowerScanPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="promo" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <div className="space-y-6">
                    <PromoMentionsAdminPage />
                    <InfluencerRepliesAdminPage />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="forum" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <SaturnForumAdminPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="saturn-launch" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <SaturnAdminLaunchPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="partner-fees" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <PartnerFeesPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="x-restyler" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <XPostRestylerPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="brand-assets" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <BrandAssetsPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="assisted-swaps" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <AssistedSwapsAdminPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="brand-dust" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <DustCampaignTabLazy />
                </Suspense>
              </TabsContent>

              <TabsContent value="dex-listing" className="mt-6">
                <Suspense fallback={<TabLoader />}>
                  <DexListingAdminTab />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
