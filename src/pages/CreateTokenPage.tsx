import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { TokenLauncher } from "@/components/launchpad/TokenLauncher";
import { BnbLauncher } from "@/components/launchpad/BnbLauncher";
import { Rocket, ExternalLink, CheckCircle2, ArrowLeft, Shield, Zap, Coins, Copy, Check } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useChain } from "@/contexts/ChainContext";
import { useToast } from "@/hooks/use-toast";

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
  const { chain } = useChain();
  const isBnb = chain === 'bnb';

  const handleReset = () => setLastResult(null);
  const handleLaunchSuccess = useCallback(() => {}, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 relative">
          {/* Ambient orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="launch-page-orb launch-page-orb-1" />
            <div className="launch-page-orb launch-page-orb-2" />
            <div className="launch-page-orb launch-page-orb-3" />
            <div className="launch-page-orb-4" />
          </div>

          {/* Back link */}
          <div className="relative z-10 max-w-5xl mx-auto px-4 pt-6">
            <Link
              to="/terminal"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors duration-200 group"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              Back to Terminal
            </Link>
          </div>

          {/* Hero Section */}
          <div className="relative z-10 max-w-5xl mx-auto px-4 pt-8 md:pt-16 pb-6">
            <div className="text-center space-y-4">
              {/* Neon icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl launch-hero-icon-badge mb-2">
                <Rocket className="w-7 h-7 text-foreground" />
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Launch Your Token on{" "}
                <span className="launch-hero-gradient-text">
                  {isBnb ? "BNB Chain" : "Saturn"}
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {isBnb
                  ? "Create BEP-20 tokens with SaturnPortal bonding curve — fair launch, auto PancakeSwap migration"
                  : "Create fast, fair, AI-powered memecoins — atomic dev buy, zero frontrun, instant trading"}
              </p>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                {isBnb ? (
                  <>
                    <span className="launch-trust-badge">
                      <span className="text-sm">🟡</span>
                      BNB Chain
                    </span>
                    <span className="launch-trust-badge">
                      <Coins className="w-3 h-3 text-primary" />
                      <span className="font-mono">BEP-20</span>
                    </span>
                    <span className="launch-trust-badge">
                      <Zap className="w-3 h-3 text-primary" />
                      Bonding Curve
                    </span>
                    <span className="launch-trust-badge">
                      <Shield className="w-3 h-3 text-success" />
                      PancakeSwap
                    </span>
                  </>
                ) : (
                  <>
                    <span className="launch-trust-badge">
                      <img src="/phantom-icon.png" alt="" className="w-3.5 h-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      Phantom
                    </span>
                    <span className="launch-trust-badge">
                      <Coins className="w-3 h-3 text-primary" />
                      <span className="font-mono">~0.02 SOL</span>
                    </span>
                    <span className="launch-trust-badge">
                      <Zap className="w-3 h-3 text-primary" />
                      Bonding Curve
                    </span>
                    <span className="launch-trust-badge">
                      <Shield className="w-3 h-3 text-success" />
                      Anti-Snipe
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main content: form */}
          <div className="relative z-10 max-w-[640px] mx-auto px-4">
            {isBnb ? (
              <div className="launch-page-form-container rounded-2xl p-6 md:p-8">
                <BnbLauncher />
              </div>
            ) : lastResult?.success && lastResult.mintAddress ? (
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
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCA = () => {
    if (!result.mintAddress) return;
    navigator.clipboard.writeText(result.mintAddress);
    setCopied(true);
    toast({ title: "Copied!", description: "Contract address copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-400 max-w-[640px] mx-auto">
      {/* LIVE banner */}
      <div className="text-center">
        <span
          className="inline-block text-2xl md:text-3xl font-black tracking-tight"
          style={{
            color: "hsl(142, 71%, 45%)",
            textShadow: "0 0 20px hsl(142 71% 45% / 0.5), 0 0 40px hsl(142 71% 45% / 0.25)",
          }}
        >
          Your token is LIVE 🚀
        </span>
      </div>

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
            {result.name} (${result.ticker})
          </p>
          {/* Clickable CA */}
          <button
            onClick={handleCopyCA}
            className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground font-mono hover:text-foreground transition-colors group"
            title="Click to copy contract address"
          >
            <span className="truncate max-w-[320px]">{result.mintAddress}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            ) : (
              <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100 flex-shrink-0" />
            )}
          </button>
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
        {result.mintAddress && (
          <button
            onClick={() => navigate(`/trade/${result.mintAddress}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-primary hover:brightness-110 transition-all hover:scale-[1.02] duration-200"
            style={{
              background: "hsl(var(--primary) / 0.08)",
              border: "1px solid hsl(var(--primary) / 0.2)",
            }}
          >
            Trade
          </button>
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
          onClick={() => navigate("/terminal")}
          className="flex-1 py-3.5 rounded-xl text-sm font-medium text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-all active:scale-[0.97] duration-200"
        >
          Back to Terminal
        </button>
      </div>
    </div>
  );
}
