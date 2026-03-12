import { useEffect, useMemo, useState, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedTokenImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallbackText?: string;
  /** Fallback image URL(s) to try before showing text placeholder */
  fallbackSrc?: string | string[] | null;
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
  const sourceCandidates = useMemo(() => {
    const candidates: string[] = [];

    const pushIfValid = (value: string | null | undefined) => {
      if (!value || !value.trim()) return;
      const normalized = normalizeImageUrl(value);
      if (!candidates.includes(normalized)) {
        candidates.push(normalized);
      }
    };

    pushIfValid(src);

    if (Array.isArray(_fallbackSrc)) {
      _fallbackSrc.forEach((candidate) => pushIfValid(candidate));
    } else {
      pushIfValid(_fallbackSrc);
    }

    return candidates;
  }, [src, _fallbackSrc]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [sourceCandidates.join("|")]);

  if (sourceCandidates.length === 0 || activeIndex >= sourceCandidates.length) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-xs font-bold text-muted-foreground",
          className
        )}
        {...props}
      >
        {fallbackText?.slice(0, 2) ?? "?"}
      </div>
    );
  }

  const activeSrc = getOptimizedUrl(sourceCandidates[activeIndex], size);

  return (
    <img
      src={activeSrc}
      alt={alt || ""}
      loading={props.loading || "lazy"}
      decoding={props.decoding || "async"}
      className={className}
      onError={(event) => {
        setActiveIndex((idx) => idx + 1);
        onError?.(event);
      }}
      {...props}
    />
  );
}
