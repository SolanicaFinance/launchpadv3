import { memo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Rocket, TrendingUp, Coins, Users } from "lucide-react";

interface NotLoggedInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotLoggedInModal = memo(function NotLoggedInModal({ open, onOpenChange }: NotLoggedInModalProps) {
  const handleGetStarted = () => {
    window.open("https://saturn-panel.com", "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[420px] p-0 gap-0 rounded-2xl overflow-hidden border-primary/20" style={{ background: "hsl(0 0% 7%)" }}>
        {/* Top accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="p-5 sm:p-6 space-y-5">
          {/* Icon + Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.12em] font-mono text-foreground">
              Welcome to Saturn Terminal
            </h3>
            <p className="text-[11px] sm:text-xs leading-relaxed text-muted-foreground max-w-[320px]">
              You need to create an account to start leverage trading or creating tokens.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-2">
            {[
              { icon: TrendingUp, text: "Leverage Trading with advanced tools" },
              { icon: Coins, text: "Create and launch tokens instantly" },
              { icon: Users, text: "Copy Trading & Portfolio Tracking" },
              { icon: Rocket, text: "Access the full terminal experience" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/30" style={{ background: "hsl(0 0% 10%)" }}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span className="text-[10px] sm:text-[11px] font-medium text-foreground/70 font-mono">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={handleGetStarted}
            className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-[0.15em] font-mono transition-all hover:brightness-110 active:scale-[0.98] bg-primary text-primary-foreground"
            style={{
              boxShadow: "0 4px 20px hsl(var(--primary) / 0.3), inset 0 1px 0 hsl(0 0% 100% / 0.1)",
            }}
          >
            Get Started
          </button>

          {/* Footer */}
          <p className="text-[9px] text-center text-muted-foreground/40 leading-relaxed font-mono">
            Saturn Terminal — Trade, launch, and manage digital assets with confidence.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
});
