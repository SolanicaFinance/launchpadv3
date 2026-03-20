import { useState, useEffect, memo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TrendingUp, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "saturn_leverage_popup_seen_v1";

export const LeverageTradingPopup = memo(function LeverageTradingPopup() {
  const [open, setOpen] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {}
  }, []);

  const handleClose = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  const handleStartNow = () => {
    handleClose();
    login();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[440px] p-0 gap-0 rounded-2xl overflow-hidden border-primary/20"
        style={{ background: "hsl(0 0% 7%)" }}
      >
        {/* Top accent */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/40 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Icon + Header */}
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20"
              style={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.15)" }}
            >
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-[0.1em] font-mono text-foreground">
                Leverage Trading
              </h3>
              <p className="text-2xl sm:text-3xl font-black text-primary font-mono">
                UP TO 80×
              </p>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-[340px]">
              Trade your favorite pairs with up to 80× leverage. Advanced tools, deep liquidity, and lightning-fast execution.
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleStartNow}
            className="w-full py-4 rounded-xl text-sm sm:text-base font-black uppercase tracking-[0.15em] font-mono transition-all hover:brightness-110 active:scale-[0.98] bg-primary text-primary-foreground"
            style={{
              boxShadow: "0 4px 24px hsl(var(--primary) / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.1)",
            }}
          >
            Start Now
          </button>

          {/* Dismiss link */}
          <button
            onClick={handleClose}
            className="w-full text-center text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors font-mono"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});