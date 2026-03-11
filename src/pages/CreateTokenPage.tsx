import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { Rocket, ExternalLink, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  tokenId?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

export default function CreateTokenPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastResult, setLastResult] = useState<LaunchResult | null>(null);
  const navigate = useNavigate();

  const handleReset = () => setLastResult(null);
  const handleLaunchSuccess = useCallback(() => {}, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-8 md:py-12">
          {/* Floating ambient orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="launch-page-orb launch-page-orb-1" />
            <div className="launch-page-orb launch-page-orb-2" />
            <div className="launch-page-orb launch-page-orb-3" />
          </div>

          <div className="relative z-10 max-w-[620px] mx-auto">
            {/* Page header */}
            <div className="mb-8 md:mb-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="launch-page-icon-badge">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
                    Launch Token
                  </h1>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5 font-mono tracking-wide">
                    via Phantom Wallet
                  </p>
                </div>
              </div>
              {/* Neon gradient divider */}
              <div className="mt-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            </div>

            {/* Form or Success */}
            {lastResult?.success && lastResult.mintAddress ? (
              <SuccessResult result={lastResult} onReset={handleReset} />
            ) : (
              <div className="launch-page-form-container rounded-2xl p-6 md:p-8">
                <TokenLauncher
                  bare
                  defaultMode="phantom"
                  onLaunchSuccess={handleLaunchSuccess}
                  onShowResult={(result) => setLastResult(result as LaunchResult)}
                />
              </div>
            )}
          </div>

          {/* Bottom spacer */}
          <div className="h-32 md:h-40" />
        </main>

        <Footer />
      </div>
    </div>
  );
}

function SuccessResult({
  result,
  onReset,
}: {
  result: LaunchResult;
  onReset: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in duration-400 max-w-[620px] mx-auto">
      {/* Token card */}
      <div className="launch-page-form-container rounded-2xl p-6 flex items-center gap-4">
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
          <p className="text-[11px] text-muted-foreground font-mono truncate mt-1.5">
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
              background: "hsl(var(--primary) / 0.08)",
              border: "1px solid hsl(var(--primary) / 0.2)",
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
          className="flex-1 py-3.5 rounded-xl text-sm font-bold text-primary-foreground bg-primary transition-all active:scale-[0.97] hover:scale-[1.02] hover:shadow-lg duration-200"
        >
          Launch Another
        </button>
        <button
          onClick={() => navigate("/launchpad")}
          className="flex-1 py-3.5 rounded-xl text-sm font-medium text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-all active:scale-[0.97] duration-200"
        >
          Back to Launchpad
        </button>
      </div>
    </div>
  );
}
