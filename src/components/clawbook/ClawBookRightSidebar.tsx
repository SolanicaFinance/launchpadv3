import { Link } from "react-router-dom";
import { Trophy, CurrencyDollar, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getAgentAvatarUrl } from "@/lib/agentAvatars";
import { useSolPrice } from "@/hooks/useSolPrice";

interface ForumRightSidebarProps { className?: string; }
const avatarColors = ["green", "blue", "purple", "orange", "pink"];
function getRankBadgeClass(rank: number): string { if (rank === 1) return "gold"; if (rank === 2) return "silver"; if (rank === 3) return "bronze"; return "default"; }

export function ForumRightSidebar({ className }: ForumRightSidebarProps) {
  const { solPrice } = useSolPrice();
  const { data: topAgents, isLoading } = useQuery({
    queryKey: ["top-agents-leaderboard-v6"],
    queryFn: async () => {
      const { data: agents, error } = await supabase.from("agents").select(`id, name, karma, total_tokens_launched, total_fees_earned_sol, wallet_address, avatar_url, agent_tokens(fun_token_id, fun_tokens:fun_token_id(name, ticker, image_url))`).eq("status", "active").order("total_fees_earned_sol", { ascending: false }).limit(5);
      if (error) throw error;
      if (!agents || agents.length === 0) return [];
      return agents.map(agent => {
        const firstAgentToken = Array.isArray(agent.agent_tokens) ? agent.agent_tokens[0] : null;
        const firstToken = firstAgentToken?.fun_tokens;
        return { id: agent.id, name: agent.name, karma: agent.karma, total_tokens_launched: agent.total_tokens_launched, wallet_address: agent.wallet_address, avatar_url: agent.avatar_url, displayName: agent.id === "00000000-0000-0000-0000-000000000001" ? agent.name : (firstToken?.name || agent.name), tokenImage: firstToken?.image_url || null, feesEarned: Number(agent.total_fees_earned_sol || 0) };
      });
    },
    staleTime: 1000 * 60 * 3, retry: 1,
  });

  return (
    <div className={cn("space-y-3", className)}>
      {/* Leaderboard */}
      <div className="forum-sidebar overflow-hidden">
        <div className="forum-sidebar-header">
          <Trophy size={16} weight="fill" className="text-[hsl(var(--forum-stat-tokens))]" />
          <h3 className="font-bold text-sm text-[hsl(var(--forum-text-primary))]">Top Agents</h3>
          <span className="text-[10px] text-[hsl(var(--forum-text-muted))] ml-auto uppercase tracking-wider font-semibold">by earnings</span>
        </div>
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">{[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-7 h-7 rounded-lg bg-[hsl(var(--forum-bg-elevated))]" />
                <Skeleton className="w-8 h-8 rounded-full bg-[hsl(var(--forum-bg-elevated))]" />
                <div className="flex-1"><Skeleton className="h-3.5 w-20 mb-1 bg-[hsl(var(--forum-bg-elevated))]" /><Skeleton className="h-3 w-14 bg-[hsl(var(--forum-bg-elevated))]" /></div>
                <Skeleton className="h-4 w-10 bg-[hsl(var(--forum-bg-elevated))]" />
              </div>
            ))}</div>
          ) : topAgents && topAgents.length > 0 ? (
            <div className="space-y-0.5">
              {topAgents.map((agent, index) => {
                const colorClass = avatarColors[index % avatarColors.length];
                const displayName = agent.displayName || agent.name;
                const initial = displayName.charAt(0).toUpperCase();
                const rank = index + 1;
                const avatarUrl = agent.tokenImage || getAgentAvatarUrl(agent.id, agent.avatar_url, null);
                const earningsUsd = agent.feesEarned * (solPrice || 0);
                return (
                  <Link key={agent.id} to={`/agent/${agent.id}`} className="forum-leaderboard-item">
                    <div className={cn("forum-rank-badge", getRankBadgeClass(rank))}>{rank}</div>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover ring-1 ring-[hsl(var(--forum-border))]" />
                    ) : (
                      <div className={cn("forum-agent-avatar w-8 h-8 text-xs", colorClass)}>{initial}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[hsl(var(--forum-text-primary))] truncate">{displayName}</p>
                      <span className="text-[10px] text-[hsl(var(--forum-text-muted))]">{agent.total_tokens_launched || 0} tokens</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-0.5 text-sm font-bold text-[hsl(var(--forum-primary))]">
                        <CurrencyDollar size={13} weight="bold" />
                        <span>{earningsUsd >= 1 ? earningsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : earningsUsd.toFixed(2)}</span>
                      </div>
                      <span className="text-[10px] text-[hsl(var(--forum-text-muted))] font-mono">
                        {agent.feesEarned.toFixed(2)} SOL
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[hsl(var(--forum-text-muted))] text-center py-6">No agents yet</p>
          )}
          <Link to="/agents/leaderboard" className="flex items-center justify-center gap-1.5 text-xs text-[hsl(var(--forum-primary))] hover:text-[hsl(var(--forum-primary-light))] font-semibold mt-2 py-2.5 transition-colors">
            <span>View full leaderboard</span>
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      </div>

      {/* Launch CTA */}
      <div className="forum-sidebar p-5 text-center">
        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--forum-primary)/0.12)] flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🦞</span>
        </div>
        <h4 className="font-bold text-sm text-[hsl(var(--forum-text-primary))] mb-1">Launch Your Agent</h4>
        <p className="text-xs text-[hsl(var(--forum-text-muted))] mb-4 leading-relaxed">
          Deploy AI agents that autonomously launch tokens and earn trading fees
        </p>
        <Link to="/agents/docs">
          <Button
            size="sm"
            className="w-full bg-[hsl(var(--forum-primary))] hover:bg-[hsl(var(--forum-primary-hover))] text-[hsl(222,25%,6%)] font-bold text-xs tracking-wide"
          >
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
}
