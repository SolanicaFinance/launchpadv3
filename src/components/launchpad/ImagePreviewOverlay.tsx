import { X } from "lucide-react";

interface ImagePreviewOverlayProps {
  src: string;
  alt?: string;
  onClear?: () => void;
  downloadName?: string;
}

export function ImagePreviewOverlay({ src, alt = "Generated", onClear }: ImagePreviewOverlayProps) {
  return (
    <div className="relative w-full h-full">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {onClear && (
        <button
          onClick={onClear}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors z-10 shadow-lg"
          title="Remove image"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      )}
    </div>
  );
}
