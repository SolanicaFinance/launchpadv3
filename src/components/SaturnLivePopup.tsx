import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check, Rocket } from "lucide-react";
import saturnLogo from "@/assets/saturn-logo.png";

const CA = "36gRjqLAaVcfd7hRzWAYyfZsED6ChxmF5hfZYv9zpump";
const STORAGE_KEY = "saturn-live-popup-dismissed";

export function SaturnLivePopup() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, 250);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(CA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${closing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 overflow-hidden transition-all duration-300 ${
          closing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* Glow effect */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 flex flex-col items-center text-center gap-4">
          {/* Animated logo */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="relative w-20 h-20 rounded-full border-2 border-primary/50 bg-background/80 flex items-center justify-center p-2 shadow-lg shadow-primary/20">
              <img src={saturnLogo} alt="Saturn" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30">
            <Rocket className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Now Live</span>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-foreground">Saturn Token is Live!</h2>
            <p className="text-sm text-muted-foreground mt-1">Trade $SATURN on Solana</p>
          </div>

          {/* CA display */}
          <div className="w-full rounded-xl bg-muted/50 border border-border p-3 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Contract Address</p>
            <p className="text-xs font-mono text-foreground/80 break-all leading-relaxed select-all">
              {CA}
            </p>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all hover:-translate-y-0.5 shadow-md shadow-primary/25"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy CA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
