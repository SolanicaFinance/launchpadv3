import { useState, useEffect } from "react";
import { useBranding, BrandingConfig } from "@/contexts/BrandingContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Paintbrush,
  Globe,
  Type,
  Image,
  ToggleLeft,
  Save,
  Loader2,
  ArrowLeft,
  Eye,
  Palette,
  Link2,
  Coins,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BrandingAdminPage() {
  const { config, isLoading, updateBranding, isUpdating } = useBranding();
  const [form, setForm] = useState<Partial<BrandingConfig>>({});
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (config && !isLoading) {
      setForm({ ...config });
    }
  }, [config, isLoading]);

  const set = (key: keyof BrandingConfig, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    try {
      await updateBranding(form);
      toast.success("Branding updated! Changes are live.");
    } catch (e: any) {
      toast.error(e.message || "Failed to save branding");
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-6 max-w-sm w-full">
          <h2 className="text-lg font-bold mb-4 text-center flex items-center justify-center gap-2">
            <Paintbrush className="h-5 w-5 text-primary" /> White-Label Admin
          </h2>
          <Input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password === "claw2024treasury") setAuthorized(true);
            }}
            className="mb-3"
          />
          <Button
            onClick={() => { if (password === "claw2024treasury") setAuthorized(true); }}
            className="w-full"
          >
            Enter
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Paintbrush className="h-5 w-5 text-primary" />
                White-Label Branding
              </h1>
              <p className="text-sm text-muted-foreground">
                Change once here, updates everywhere instantly
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isUpdating} className="gap-2">
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Changes
          </Button>
        </div>

        {/* Live preview bar */}
        <Card className="p-4 mb-6 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Live Preview:</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border">
              <span className="text-lg">{form.iconEmoji}</span>
              <span className="font-bold text-sm">{form.brandName}</span>
              <span className="text-xs text-muted-foreground">— {form.tagline}</span>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 mb-6 bg-transparent p-0">
            <TabsTrigger value="identity" className="gap-1.5 data-[state=active]:bg-primary/10">
              <Type className="h-3.5 w-3.5" /> Identity
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5 data-[state=active]:bg-primary/10">
              <Image className="h-3.5 w-3.5" /> Assets
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5 data-[state=active]:bg-primary/10">
              <Link2 className="h-3.5 w-3.5" /> Links & Social
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-1.5 data-[state=active]:bg-primary/10">
              <Palette className="h-3.5 w-3.5" /> Theme & Colors
            </TabsTrigger>
            <TabsTrigger value="token" className="gap-1.5 data-[state=active]:bg-primary/10">
              <Coins className="h-3.5 w-3.5" /> Token
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-1.5 data-[state=active]:bg-primary/10">
              <ToggleLeft className="h-3.5 w-3.5" /> Features
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5 data-[state=active]:bg-primary/10">
              <FileText className="h-3.5 w-3.5" /> SEO & Meta
            </TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Brand Identity</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brandName">Brand Name</Label>
                  <Input id="brandName" value={form.brandName || ""} onChange={(e) => set("brandName", e.target.value)} placeholder="e.g. MoonDexo" />
                </div>
                <div>
                  <Label htmlFor="brandShortName">Short Name</Label>
                  <Input id="brandShortName" value={form.brandShortName || ""} onChange={(e) => set("brandShortName", e.target.value)} placeholder="e.g. MoonDexo" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input id="tagline" value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} placeholder="e.g. The fastest AI-powered trading terminal" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Short description for OG and social cards" />
                </div>
                <div>
                  <Label htmlFor="iconEmoji">Icon Emoji</Label>
                  <Input id="iconEmoji" value={form.iconEmoji || ""} onChange={(e) => set("iconEmoji", e.target.value)} placeholder="🪐" className="text-2xl" />
                </div>
                <div>
                  <Label htmlFor="forumName">Forum Name</Label>
                  <Input id="forumName" value={form.forumName || ""} onChange={(e) => set("forumName", e.target.value)} placeholder="e.g. MoonDexo Forum" />
                </div>
                <div>
                  <Label htmlFor="agentBrandName">Agent Brand Name</Label>
                  <Input id="agentBrandName" value={form.agentBrandName || ""} onChange={(e) => set("agentBrandName", e.target.value)} placeholder="e.g. MoonDexo Agents" />
                </div>
                <div>
                  <Label htmlFor="communityPrefix">Community URL Prefix</Label>
                  <Input id="communityPrefix" value={form.communityPrefix || ""} onChange={(e) => set("communityPrefix", e.target.value)} placeholder="e.g. t/" />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Logos & Images</h3>
              <p className="text-sm text-muted-foreground">Enter URLs or paths to your brand assets. Upload logos to your hosting then paste the URL here.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="logoUrl">Logo URL / Path</Label>
                  <Input id="logoUrl" value={form.logoUrl || ""} onChange={(e) => set("logoUrl", e.target.value)} placeholder="/saturn-logo.png" />
                  {form.logoUrl && (
                    <div className="mt-2 p-2 bg-muted/30 rounded-lg inline-block">
                      <img src={form.logoUrl} alt="Logo preview" className="h-12 w-12 object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="faviconUrl">Favicon URL / Path</Label>
                  <Input id="faviconUrl" value={form.faviconUrl || ""} onChange={(e) => set("faviconUrl", e.target.value)} placeholder="/favicon.png" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="ogImageUrl">OG Image URL (for social sharing)</Label>
                  <Input id="ogImageUrl" value={form.ogImageUrl || ""} onChange={(e) => set("ogImageUrl", e.target.value)} placeholder="https://yourdomain.com/og-image.png" />
                  {form.ogImageUrl && (
                    <div className="mt-2 p-2 bg-muted/30 rounded-lg inline-block">
                      <img src={form.ogImageUrl} alt="OG preview" className="h-20 object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Links & Social Tab */}
          <TabsContent value="links">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Links & Social Media</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" value={form.domain || ""} onChange={(e) => set("domain", e.target.value)} placeholder="saturn.trade" />
                </div>
                <div>
                  <Label htmlFor="appUrl">App URL</Label>
                  <Input id="appUrl" value={form.appUrl || ""} onChange={(e) => set("appUrl", e.target.value)} placeholder="https://saturntrade.lovable.app" />
                </div>
                <div>
                  <Label htmlFor="twitterHandle">Twitter / X Handle</Label>
                  <Input id="twitterHandle" value={form.twitterHandle || ""} onChange={(e) => set("twitterHandle", e.target.value)} placeholder="@saturntrade" />
                </div>
                <div>
                  <Label htmlFor="twitterUrl">Twitter / X URL</Label>
                  <Input id="twitterUrl" value={form.twitterUrl || ""} onChange={(e) => set("twitterUrl", e.target.value)} placeholder="https://x.com/saturntrade" />
                </div>
                <div>
                  <Label htmlFor="discordUrl">Discord URL</Label>
                  <Input id="discordUrl" value={form.discordUrl || ""} onChange={(e) => set("discordUrl", e.target.value)} placeholder="https://discord.gg/..." />
                </div>
                <div>
                  <Label htmlFor="telegramUrl">Telegram URL</Label>
                  <Input id="telegramUrl" value={form.telegramUrl || ""} onChange={(e) => set("telegramUrl", e.target.value)} placeholder="https://t.me/..." />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Theme & Colors Tab */}
          <TabsContent value="theme">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Theme & Colors</h3>
              <p className="text-sm text-muted-foreground">HSL values (e.g. "72 100% 50%"). These override the CSS design tokens.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="colorPrimary">Primary Color (HSL)</Label>
                  <div className="flex gap-2">
                    <Input id="colorPrimary" value={form.colorPrimary || ""} onChange={(e) => set("colorPrimary", e.target.value)} placeholder="72 100% 50%" />
                    <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: `hsl(${form.colorPrimary})` }} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="colorAccent">Accent Color (HSL)</Label>
                  <div className="flex gap-2">
                    <Input id="colorAccent" value={form.colorAccent || ""} onChange={(e) => set("colorAccent", e.target.value)} placeholder="45 100% 50%" />
                    <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: `hsl(${form.colorAccent})` }} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="colorBackground">Background Color (HSL)</Label>
                  <div className="flex gap-2">
                    <Input id="colorBackground" value={form.colorBackground || ""} onChange={(e) => set("colorBackground", e.target.value)} placeholder="228 20% 6%" />
                    <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: `hsl(${form.colorBackground})` }} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="colorForeground">Foreground Color (HSL)</Label>
                  <div className="flex gap-2">
                    <Input id="colorForeground" value={form.colorForeground || ""} onChange={(e) => set("colorForeground", e.target.value)} placeholder="0 0% 95%" />
                    <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: `hsl(${form.colorForeground})` }} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="colorMuted">Muted Color (HSL)</Label>
                  <div className="flex gap-2">
                    <Input id="colorMuted" value={form.colorMuted || ""} onChange={(e) => set("colorMuted", e.target.value)} placeholder="220 10% 40%" />
                    <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0" style={{ backgroundColor: `hsl(${form.colorMuted})` }} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Input id="fontFamily" value={form.fontFamily || ""} onChange={(e) => set("fontFamily", e.target.value)} placeholder="IBM Plex Sans" />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Token Tab */}
          <TabsContent value="token">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Platform Token</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="platformTokenTicker">Token Ticker</Label>
                  <Input id="platformTokenTicker" value={form.platformTokenTicker || ""} onChange={(e) => set("platformTokenTicker", e.target.value)} placeholder="CLAW" />
                </div>
                <div>
                  <Label htmlFor="platformTokenName">Token Name</Label>
                  <Input id="platformTokenName" value={form.platformTokenName || ""} onChange={(e) => set("platformTokenName", e.target.value)} placeholder="CLAW" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="platformTokenMint">Token Mint Address</Label>
                  <Input id="platformTokenMint" value={form.platformTokenMint || ""} onChange={(e) => set("platformTokenMint", e.target.value)} placeholder="GfLD9EQn..." className="font-mono text-xs" />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Feature Toggles Tab */}
          <TabsContent value="features">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Feature Toggles</h3>
              <p className="text-sm text-muted-foreground">Enable or disable sections of the platform per client.</p>
              <div className="space-y-4">
                {([
                  ["featureForumEnabled", "Forum", "Community discussion boards"],
                  ["featureMerchEnabled", "Merch Store", "Physical merchandise shop"],
                  ["featureAgentsEnabled", "AI Agents", "Agent creation and management"],
                  ["featureLeverageEnabled", "Leverage Trading", "Leveraged trading terminal"],
                  ["featureAlphaTrackerEnabled", "Alpha Tracker", "Alpha trade tracking"],
                  ["featureXTrackerEnabled", "X Tracker", "Twitter/X monitoring"],
                  ["featureGovernanceEnabled", "Governance", "Community governance voting"],
                ] as const).map(([key, label, desc]) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={!!form[key]}
                      onCheckedChange={(checked) => set(key, checked)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* SEO & Meta Tab */}
          <TabsContent value="seo">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">SEO & Page Meta</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pageTitle">Page Title (shown in browser tab)</Label>
                  <Input id="pageTitle" value={form.pageTitle || ""} onChange={(e) => set("pageTitle", e.target.value)} placeholder="MoonDexo Trading Terminal - Solana and EVM" />
                  <p className="text-xs text-muted-foreground mt-1">{(form.pageTitle || "").length}/60 characters recommended</p>
                </div>
                <div>
                  <Label htmlFor="metaDescription">Meta Description</Label>
                  <Input id="metaDescription" value={form.metaDescription || ""} onChange={(e) => set("metaDescription", e.target.value)} placeholder="Your one step trading Terminal and Launchpad on Solana and EVM." />
                  <p className="text-xs text-muted-foreground mt-1">{(form.metaDescription || "").length}/160 characters recommended</p>
                </div>
                <div>
                  <Label htmlFor="sdkName">SDK Package Name</Label>
                  <Input id="sdkName" value={form.sdkName || ""} onChange={(e) => set("sdkName", e.target.value)} placeholder="@saturntrade/sdk" className="font-mono text-sm" />
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bottom save bar */}
        <div className="sticky bottom-4 mt-6">
          <Card className="p-3 flex items-center justify-between bg-background/95 backdrop-blur-xl border-primary/20">
            <span className="text-sm text-muted-foreground">
              Changes apply immediately across the entire platform after saving.
            </span>
            <Button onClick={handleSave} disabled={isUpdating} className="gap-2">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All Changes
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
