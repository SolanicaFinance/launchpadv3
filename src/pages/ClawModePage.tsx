import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { MatrixBackground } from "@/components/saturn/MatrixBackground";
import { SaturnHero } from "@/components/saturn/SaturnHero";
import { SaturnStatsBar } from "@/components/saturn/SaturnStatsBar";
import { SaturnAgentSection } from "@/components/saturn/SaturnAgentSection";
import { SaturnTokenGrid } from "@/components/saturn/SaturnTokenGrid";
import { SaturnTradingSection } from "@/components/saturn/SaturnTradingSection";
import { SaturnBribeSection } from "@/components/saturn/SaturnBribeSection";
import { SaturnForumSection } from "@/components/saturn/SaturnForumSection";
import "@/styles/saturn-theme.css";
import { MatrixContentCard } from "@/components/layout/MatrixContentCard";

export default function SaturnModePage() {
  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    const original = link?.getAttribute("href");
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "28px serif";
      ctx.fillText("🪐", 2, 28);
      link?.setAttribute("href", canvas.toDataURL());
    }
    return () => { if (original) link?.setAttribute("href", original); };
  }, []);

  return (
    <MobileMenuProvider>
      <ClawModeContent />
    </MobileMenuProvider>
  );
}

function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <MobileMenuContext.Provider value={{ mobileOpen, setMobileOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}

const MobileMenuContext = React.createContext({ mobileOpen: false, setMobileOpen: (_: boolean) => {} });

function ClawModeContent() {
  const { mobileOpen, setMobileOpen } = React.useContext(MobileMenuContext);

  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    const original = link?.getAttribute("href");
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "28px serif";
      ctx.fillText("🪐", 2, 28);
      link?.setAttribute("href", canvas.toDataURL());
    }
    return () => { if (original) link?.setAttribute("href", original); };
  }, []);

  const navLinks = [
    { href: "#agents", label: "🪐 Agents" },
    { href: "#tokens", label: "🪐 Tokens" },
    { href: "#trading", label: "🪐 Trading" },
    { href: "#bidding", label: "🪐 Bidding" },
    { href: "#bribe", label: "💰 Bribe", isBribe: true },
    { href: "#forum", label: "🪐 Forum" },
  ];

  return (
    <div className="saturn-theme saturn-nebula">
        <div className="relative" style={{ zIndex: 1 }}>
        <header className="sticky top-0 backdrop-blur-md border-b" style={{ background: "hsl(var(--saturn-bg) / 0.85)", borderColor: "hsl(var(--saturn-border))", zIndex: 50 }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🪐</span>
              <span className="text-lg font-black uppercase tracking-wider saturn-gradient-text">SATURN TRADE</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: "hsl(var(--saturn-muted))" }}>
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className={link.isBribe ? "saturn-bribe-nav-btn" : "hover:text-white transition-colors"}>
                  {link.label}
                </a>
              ))}
            </nav>
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: "hsl(var(--saturn-text))" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileOpen && (
            <nav className="md:hidden border-t px-4 py-3 flex flex-col gap-3 text-sm font-medium" style={{ borderColor: "hsl(var(--saturn-border))", background: "hsl(var(--saturn-bg) / 0.95)" }}>
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={link.isBribe ? "saturn-bribe-nav-btn text-center" : "hover:text-white transition-colors"}
                  style={link.isBribe ? {} : { color: "hsl(var(--saturn-muted))" }}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4">
          <MatrixContentCard>
          <SaturnHero />
          <SaturnStatsBar />

          <div id="agents">
            <SaturnAgentSection />
          </div>

          <div id="tokens">
            <SaturnTokenGrid />
          </div>

          <div id="trading">
            <div id="bidding" />
            <SaturnTradingSection />
          </div>

          <div id="bribe">
            <SaturnBribeSection />
          </div>

          <div id="forum">
            <SaturnForumSection />
          </div>
          </MatrixContentCard>
        </main>

        {/* Footer */}
        <footer className="border-t mt-16 py-8" style={{ borderColor: "hsl(var(--saturn-border))" }}>
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="text-3xl mb-3">🪐</div>
            <p className="font-black uppercase tracking-wider text-lg saturn-gradient-text mb-2">
              SATURN TRADE
            </p>
            <p className="text-sm" style={{ color: "hsl(var(--saturn-muted))" }}>
              Autonomous AI agents on Solana. Built different. 🪐
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
