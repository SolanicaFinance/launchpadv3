import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardEntry {
  id: string;
  twitter_username: string;
  twitter_name: string | null;
  twitter_avatar_url: string | null;
  points: number | null;
}

interface Props {
  currentUsername?: string;
}

export function RewardsLeaderboard({ currentUsername }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("social_rewards")
        .select("id, twitter_username, twitter_name, twitter_avatar_url, points")
        .order("points", { ascending: false, nullsFirst: false })
        .limit(20);
      setEntries((data || []) as LeaderboardEntry[]);
      setLoading(false);
    })();
  }, []);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Trophy className={`h-4 w-4 ${getRankStyle(rank)}`} />;
    return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Medal className="h-4 w-4 text-primary" /> Leaderboard
        </h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 bg-card/10 p-4">
        <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
          <Medal className="h-4 w-4 text-primary" /> Leaderboard
        </h3>
        <p className="text-xs text-muted-foreground font-mono text-center py-4">No participants yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/10 p-4">
      <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
        <Medal className="h-4 w-4 text-primary" /> Leaderboard
      </h3>
      <div className="space-y-1">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const isCurrent = currentUsername && entry.twitter_username.toLowerCase() === currentUsername.toLowerCase();
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                isCurrent
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/30"
              }`}
            >
              <div className="w-6 flex-shrink-0 flex justify-center">
                {getRankIcon(rank)}
              </div>
              {entry.twitter_avatar_url ? (
                <img
                  src={entry.twitter_avatar_url}
                  alt=""
                  className="h-7 w-7 rounded-full border border-border/30 flex-shrink-0"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <XIcon className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-mono truncate ${isCurrent ? "text-primary font-bold" : "text-foreground"}`}>
                  @{entry.twitter_username}
                </p>
              </div>
              <span className={`text-xs font-mono font-bold ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                {entry.points ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
