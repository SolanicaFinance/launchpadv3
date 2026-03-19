import { useState, memo } from "react";
import { TrendingUp } from "lucide-react";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";

export const LeverageTradingBanner = memo(function LeverageTradingBanner() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full trade-glass-panel flex items-center gap-3 px-4 py-3 transition-all hover:bg-white/[0.04] active:scale-[0.99] group"
      >
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[12px] font-mono font-bold text-foreground/90 tracking-wide">
            Leverage Trade up to 80×
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/50">
            Advanced tools & deep liquidity
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary shrink-0 group-hover:underline">
          Start →
        </span>
      </button>
      <NotLoggedInModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
});
