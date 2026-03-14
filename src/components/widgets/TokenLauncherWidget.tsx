import { useState } from "react";
import { BRAND } from "@/config/branding";
import { Rocket, Upload, Link as LinkIcon, Twitter, Globe, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface WidgetConfig {
  apiKey: string;
  theme: "dark" | "light";
  accentColor?: string;
  hideHeader?: boolean;
}

interface TokenLauncherWidgetProps {
  config: WidgetConfig;
}

const BASE_URL = "https://ptwytypavumcrbofspno.supabase.co/functions/v1";

export default function TokenLauncherWidget({ config }: TokenLauncherWidgetProps) {
  const [formData, setFormData] = useState({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
  });
  const [tradingFeeBps, setTradingFeeBps] = useState(200);
  const [isLaunching, setIsLaunching] = useState(false);
  const [result, setResult] = useState<{ mintAddress: string; tradeUrl: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.ticker) {
      toast.error("Name and ticker are required");
      return;
    }

    setIsLaunching(true);

    try {
      const response = await fetch(`${BASE_URL}/api-launch-token`, {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          tradingFeeBps,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          mintAddress: data.mintAddress,
          tradeUrl: data.tradeUrl,
        });
        toast.success("Token launched successfully!");
        
        // Notify parent window
        window.parent.postMessage({
          type: "token-launched",
          data: {
            mintAddress: data.mintAddress,
            poolAddress: data.poolAddress,
            tradeUrl: data.tradeUrl,
          },
        }, "*");
      } else {
        toast.error(data.error || "Failed to launch token");
      }
    } catch (error) {
      toast.error("Failed to launch token");
    } finally {
      setIsLaunching(false);
    }
  };

  if (result) {
    return (
    <Card className="border-0 shadow-none">
      {!config.hideHeader && (
        <CardHeader className="text-center">
          <CardTitle className="text-primary">🚀 Token Launched!</CardTitle>
        </CardHeader>
      )}
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">Your token is now live on Solana</p>
          
          <div className="bg-muted/50 p-4 rounded-lg break-all">
            <p className="text-xs text-muted-foreground mb-1">Mint Address</p>
            <p className="font-mono text-sm">{result.mintAddress}</p>
          </div>

          <Button className="w-full" onClick={() => window.open(result.tradeUrl, "_blank")}>
            Trade Now
          </Button>

          <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
            Launch Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      {!config.hideHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Launch Token
          </CardTitle>
          <CardDescription>Create your own meme token on Solana</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Token Name *</Label>
              <Input
                id="name"
                placeholder="My Token"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={32}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker *</Label>
              <Input
                id="ticker"
                placeholder="MTK"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                maxLength={10}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell us about your token..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Image URL
            </Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            />
          </div>

          {/* Social Links */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website
            </Label>
            <Input
              type="url"
              placeholder="https://mytoken.com"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                Twitter
              </Label>
              <Input
                type="url"
                placeholder="https://x.com/..."
                value={formData.twitterUrl}
                onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Telegram
              </Label>
              <Input
                type="url"
                placeholder="https://t.me/..."
                value={formData.telegramUrl}
                onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
              />
            </div>
          </div>

          {/* Trading Fee */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Trading Fee</Label>
              <span className="text-sm text-muted-foreground">{(tradingFeeBps / 100).toFixed(1)}%</span>
            </div>
            <Slider
              value={[tradingFeeBps]}
              onValueChange={([val]) => setTradingFeeBps(val)}
              min={10}
              max={1000}
              step={10}
            />
            <p className="text-xs text-muted-foreground">
              Fee charged on each trade (0.1% - 10%)
            </p>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isLaunching}>
            {isLaunching ? (
              <>
                <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin mr-2" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Launch Token
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Powered by {BRAND.name}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
