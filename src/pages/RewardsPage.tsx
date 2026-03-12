import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { XIcon } from "@/components/icons/XIcon";
import { Gift, Users, Star, Clock, ExternalLink, Loader2, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";

interface SocialReward {
  id: string;
  twitter_username: string;
  twitter_name: string | null;
  twitter_avatar_url: string | null;
  twitter_followers: number;
  points: number;
  joined_at: string;
  last_checked_at: string | null;
}

interface RewardEvent {
  id: string;
  post_id: string;
  post_url: string | null;
  reward_type: string;
  points: number;
  created_at: string;
}

export default function RewardsPage() {
  const { isAuthenticated, login, user } = useAuth();
  const { user: privyUser, linkTwitter, ready } = usePrivy();
  const navigate = useNavigate();
  const [reward, setReward] = useState<SocialReward | null>(null);
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const twitterAccount = privyUser?.linkedAccounts?.find(
    (a: any) => a.type === "twitter_oauth"
  ) as any;

  const twitterLinked = !!twitterAccount;

  // Fetch reward data
  const fetchRewardData = useCallback(async () => {
    if (!twitterAccount?.username) return;
    
    setLoading(true);
    try {
      // Fetch user's reward record
      const { data: rewardData } = await supabase
        .from("social_rewards")
        .select("*")
        .eq("twitter_username", twitterAccount.username.toLowerCase())
        .maybeSingle();

      if (rewardData) {
        setReward(rewardData as any);

        // Fetch events
        const { data: eventsData } = await supabase
          .from("social_reward_events")
          .select("*")
          .eq("social_reward_id", rewardData.id)
          .order("created_at", { ascending: false })
          .limit(20);

        setEvents((eventsData || []) as any);
      }

      // Fetch total users
      const { count } = await supabase
        .from("social_rewards")
        .select("*", { count: "exact", head: true });

      setTotalUsers(count || 0);
    } catch (err) {
      console.error("Failed to fetch reward data:", err);
    } finally {
      setLoading(false);
    }
  }, [twitterAccount?.username]);

  useEffect(() => {
    if (twitterLinked) {
      fetchRewardData();
    } else {
      setLoading(false);
    }
  }, [twitterLinked, fetchRewardData]);

  // Join rewards program
  const handleJoin = async () => {
    if (!twitterAccount || !user) return;
    
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-rewards-join", {
        body: {
          privyDid: user.privyId,
          twitterUsername: twitterAccount.username,
          twitterName: twitterAccount.name || twitterAccount.username,
          twitterAvatarUrl: twitterAccount.profilePictureUrl || null,
          twitterFollowers: twitterAccount.followersCount || 0,
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success("Welcome to Social Rewards! 🎉");
        await fetchRewardData();
      } else {
        throw new Error(data?.error || "Failed to join");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to join rewards program");
    } finally {
      setJoining(false);
    }
  };

  // Handle X authorization
  const handleLinkTwitter = async () => {
    try {
      await linkTwitter();
    } catch (err) {
      console.warn("Twitter link cancelled:", err);
    }
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono text-foreground">Social Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Earn points by mentioning <span className="text-primary font-bold">$MOON</span> or tagging <span className="text-primary font-bold">@MoonDexo</span> in your posts on X.
          </p>
          <button
            onClick={() => login()}
            className="w-full py-3 rounded-xl font-mono text-sm font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all"
          >
            Login to get started
          </button>
        </div>
      </div>
    );
  }

  // Authenticated but X not linked
  if (!twitterLinked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <XIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono text-foreground">Connect your X account</h1>
          <p className="text-sm text-muted-foreground">
            To participate in Social Rewards, you need to authorize your X (Twitter) account.
          </p>
          <button
            onClick={handleLinkTwitter}
            className="w-full py-3 rounded-xl font-mono text-sm font-bold uppercase tracking-widest bg-foreground text-background hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <XIcon className="h-4 w-4" />
            Authorize X Account
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Twitter linked but not joined
  if (!reward) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            {twitterAccount.profilePictureUrl && (
              <img src={twitterAccount.profilePictureUrl} alt="" className="h-16 w-16 rounded-full border-2 border-primary/30" />
            )}
          </div>
          <h1 className="text-2xl font-bold font-mono text-foreground">
            Welcome, @{twitterAccount.username}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Join the Social Rewards program to earn points for mentioning <span className="text-primary font-bold">$MOON</span> or tagging <span className="text-primary font-bold">@MoonDexo</span>.
          </p>
          <div className="p-4 rounded-xl border border-border/40 bg-card/30 text-left space-y-2">
            <p className="text-xs font-mono text-muted-foreground"><Star className="inline h-3 w-3 mr-1 text-primary" /> 5 points per post with <span className="text-primary">$MOON</span></p>
            <p className="text-xs font-mono text-muted-foreground"><Star className="inline h-3 w-3 mr-1 text-primary" /> 5 points per post with <span className="text-primary">@MoonDexo</span></p>
            <p className="text-xs font-mono text-muted-foreground/60"><Zap className="inline h-3 w-3 mr-1" /> Posts checked every 10 minutes</p>
          </div>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-xl font-mono text-sm font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {joining ? "Joining..." : "Join Social Rewards"}
          </button>
          <p className="text-[10px] text-muted-foreground/40">
            {totalUsers} user{totalUsers !== 1 ? "s" : ""} already joined
          </p>
        </div>
      </div>
    );
  }

  // Main rewards dashboard
  return (
    <div className="min-h-screen p-4 pt-20 md:pt-24 max-w-2xl mx-auto space-y-6">
      {/* Profile card */}
      <div className="rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm p-6">
        <div className="flex items-center gap-4">
          {reward.twitter_avatar_url && (
            <img src={reward.twitter_avatar_url} alt="" className="h-16 w-16 rounded-full border-2 border-primary/30" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold font-mono text-foreground truncate">
              {reward.twitter_name || `@${reward.twitter_username}`}
            </h2>
            <a
              href={`https://x.com/${reward.twitter_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <XIcon className="h-3 w-3" />
              @{reward.twitter_username}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black font-mono text-primary">{reward.points}</div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Points</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/30 bg-card/15 p-3 text-center">
          <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-bold font-mono text-foreground">{totalUsers}</div>
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Total Users</div>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/15 p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-xs font-bold font-mono text-foreground">
            {new Date(reward.joined_at).toLocaleDateString()}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Joined</div>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/15 p-3 text-center">
          <Trophy className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-bold font-mono text-foreground">{events.length}</div>
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Rewards</div>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border/30 bg-card/10 p-4 space-y-2">
        <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">How to earn</h3>
        <p className="text-[11px] font-mono text-muted-foreground">
          <Star className="inline h-3 w-3 mr-1 text-primary" /> Post on X with <span className="text-primary font-bold">$MOON</span> → earn <span className="text-primary font-bold">5 points</span>
        </p>
        <p className="text-[11px] font-mono text-muted-foreground">
          <Star className="inline h-3 w-3 mr-1 text-primary" /> Post on X with <span className="text-primary font-bold">@MoonDexo</span> → earn <span className="text-primary font-bold">5 points</span>
        </p>
        <p className="text-[11px] font-mono text-muted-foreground/60">
          Both in the same post? Only one reward of 5 points (no double-dipping).
        </p>
      </div>

      {/* Recent reward events */}
      <div className="space-y-2">
        <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">Recent Rewards</h3>
        {events.length === 0 ? (
          <div className="rounded-xl border border-border/20 bg-card/10 p-6 text-center">
            <p className="text-xs text-muted-foreground font-mono">
              No rewards yet. Start posting about $MOON or @MoonDexo on X!
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/10 px-3 py-2">
                <Star className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-mono text-foreground">
                    +{event.points} pts — {event.reward_type === "moon_mention" ? "$MOON mention" : "@MoonDexo tag"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-2">
                    {new Date(event.created_at).toLocaleDateString()}
                  </span>
                </div>
                {event.post_url && (
                  <a href={event.post_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
