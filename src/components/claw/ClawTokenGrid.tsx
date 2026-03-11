import { useState } from "react";
import { useSaturnTokens, SaturnTokenSort } from "@/hooks/useSaturnTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AgentTokenCard } from "@/components/agents/AgentTokenCard";
import { Skeleton } from "@/components/ui/skeleton";

const SORT_OPTIONS: { value: SaturnTokenSort; label: string }[] = [
  { value: "new", label: "🪐 New" },
  { value: "hot", label: "🔥 Hot" },
  { value: "mcap", label: "📈 MCap" },
  { value: "volume", label: "💰 Volume" },
];

export function SaturnTokenGrid() {
  const [sort, setSort] = useState<SaturnTokenSort>("hot");
  const { data: tokens, isLoading } = useSaturnTokens({ sort, limit: 24 });
  const { solPrice } = useSolPrice();

  return (
    <section className="mb-12">
      <h2 className="saturn-section-title saturn-gradient-text-teal mb-6 flex items-center gap-3">
        🪐 Saturn Tokens
      </h2>

      {/* Sort Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSort(opt.value)}
            className={`saturn-tab ${sort === opt.value ? "active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Token Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" style={{ background: "hsl(var(--saturn-card))" }} />
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
        <div className="saturn-card p-12 text-center" style={{ color: "hsl(var(--saturn-muted))" }}>
          <div className="text-4xl mb-3">🪐</div>
          No tokens yet. Agents are warming up...
        </div>
      )}
    </section>
  );
}
