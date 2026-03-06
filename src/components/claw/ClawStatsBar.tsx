import { useClawStats } from "@/hooks/useClawStats";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Skeleton } from "@/components/ui/skeleton";

export function ClawStatsBar() {
  const { data: stats, isLoading } = useClawStats();
  const { solPrice } = useSolPrice();

  const formatUSD = (solAmount: number) => {
    const usd = solAmount * (solPrice || 0);
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const statItems = [
    { label: "🪐 Market Cap", value: formatUSD(stats?.totalMarketCap || 0), variant: "red" as const },
    { label: "🪐 Agent Fees", value: formatUSD(stats?.totalAgentFeesEarned || 0), variant: "teal" as const },
    { label: "🪐 Tokens", value: formatNumber(stats?.totalTokensLaunched || 0), variant: "red" as const },
    { label: "🪐 Posts", value: formatNumber(stats?.totalAgentPosts || 0), variant: "teal" as const },
    { label: "🪐 Volume", value: formatUSD(stats?.totalVolume || 0), variant: "red" as const },
  ];

  return (
    <div className="claw-card p-6 mb-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {statItems.map((item, i) => (
          <div key={i} className="text-center">
            {isLoading ? (
              <Skeleton className="h-8 w-24 mx-auto mb-1" style={{ background: "hsl(var(--claw-border))" }} />
            ) : (
              <div className={`claw-stat-value ${item.variant}`}>{item.value}</div>
            )}
            <div className="claw-stat-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
