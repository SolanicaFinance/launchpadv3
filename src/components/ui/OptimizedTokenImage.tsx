import { useState, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedTokenImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallbackText?: string;
  /** Fallback image URL to try before showing text placeholder */
  fallbackSrc?: string | null;
  /** Target render size in px — used to request a smaller image */
  size?: number;
}

/**
 * Rewrites known image URLs to request smaller variants:
 * - Supabase storage: appends /render/image?width=X&resize=contain
 * - IPFS gateways: uses ?img-width=X where supported
 */
function getOptimizedUrl(src: string, size: number): string {
  // Supabase storage URLs — use built-in image transform
  if (src.includes("supabase.co/storage/v1/object/public/")) {
    // Already a render URL? skip
    if (src.includes("/render/image")) return src;
    const renderUrl = src.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    const sep = renderUrl.includes("?") ? "&" : "?";
    return `${renderUrl}${sep}width=${size}&resize=contain&quality=60`;
  }

  // Pump.fun CDN images — append size param
  if (src.includes("pump.mypinata.cloud") || src.includes("cf-ipfs.com")) {
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}img-width=${size}`;
  }

  // Generic — return as-is (browser handles with CSS sizing)
  return src;
}

export function OptimizedTokenImage({
  src,
  fallbackText,
  fallbackSrc,
  size = 200,
  className,
  alt,
  ...props
}: OptimizedTokenImageProps) {
  const [errorCount, setErrorCount] = useState(0);

  // No src at all → show text
  if (!src && !fallbackSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-xs font-bold text-muted-foreground",
          className
        )}
      >
        {fallbackText?.slice(0, 2) ?? "?"}
      </div>
    );
  }

  // Determine which URL to show based on error count
  const currentSrc =
    errorCount === 0 && src
      ? src
      : errorCount <= 1 && fallbackSrc
        ? fallbackSrc
        : null;

  if (!currentSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-xs font-bold text-muted-foreground",
          className
        )}
      >
        {fallbackText?.slice(0, 2) ?? "?"}
      </div>
    );
  }

  const optimizedSrc = getOptimizedUrl(currentSrc, size);

  return (
    <img
      src={optimizedSrc}
      alt={alt || ""}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setErrorCount((c) => c + 1)}
      {...props}
    />
  );
}
