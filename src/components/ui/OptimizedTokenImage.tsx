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
 * Normalizes raw token image URLs into directly fetchable URLs.
 */
function normalizeImageUrl(src: string): string {
  const value = src.trim();

  if (value.startsWith("ipfs://")) {
    const ipfsPath = value.replace("ipfs://", "").replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${ipfsPath}`;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return value;
}

/**
 * Rewrites known storage URLs for smaller payloads without altering third-party signed URLs.
 */
function getOptimizedUrl(src: string, size: number): string {
  const normalized = normalizeImageUrl(src);

  // Storage URLs — use built-in image transform
  if (normalized.includes("/storage/v1/object/public/")) {
    if (normalized.includes("/storage/v1/render/image/public/")) return normalized;
    const renderUrl = normalized.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    const sep = renderUrl.includes("?") ? "&" : "?";
    return `${renderUrl}${sep}width=${size}&resize=contain&quality=75`;
  }

  // Leave external URLs untouched to avoid breaking signed/gateway image links.
  return normalized;
}

export function OptimizedTokenImage({
  src,
  fallbackText,
  fallbackSrc: _fallbackSrc,
  size = 200,
  className,
  alt,
  onError,
  ...props
}: OptimizedTokenImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
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

  const optimizedSrc = getOptimizedUrl(src, size);

  return (
    <img
      src={optimizedSrc}
      alt={alt || ""}
      loading="lazy"
      decoding="async"
      className={className}
      onError={(event) => {
        setHasError(true);
        onError?.(event);
      }}
      {...props}
    />
  );
}
