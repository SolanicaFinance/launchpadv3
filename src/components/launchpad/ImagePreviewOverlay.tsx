import { Download, X } from "lucide-react";

interface ImagePreviewOverlayProps {
  src: string;
  alt?: string;
  onClear?: () => void;
  downloadName?: string;
}

export function ImagePreviewOverlay({ src, alt = "Generated", onClear, downloadName = "token.png" }: ImagePreviewOverlayProps) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = downloadName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative w-full h-full group">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {onClear && (
        <button
          onClick={onClear}
          className="absolute top-1 right-1 p-1 rounded-md bg-background/90 border border-border hover:bg-destructive/20 transition-colors z-10"
          title="Remove image"
        >
          <X className="h-3.5 w-3.5 text-foreground" />
        </button>
      )}
      <button
        onClick={handleDownload}
        className="absolute bottom-1 right-1 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity"
        title="Download image"
      >
        <Download className="h-3.5 w-3.5 text-foreground" />
      </button>
    </div>
  );
}
