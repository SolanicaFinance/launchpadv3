import { useState } from "react";
import { LaunchTokenForm, WalletBalanceCard } from "@/components/launchpad";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { useChain } from "@/contexts/ChainContext";
import { Rocket, Info, Zap } from "lucide-react";

export default function LaunchTokenPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { chain, chainConfig } = useChain();
  const isBnb = chain === 'bnb';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-8 border-l-2 border-primary pl-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              <h1 className="font-mono text-sm text-primary uppercase tracking-widest">Create Token</h1>
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-1 tracking-wide">
              Launch on {chainConfig.name} · {isBnb ? 'PancakeSwap V2 · Direct DEX' : 'Bonding curve · Instant trading'}
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            {/* Left: Form */}
            <div>
              <LaunchTokenForm />
            </div>

            {/* Right: Sticky Sidebar */}
            <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
              <WalletBalanceCard minRequired={isBnb ? 0.01 : 0.1} />

              {/* Platform Info Card */}
              <div className="glass-surface rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4 border-l-2 border-primary pl-2">
                  <Info className="w-3 h-3 text-primary" />
                  <span className="font-mono text-[10px] text-primary uppercase tracking-widest">Platform Info</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground uppercase">Chain</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
                      <span className="font-mono text-xs text-foreground">{chainConfig.name}</span>
                    </div>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground uppercase">Platform Fee</span>
                    <span className="font-mono text-xs text-foreground">{isBnb ? '0.5%' : '1%'}</span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground uppercase">Creator Fee</span>
                    <span className="font-mono text-xs text-foreground">{isBnb ? '80% of trading fees' : '50% of trading fees'}</span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground uppercase">Total Supply</span>
                    <span className="font-mono text-xs text-foreground">1,000,000,000</span>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground uppercase">Standard</span>
                    <span className="font-mono text-xs text-foreground">{isBnb ? 'BEP-20' : 'SPL Token'}</span>
                  </div>
                </div>
              </div>

              {/* Tip Card */}
              <div className="rounded-xl p-5 border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="font-mono text-[10px] text-primary uppercase tracking-widest">Pro Tip</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  {isBnb ? (
                    <>We recommend ≥ <span className="text-primary font-semibold">0.1 BNB</span> seed liquidity for healthy price discovery on PancakeSwap.</>
                  ) : (
                    <>We recommend ≥ <span className="text-primary font-semibold">0.5 SOL</span> initial buy to avoid snipers and ensure healthy price discovery.</>
                  )}
                </p>
              </div>

              {/* Launch steps */}
              <div className="glass-surface rounded-xl p-5">
                <div className="border-l-2 border-primary pl-2 mb-4">
                  <span className="font-mono text-[10px] text-primary uppercase tracking-widest">How It Works</span>
                </div>
                <div className="space-y-3">
                  {(isBnb ? [
                    { n: "01", t: "Fill token details" },
                    { n: "02", t: "Set seed BNB amount" },
                    { n: "03", t: "Deploy to PancakeSwap" },
                    { n: "04", t: "Token goes live instantly" },
                  ] : [
                    { n: "01", t: "Fill token details" },
                    { n: "02", t: "Set initial buy amount" },
                    { n: "03", t: "Bitcoin genesis confirmation" },
                    { n: "04", t: "Token goes live on-chain" },
                  ]).map(({ n, t }) => (
                    <div key={n} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-primary w-5">{n}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
