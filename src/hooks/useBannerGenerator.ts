import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const BANNER_WIDTH = 1500;
const BANNER_HEIGHT = 500;

interface BannerParams {
  imageUrl: string;
  tokenName: string;
  ticker: string;
}

/**
 * Loads an image to canvas with CORS handling
 */
const loadImageToCanvas = (imageUrl: string): Promise<HTMLCanvasElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // CRITICAL: Set crossOrigin BEFORE src for external AI images
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
};

/**
 * Extracts the dominant color from a canvas and returns a uniform color (not dimmed)
 */
const extractDominantColor = (canvas: HTMLCanvasElement): string => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#1a1a1f";
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let r = 0, g = 0, b = 0, count = 0;
  
  // Sample every 10th pixel for performance
  for (let i = 0; i < data.length; i += 40) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }
  
  r = Math.floor(r / count);
  g = Math.floor(g / count);
  b = Math.floor(b / count);
  
  // Return uniform color without darkening
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Generates a 1500x500px X banner with token image centered, no text overlay
 */
const generateXBanner = async (params: BannerParams): Promise<Blob> => {
  const { imageUrl } = params;

  // 1. Load the generated token image
  const tokenImgCanvas = await loadImageToCanvas(imageUrl);
  
  // 2. Extract dominant color from token image
  const backgroundColor = extractDominantColor(tokenImgCanvas);
  
  // 3. Create the banner canvas
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = BANNER_WIDTH;
  bannerCanvas.height = BANNER_HEIGHT;
  const ctx = bannerCanvas.getContext("2d")!;

  // 4. Draw solid background (uniform color)
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);

  // 5. Draw Token Image on the right side (circular mask)
  const imgSize = BANNER_HEIGHT * 0.85; // 85% of banner height
  const imgX = BANNER_WIDTH - imgSize - (BANNER_HEIGHT * 0.075); // Right-aligned with small padding
  const imgY = (BANNER_HEIGHT - imgSize) / 2;
  
  // Create circular clipping mask
  ctx.save();
  ctx.beginPath();
  ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  
  // Draw the token image scaled to fit
  const scale = Math.max(imgSize / tokenImgCanvas.width, imgSize / tokenImgCanvas.height);
  const scaledWidth = tokenImgCanvas.width * scale;
  const scaledHeight = tokenImgCanvas.height * scale;
  const offsetX = imgX + (imgSize - scaledWidth) / 2;
  const offsetY = imgY + (imgSize - scaledHeight) / 2;
  
  ctx.drawImage(tokenImgCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.restore();
  
  // Add subtle glow effect around the image
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // No text overlay - clean banner with just the mascot

  // 6. Export as Blob
  return new Promise((resolve, reject) => {
    bannerCanvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Banner generation failed")),
      "image/png"
    );
  });
};

export function useBannerGenerator() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const generateBanner = useCallback(async (params: BannerParams) => {
    if (!params.imageUrl || !params.tokenName) {
      toast({
        title: "Missing token data",
        description: "Generate a token first before creating a banner",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    
    try {
      const blob = await generateXBanner(params);
      const url = URL.createObjectURL(blob);
      setBannerUrl(url);
      
      toast({
        title: "Banner Generated! 🎨",
        description: "Your 1500x500 X header banner is ready",
      });
      
      return { blob, url };
    } catch (error) {
      console.error("[BannerGenerator] Error:", error);
      toast({
        title: "Banner generation failed",
        description: error instanceof Error ? error.message : "Failed to generate banner",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const downloadBanner = useCallback((url: string, tokenName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tokenName.toLowerCase().replace(/\s+/g, "-")}-banner.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const clearBanner = useCallback(() => {
    if (bannerUrl) {
      URL.revokeObjectURL(bannerUrl);
      setBannerUrl(null);
    }
  }, [bannerUrl]);

  return {
    generateBanner,
    downloadBanner,
    clearBanner,
    isGenerating,
    bannerUrl,
  };
}
