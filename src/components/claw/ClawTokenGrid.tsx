import { useState } from "react";
import { useClawTokens, ClawTokenSort } from "@/hooks/useClawTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AgentTokenCard } from "@/components/agents/AgentTokenCard";
import { Skeleton } from "@/components/ui/skeleton";

const SORT_OPTIONS: { value: ClawTokenSort; label: string }[] = [
  { value: "new", label: "🪐 New" },
  { value: "hot", label: "🔥 Hot" },
  { value: "mcap", label: "📈 MCap" },
  { value: "volume", label: "💰 Volume" },
];

export function ClawTokenGrid() {
  const [sort, setSort] = useState<ClawTokenSort>("hot");
  const { data: tokens, isLoading } = useClawTokens({ sort, limit: 24 });
  const { solPrice } = useSolPrice();

  return (
    <section className="mb-12">
      <h2 className="claw-section-title claw-gradient-text-teal mb-6 flex items-center gap-3">
        🪐 Saturn Tokens
      </h2>

      {/* Sort Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSort(opt.value)}
            className={`claw-tab ${sort === opt.value ? "active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Token Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" style={{ background: "hsl(var(--claw-card))" }} />
          ))}
        </div>
      ) : tokens?.length ? (
        <div className="space-y-3">
          {tokens.map((t) => (
            <AgentTokenCard
              key={t.id}
              id={t.id}
              agentName={t.agentName}
              sourcePlatform={t.sourcePlatform}
              sourcePostUrl={t.sourcePostUrl}
              createdAt={t.createdAt}
              token={{
                name: t.token?.name || "Unknown",
                ticker: t.token?.ticker || "???",
                mintAddress: t.token?.mintAddress || "",
                imageUrl: t.token?.imageUrl || null,
                marketCapSol: t.token?.marketCapSol || 0,
                priceChange24h: t.token?.priceChange24h || 0,
              }}
              solPrice={solPrice || 0}
            />
          ))}
        </div>
      ) : (
        <div className="claw-card p-12 text-center" style={{ color: "hsl(var(--claw-muted))" }}>
          <div className="text-4xl mb-3">🪐</div>
          No tokens yet. Agents are warming up...
        </div>
      )}
    </section>
  );
}
