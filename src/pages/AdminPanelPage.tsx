import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock, Wallet, Skull, Rocket, Database, Megaphone, Bot, ScrollText,
  Users, Shield, Loader2, Wand2
} from "lucide-react";

const ADMIN_PASSWORD = "saturn";

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
  { value: "announcements", label: "Announcements", icon: Megaphone },
  { value: "deployer", label: "Deployer Dust", icon: Database },
  { value: "xbots", label: "X Bots", icon: Bot },
  { value: "agent-logs", label: "Agent Logs", icon: ScrollText },
  
  { value: "follower-scan", label: "Followers", icon: Users },
  { value: "promo", label: "Promo/Influencer", icon: Shield },
  { value: "forum", label: BRAND.forumName, icon: Shield },
  { value: "saturn-launch", label: "Saturn Launch", icon: Rocket },
  { value: "partner-fees", label: "Partner Fees", icon: Wallet },
  { value: "x-restyler", label: "X Restyler", icon: Wand2 },
] as const;

export default function AdminPanelPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "treasury";

  useEffect(() => {
    if (localStorage.getItem("admin_panel_auth") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setError("");
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem("admin_panel_auth", "true");
      localStorage.setItem("treasury_admin_auth", "true");
    } else {
      setError("Incorrect password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("admin_panel_auth");
    localStorage.removeItem("treasury_admin_auth");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <Button className="w-full" onClick={handleLogin}>
              <Lock className="w-4 h-4 mr-2" />
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" /> Admin Panel
            </h1>
            <p className="text-sm text-muted-foreground">All admin tools in one place</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setSearchParams({ tab: v })}
          className="w-full"
        >
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-auto min-w-full md:min-w-0">
              {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <Icon className="h-3.5 w-3.5" />
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
        </Tabs>
      </div>
    </div>
  );
}
