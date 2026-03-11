import { useState, useRef } from "react";
import { X, Rocket, ExternalLink, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";

interface CreateTokenModalProps {
  open: boolean;
  onClose: () => void;
}

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  solscanUrl?: string;
  tradeUrl?: string;
}

export function CreateTokenModal({ open, onClose }: CreateTokenModalProps) {
  const isMobile = useIsMobile();
  const [lastResult, setLastResult] = useState<LaunchResult | null>(null);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleReset = () => setLastResult(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />

      {/* Floating neon orbs for depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="launch-modal-orb launch-modal-orb-1" />
        <div className="launch-modal-orb launch-modal-orb-2" />
        <div className="launch-modal-orb launch-modal-orb-3" />
      </div>

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-[95%] md:w-full flex flex-col overflow-hidden",
          "launch-modal-enter",
          "max-h-[85dvh] rounded-t-[20px] md:rounded-2xl",
          "md:max-w-[560px] md:mx-auto",
          "launch-modal-container",
          "mb-24 md:mb-0",
        )}
      >
        {/* Neon border glow overlay */}
        <div className="absolute inset-0 rounded-t-[20px] md:rounded-2xl pointer-events-none launch-modal-border-glow" />

        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 md:px-7 pt-5 md:pt-6 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="launch-modal-icon-badge">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                Launch Token
              </h2>
              <p className="text-[11px] text-white/30 font-medium mt-0.5 font-mono tracking-wide">
                via Phantom Wallet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] hover:rotate-90 active:scale-90 transition-all duration-300 group"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5 text-white/40 group-hover:text-white/70 transition-colors" />
          </button>
        </div>

        {/* Separator */}
        <div className="mx-6 md:mx-7 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 md:px-7 pt-5 pb-8 scrollbar-thin launch-modal-content">
          {lastResult?.success && lastResult.mintAddress ? (
            <SuccessResult result={lastResult} onReset={handleReset} onClose={onClose} />
          ) : (
            <TokenLauncher
              bare
              defaultMode="phantom"
              onLaunchSuccess={() => {}}
              onShowResult={(result) => setLastResult(result as LaunchResult)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessResult({
  result,
  onReset,
  onClose,
}: {
  result: LaunchResult;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-400">
      {/* Token card */}
      <div className="launch-modal-success-card rounded-2xl p-6 flex items-center gap-4">
        {result.imageUrl ? (
          <img
            src={result.imageUrl}
            alt={result.name}
            className="w-16 h-16 rounded-xl object-cover ring-2 ring-emerald-500/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-emerald-300 tracking-tight">
            {result.name} (${result.ticker}) launched! 🚀
          </p>
          <p className="text-[11px] text-white/30 font-mono truncate mt-1.5">
            {result.mintAddress}
          </p>
        </div>
      </div>

      {/* Action links */}
      <div className="flex gap-3">
        {result.solscanUrl && (
          <a
            href={result.solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-all hover:scale-[1.02] duration-200"
            style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}
          >
            Solscan <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {result.tradeUrl && (
          <a
            href={result.tradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-primary hover:brightness-110 transition-all hover:scale-[1.02] duration-200"
            style={{
              background: "hsl(72 100% 50% / 0.08)",
              border: "1px solid hsl(72 100% 50% / 0.2)",
            }}
          >
            Trade <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex-1 py-3.5 rounded-xl text-sm font-bold text-black transition-all active:scale-[0.97] hover:scale-[1.02] hover:shadow-lg duration-200"
          style={{ background: "hsl(72 100% 50%)", boxShadow: "0 6px 24px hsl(72 100% 50% / 0.25)" }}
        >
          Launch Another
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl text-sm font-medium text-white/50 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.97] duration-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
