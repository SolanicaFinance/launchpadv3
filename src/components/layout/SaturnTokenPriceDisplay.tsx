import { TrendingUp } from "lucide-react";

/**
 * Placeholder Saturn token price display.
 * Shows $0.00 / +0.00% with a green "coming soon" feel.
 * Will be wired to real data once the token launches.
 */
export function SaturnTokenPriceDisplay() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/20 backdrop-blur-sm border border-border/20 hover:border-primary/30 transition-all duration-300 cursor-default group">
      {/* Saturn Logo */}
      <img
        src="/saturn-logo.png"
        alt="Saturn"
        className="h-4 w-4 rounded-full flex-shrink-0"
      />

      <span className="text-xs font-bold text-foreground/70 font-mono tracking-tight tabular-nums group-hover:text-foreground transition-colors">
        $0.00
      </span>

      <div className="flex items-center gap-0.5 text-[10px] font-bold font-mono px-1 py-0.5 rounded-md text-emerald-400 bg-emerald-500/10">
        <TrendingUp className="h-2.5 w-2.5" />
        <span className="tabular-nums">+0.00%</span>
      </div>
    </div>
  );
}
