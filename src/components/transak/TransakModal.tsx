import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface TransakModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetUrl: string | null;
}

export function TransakModal({ isOpen, onClose, widgetUrl }: TransakModalProps) {
  if (!widgetUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 bg-transparent border-none overflow-hidden rounded-2xl max-h-[85vh]">
        <DialogTitle className="sr-only">Buy Crypto</DialogTitle>
        <div className="relative w-full h-[680px] rounded-2xl overflow-hidden border border-border/30 shadow-2xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/40"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>

          <iframe
            src={widgetUrl}
            allow="camera;microphone;payment"
            className="w-full h-full border-none"
            title="Buy Crypto with Transak"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
