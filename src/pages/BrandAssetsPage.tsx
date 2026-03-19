import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import saturnLogo from "@/assets/saturn-logo.png";
import { BRAND } from "@/config/branding";
import GIF from "gif.js";

interface GeneratedAsset {
  label: string;
  width: number;
  height: number;
  url: string;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function BrandAssetsPage() {
  const [headerText, setHeaderText] = useState<string>(BRAND.name);
  const [headerSubtext, setHeaderSubtext] = useState<string>(BRAND.tagline);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  const loadLogo = useCallback((): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = saturnLogo;
    });
  }, []);

  const generateTokenImage = useCallback(async (logo: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;

    // Modern dark background
    ctx.fillStyle = "#212124";
    ctx.fillRect(0, 0, 200, 200);

    // Full-canvas neon glow
    const cx = 100, cy = 100;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
    glow.addColorStop(0, "rgba(200, 255, 0, 0.45)");
    glow.addColorStop(0.4, "rgba(200, 255, 0, 0.25)");
    glow.addColorStop(0.7, "rgba(200, 255, 0, 0.1)");
    glow.addColorStop(1, "rgba(200, 255, 0, 0.04)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 200, 200);

    // Center logo
    const logoSize = 140;
    const x = (200 - logoSize) / 2;
    const y = (200 - logoSize) / 2;
    ctx.drawImage(logo, x, y, logoSize, logoSize);

    return canvas.toDataURL("image/png");
  }, []);

  const generateRotatingGif = useCallback(async (logo: HTMLImageElement): Promise<string> => {
    return new Promise((resolve, reject) => {
      const size = 200;
      const logoSize = 140;
      const frames = 36;
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: size,
        height: size,
        workerScript: "https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js",
        transparent: null,
      });

      for (let i = 0; i < frames; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;

        ctx.fillStyle = "#212124";
        ctx.fillRect(0, 0, size, size);

        const angle = (i / frames) * Math.PI * 2;
        const cx = size / 2;
        const cy = size / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.drawImage(logo, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
        ctx.restore();

        gif.addFrame(canvas, { delay: 50, copy: true });
      }

      gif.on("finished", (blob: Blob) => {
        resolve(URL.createObjectURL(blob));
      });

      gif.on("error", reject);
      gif.render();
    });
  }, []);

  const generateHeaderImage = useCallback(async (logo: HTMLImageElement, title: string, subtitle: string): Promise<string> => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;

    // Modern dark background
    ctx.fillStyle = "#212124";
    ctx.fillRect(0, 0, 600, 200);

    // Logo positioning
    const logoSize = 100;
    const logoX = 40;
    const logoY = (200 - logoSize) / 2;

    // Neon glow behind logo
    const logoCx = logoX + logoSize / 2;
    const logoCy = logoY + logoSize / 2;
    const glowR = 70;
    const glow = ctx.createRadialGradient(logoCx, logoCy, glowR * 0.3, logoCx, logoCy, glowR);
    glow.addColorStop(0, "rgba(200, 255, 0, 0.3)");
    glow.addColorStop(0.5, "rgba(200, 255, 0, 0.1)");
    glow.addColorStop(1, "rgba(200, 255, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 600, 200);

    // Logo
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

    // Title text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textBaseline = "middle";
    const textX = logoX + logoSize + 30;

    if (subtitle) {
      ctx.fillText(title, textX, 80);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(subtitle, textX, 125);
    } else {
      ctx.fillText(title, textX, 100);
    }

    return canvas.toDataURL("image/png");
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const logo = await loadLogo();

      const tokenUrl = await generateTokenImage(logo);
      const headerUrl = await generateHeaderImage(logo, headerText, headerSubtext);

      setAssets([
        { label: "Token Image", width: 200, height: 200, url: tokenUrl },
        { label: "Header Image", width: 600, height: 200, url: headerUrl },
      ]);
    } catch (err) {
      console.error("Failed to generate assets:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [loadLogo, generateTokenImage, generateHeaderImage, headerText, headerSubtext]);

  const handleDownload = useCallback((url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div>
      <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Brand Asset Generator</h1>
          <p className="text-sm text-muted-foreground">
            Generate token images and header banners using the {BRAND.name} logo.
          </p>
        </div>

        {/* Preview of current logo */}
        <Card className="p-4 flex items-center justify-between border-border bg-card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden border border-border relative">
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md opacity-60" />
              <img src={saturnLogo} alt={`${BRAND.name} Logo`} className="w-10 h-10 object-contain relative z-10 drop-shadow-[0_0_6px_hsl(72_100%_50%/0.4)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Current Logo</p>
              <p className="text-xs text-muted-foreground">saturn-logo.png</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const logo = await loadLogo();
              const canvas = document.createElement("canvas");
              canvas.width = 200;
              canvas.height = 200;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(logo, 0, 0, 200, 200);
              handleDownload(canvas.toDataURL("image/png"), `${BRAND.shortName.toLowerCase()}-logo-200x200.png`);
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            200×200
          </Button>
        </Card>

        {/* Header text inputs */}
        <Card className="p-4 space-y-3 border-border bg-card">
          <p className="text-sm font-medium text-foreground">Header Image Text</p>
          <Input
            placeholder="Title (e.g. Saturn)"
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            className="bg-background border-border"
          />
          <Input
            placeholder="Subtitle (e.g. The fastest trading terminal on Solana)"
            value={headerSubtext}
            onChange={(e) => setHeaderSubtext(e.target.value)}
            className="bg-background border-border"
          />
        </Card>

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
          <ImageIcon className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : "Generate Assets"}
        </Button>

        <Button
          onClick={async () => {
            setIsGeneratingGif(true);
            try {
              const logo = await loadLogo();
              const url = await generateRotatingGif(logo);
              setGifUrl(url);
            } catch (err) {
              console.error("Failed to generate GIF:", err);
            } finally {
              setIsGeneratingGif(false);
            }
          }}
          disabled={isGeneratingGif}
          variant="outline"
          className="w-full"
        >
          {isGeneratingGif ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
          {isGeneratingGif ? "Generating GIF..." : "Generate Rotating Logo GIF"}
        </Button>

        {/* Rotating GIF */}
        {gifUrl && (
          <Card className="p-4 space-y-3 border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Rotating Logo GIF</p>
                <p className="text-xs text-muted-foreground">200×200px animated</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(gifUrl, `${BRAND.shortName.toLowerCase()}-rotating-logo.gif`)}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
            </div>
            <div className="rounded-lg overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
              <img src={gifUrl} alt="Rotating Logo" style={{ maxWidth: "100%", height: "auto" }} />
            </div>
          </Card>
        )}

        {/* Generated assets */}
        {assets.length > 0 && (
          <div className="space-y-6">
            {assets.map((asset) => (
              <Card key={asset.label} className="p-4 space-y-3 border-border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{asset.label}</p>
                    <p className="text-xs text-muted-foreground">{asset.width}×{asset.height}px</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(asset.url, `${BRAND.shortName.toLowerCase()}-${asset.label.toLowerCase().replace(/\s+/g, "-")}.png`)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </Button>
                </div>
                <div className="rounded-lg overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
                  <img src={asset.url} alt={asset.label} style={{ maxWidth: "100%", height: "auto" }} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
