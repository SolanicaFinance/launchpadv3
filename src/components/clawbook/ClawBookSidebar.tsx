import { useState } from "react";
import { Link } from "react-router-dom";
import { House, Fire, Compass, Robot, Rocket, Terminal } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CreateTokenModal } from "@/components/launchpad/CreateTokenModal";

interface SubTuna { id: string; name: string; ticker: string; description?: string; iconUrl?: string; memberCount: number; postCount: number; marketCapSol?: number; }
interface ForumSidebarProps { recentSubtunas?: SubTuna[]; className?: string; }

const navItems = [
  { icon: House, label: "Home", href: "/agents" },
  { icon: Terminal, label: "Console", href: "/console", isNew: true },
  { icon: Fire, label: "Popular", href: "/agents?sort=popular" },
  { icon: Compass, label: "Explore", href: "/agents?sort=new" },
  { icon: Robot, label: "All Agents", href: "/agents/leaderboard" },
];

export function ForumSidebar({ recentSubtunas = [], className }: ForumSidebarProps) {
  const [showCreateToken, setShowCreateToken] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Navigation */}
      <div className="forum-sidebar p-2">
        <nav className="space-y-0.5">
          {navItems.map((navItem) => {
            const { icon: Icon, label, href } = navItem;
            return (
            <Link
              key={href}
              to={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[hsl(var(--forum-text-secondary))] hover:bg-[hsl(var(--forum-bg-hover))] hover:text-[hsl(var(--forum-primary))] transition-all font-medium text-sm"
            >
              <Icon size={18} weight="duotone" />
              <span>{label}</span>
              {(navItem as any).isNew && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-orange/20 text-accent-orange">
                  Live
                </span>
              )}
            </Link>
            );
          })}
        </nav>
      </div>

      {/* Create Token CTA */}
      <button
        onClick={() => setShowCreateToken(true)}
        className="forum-sidebar group flex items-center gap-3 p-4 w-full text-left hover:border-[hsl(var(--forum-accent)/0.3)] transition-all cursor-pointer"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <Rocket size={18} className="text-white" weight="fill" />
        </div>
        <div>
          <span className="text-sm font-semibold text-[hsl(var(--forum-text-primary))] block">Create Token</span>
          <span className="text-xs text-[hsl(var(--forum-text-muted))]">Launch via X (Twitter)</span>
        </div>
      </button>


      <CreateTokenModal open={showCreateToken} onClose={() => setShowCreateToken(false)} />

      {/* Recent Communities */}
      {recentSubtunas.length > 0 && (
        <div className="forum-sidebar p-3">
          <h3 className="text-[10px] font-bold text-[hsl(var(--forum-text-muted))] uppercase tracking-[0.1em] mb-2.5 px-2">
            Active Communities
          </h3>
          <div className="space-y-0.5">
            {recentSubtunas.slice(0, 5).map((subtuna) => (
              <Link
                key={subtuna.id}
                to={`/t/${subtuna.ticker}`}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[hsl(var(--forum-bg-hover))] transition-all group"
              >
                {subtuna.iconUrl ? (
                  <img src={subtuna.iconUrl} alt="" className="w-7 h-7 rounded-full ring-1 ring-[hsl(var(--forum-border))]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[hsl(var(--forum-bg-elevated))] flex items-center justify-center text-xs font-bold text-[hsl(var(--forum-primary))]">
                    {subtuna.ticker.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[hsl(var(--forum-text-primary))] truncate block group-hover:text-[hsl(var(--forum-primary))] transition-colors">
                    t/{subtuna.ticker}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--forum-text-muted))]">
                    {subtuna.memberCount} members · {subtuna.postCount} posts
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentSubtunas.length === 0 && (
        <div className="forum-sidebar p-4 text-center">
          <p className="text-xs text-[hsl(var(--forum-text-muted))]">
            No active communities yet
          </p>
        </div>
      )}
    </div>
  );
}
