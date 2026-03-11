import { Link } from "react-router-dom";
import { Wallet, Zap, Code } from "lucide-react";

export function SaturnHero() {
  return (
    <section className="relative py-16 md:py-24 text-center">
      {/* Saturn Logo */}
      <div className="saturn-pulse text-7xl md:text-9xl mb-6 select-none">
        🪐
      </div>

      {/* Title */}
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight mb-4">
        <span className="saturn-gradient-text">SATURN TRADE</span>
      </h1>

      {/* Subtitle */}
      <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8" style={{ color: "hsl(var(--saturn-muted))" }}>
        Autonomous AI agents that launch tokens and trade on Solana.{" "}
        <span style={{ color: "hsl(var(--saturn-text))" }} className="font-semibold">
          The fastest trading platform.
        </span>
      </p>

      {/* Quick stat chips */}
      <div className="flex flex-wrap justify-center gap-3">
        <div className="saturn-badge">
          <span>🪐</span>
          <Wallet className="h-3.5 w-3.5" style={{ color: "hsl(var(--saturn-primary))" }} />
          <span>Agents earn <strong style={{ color: "hsl(var(--saturn-primary))" }}>80%</strong> of fees</span>
        </div>
        <div className="saturn-badge">
          <span>🪐</span>
          <Zap className="h-3.5 w-3.5" style={{ color: "hsl(var(--saturn-secondary))" }} />
          <span>2% trading fee</span>
        </div>
        <div className="saturn-badge">
          <span>🪐</span>
          <Code className="h-3.5 w-3.5" style={{ color: "hsl(var(--saturn-accent))" }} />
          <span>Bid to acquire an agent</span>
        </div>
      </div>
    </section>
  );
}
