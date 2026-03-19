import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTokenLaunch } from "@/hooks/useTokenLaunch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Rocket, Upload, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";

interface LaunchpadTokenCreatorProps {
  launchpadId: string;
  walletAddress: string;
  design?: {
    colors?: {
      primary?: string;
      surface?: string;
      text?: string;
      textMuted?: string;
    };
    layout?: {
      borderRadius?: string;
    };
  };
  onTokenCreated?: (tokenId: string, mintAddress: string) => void;
}

export function LaunchpadTokenCreator({
  launchpadId,
  walletAddress,
  design,
  onTokenCreated,
}: LaunchpadTokenCreatorProps) {
  const { isAuthenticated, login } = useAuth();
  const { launchToken, isLaunching } = useTokenLaunch();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [initialBuySol, setInitialBuySol] = useState("0.1");

  const colors = design?.colors || {
    primary: "#8B5CF6",
    surface: "#1A1A1A",
    text: "#FFFFFF",
    textMuted: "#A1A1AA",
  };

  const radius = (() => {
    switch (design?.layout?.borderRadius) {
      case "none": return "0px";
      case "sm": return "4px";
      case "md": return "8px";
      case "lg": return "12px";
      case "xl": return "16px";
      case "full": return "24px";
      default: return "12px";
    }
  })();

  const handleLaunch = async () => {
    if (!name.trim() || !ticker.trim()) {
      toast.error("Name and ticker are required");
      return;
    }

    try {
      // Set the launchpad context for fee routing
      localStorage.setItem('x-launchpad-id', launchpadId);
      
      const result = await launchToken({
        name: name.trim(),
        ticker: ticker.trim().toUpperCase(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        twitterUrl: twitterUrl.trim() || undefined,
        telegramUrl: telegramUrl.trim() || undefined,
        initialBuySol: parseFloat(initialBuySol) || 0.1,
      });

      if (result.success) {
        // Link token to launchpad
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tokens`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              launchpadId,
              tokenId: result.tokenId,
              wallet: walletAddress,
            }),
          }
        );

        toast.success("Token launched and linked to launchpad!");
        setOpen(false);
        resetForm();
        onTokenCreated?.(result.tokenId, result.mintAddress);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to launch token");
    } finally {
      localStorage.removeItem('x-launchpad-id');
    }
  };

  const resetForm = () => {
    setName("");
    setTicker("");
    setDescription("");
    setImageUrl("");
    setWebsiteUrl("");
    setTwitterUrl("");
    setTelegramUrl("");
    setInitialBuySol("0.1");
  };

  if (!isAuthenticated) {
    return (
      <Button
        onClick={() => setShowLoginModal(true)}
        style={{
          backgroundColor: colors.primary,
          color: "#fff",
          borderRadius: radius,
        }}
      >
        Connect to Launch
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          style={{
            backgroundColor: colors.primary,
            color: "#fff",
            borderRadius: radius,
          }}
        >
          <Rocket className="w-4 h-4 mr-2" />
          Launch Token
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderRadius: radius,
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: colors.text }}>
            Launch New Token
          </DialogTitle>
          <DialogDescription style={{ color: colors.textMuted }}>
            Create and launch a new token on this launchpad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: colors.textMuted }}>Token Name *</Label>
              <Input
                placeholder="My Token"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  backgroundColor: `${colors.text}10`,
                  borderColor: `${colors.text}20`,
                  color: colors.text,
                }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.textMuted }}>Ticker *</Label>
              <Input
                placeholder="TOKEN"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                maxLength={10}
                style={{
                  backgroundColor: `${colors.text}10`,
                  borderColor: `${colors.text}20`,
                  color: colors.text,
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label style={{ color: colors.textMuted }}>Description</Label>
            <Textarea
              placeholder="Describe your token..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                backgroundColor: `${colors.text}10`,
                borderColor: `${colors.text}20`,
                color: colors.text,
              }}
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: colors.textMuted }}>Image URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{
                  backgroundColor: `${colors.text}10`,
                  borderColor: `${colors.text}20`,
                  color: colors.text,
                }}
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-10 h-10 rounded-lg object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label style={{ color: colors.textMuted }}>Website</Label>
              <Input
                placeholder="https://..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                style={{
                  backgroundColor: `${colors.text}10`,
                  borderColor: `${colors.text}20`,
                  color: colors.text,
                }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: colors.textMuted }}>Twitter</Label>
              <Input
                placeholder="https://twitter.com/..."
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                style={{
                  backgroundColor: `${colors.text}10`,
                  borderColor: `${colors.text}20`,
                  color: colors.text,
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label style={{ color: colors.textMuted }}>
              Initial Buy (SOL)
            </Label>
            <Input
              type="number"
              placeholder="0.1"
              value={initialBuySol}
              onChange={(e) => setInitialBuySol(e.target.value)}
              min="0.1"
              step="0.1"
              style={{
                backgroundColor: `${colors.text}10`,
                borderColor: `${colors.text}20`,
                color: colors.text,
              }}
            />
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Amount of SOL to buy on launch (min 0.1)
            </p>
          </div>

          <Button
            className="w-full"
            disabled={isLaunching || !name.trim() || !ticker.trim()}
            onClick={handleLaunch}
            style={{
              backgroundColor: colors.primary,
              color: "#fff",
              borderRadius: radius,
            }}
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                Launch Token
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
