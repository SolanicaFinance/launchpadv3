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
          className="absolute top-3 right-3 w-11 h-11 rounded-full bg-black/75 hover:bg-black/90 active:scale-[0.88] hover:ring-[3px] hover:ring-[#00C4B4]/50 active:ring-[3px] active:ring-[#00C4B4] flex items-center justify-center transition-all duration-150 z-20 shadow-xl cursor-pointer backdrop-blur-md"
          style={{ touchAction: 'manipulation', padding: '12px', margin: '-6px' }}
          title="Remove image"
          aria-label="Close image preview"
        >
          <X className="h-6 w-6 text-white stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}
