import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Image as ImageIcon } from "lucide-react";
import templateSrc from "@/assets/listing-template.jpg";

interface ListingImageGeneratorProps {
  tokenImageUrl: string;
  ticker: string;
  tokenName?: string;
}

// Circle position on the 1024x1024 template
const TEMPLATE_SIZE = 1024;
const CIRCLE_CX = 407;
const CIRCLE_CY = 383;
const CIRCLE_RADIUS = 140;

// Ticker text position
const TICKER_Y = 662;
const TICKER_X = TEMPLATE_SIZE / 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function ListingImageGenerator({ tokenImageUrl, ticker, tokenName }: ListingImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const [template, tokenImg] = await Promise.all([
        loadImage(templateSrc),
        loadImage(tokenImageUrl),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = TEMPLATE_SIZE;
      canvas.height = TEMPLATE_SIZE;
      const ctx = canvas.getContext("2d")!;

      // Draw template background
      ctx.drawImage(template, 0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);

      // Draw token image clipped to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(CIRCLE_CX, CIRCLE_CY, CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        tokenImg,
        CIRCLE_CX - CIRCLE_RADIUS,
        CIRCLE_CY - CIRCLE_RADIUS,
        CIRCLE_RADIUS * 2,
        CIRCLE_RADIUS * 2
      );
      ctx.restore();

      // Draw ticker text over "$TICKER" area
      // First draw a subtle dark backdrop to cover old text
      ctx.fillStyle = "rgba(10, 14, 20, 0.85)";
      ctx.fillRect(200, TICKER_Y - 35, 680, 55);

      // Draw new text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // "New Listing" part in white
      ctx.font = "italic 36px 'Georgia', serif";
      ctx.fillStyle = "#ffffff";
      const prefix = "New Listing ";
      const suffix = " just added.";
      const tickerStr = `$${ticker.toUpperCase()}`;
      
      const prefixWidth = ctx.measureText(prefix).width;
      ctx.font = "bold italic 36px 'Georgia', serif";
      const tickerWidth = ctx.measureText(tickerStr).width;
      ctx.font = "italic 36px 'Georgia', serif";
      const suffixWidth = ctx.measureText(suffix).width;
      
      const totalWidth = prefixWidth + tickerWidth + suffixWidth;
      const startX = TICKER_X - totalWidth / 2;
      
      // Draw prefix
      ctx.font = "italic 36px 'Georgia', serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(prefix, startX, TICKER_Y);
      
      // Draw ticker in gold/orange
      ctx.font = "bold italic 36px 'Georgia', serif";
      ctx.fillStyle = "#e8a838";
      ctx.fillText(tickerStr, startX + prefixWidth, TICKER_Y);
      
      // Draw suffix
      ctx.font = "italic 36px 'Georgia', serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(suffix, startX + prefixWidth + tickerWidth, TICKER_Y);

      const url = canvas.toDataURL("image/png");
      setPreviewUrl(url);
    } catch (err) {
      console.error("Failed to generate listing image:", err);
    } finally {
      setGenerating(false);
    }
  }, [tokenImageUrl, ticker]);

  const download = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `listing-${ticker.toUpperCase()}.png`;
    a.click();
  }, [previewUrl, ticker]);

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={generate}
        disabled={generating}
        className="gap-2"
      >
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
        Generate Listing Image
      </Button>

      {previewUrl && (
        <div className="space-y-2">
          <img
            src={previewUrl}
            alt={`Listing image for ${ticker}`}
            className="w-full max-w-md rounded-lg border border-border"
          />
          <Button variant="secondary" size="sm" onClick={download} className="gap-2">
            <Download className="w-3.5 h-3.5" />
            Download PNG
          </Button>
        </div>
      )}
    </div>
  );
}
