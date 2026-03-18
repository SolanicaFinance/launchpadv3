import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTwitterProfile } from "@/hooks/useTwitterProfile";
import { supabase } from "@/integrations/supabase/client";
import { XIcon } from "@/components/icons/XIcon";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { RewardsLeaderboard } from "@/components/rewards/RewardsLeaderboard";
import {
  Gift, Users, Star, Clock, ExternalLink, Loader2, Trophy,
  Zap, Eye, Repeat2, MessageCircle, RefreshCw, Shield,
} from "lucide-react";
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

const REWARD_TYPE_MAP: Record<string, { label: string; icon: typeof Star; color: string }> = {
  mention: { label: "Post mention", icon: Star, color: "text-yellow-400" },
  moon_mention: { label: "$SATURN mention", icon: Star, color: "text-yellow-400" },
  saturn_tag: { label: "@saturnterminal tag", icon: Star, color: "text-yellow-400" },
  views: { label: "Views", icon: Eye, color: "text-blue-400" },
  retweets: { label: "Retweets", icon: Repeat2, color: "text-green-400" },
  comments: { label: "Comments", icon: MessageCircle, color: "text-purple-400" },
};

const COOLDOWN_MS = 60 * 60 * 1000;

export default function RewardsPage() {
  const { isAuthenticated, isLoading, ready, login, user, linkTwitter, linkedAccounts } = useAuth();
  const [reward, setReward] = useState<SocialReward | null>(null);
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [linking, setLinking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [cooldownText, setCooldownText] = useState("");

  const twitterAccount = linkedAccounts.find(
    (a: any) => a.type === "twitter_oauth"
  ) as any;
  const twitterLinked = !!twitterAccount;

  const { data: twitterProfile } = useTwitterProfile(twitterAccount?.username);

  // Cooldown timer
  useEffect(() => {
    if (!cooldownEnd) { setCooldownText(""); return; }
    const tick = () => {
      const remaining = cooldownEnd - Date.now();
      if (remaining <= 0) {
        setCooldownEnd(null);
        setCooldownText("");
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCooldownText(`${mins}m ${secs}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  const fetchRewardData = useCallback(async () => {
    if (!twitterAccount?.username) return;
    setLoading(true);
    try {
      const { data: rewardData } = await supabase
        .from("social_rewards")
        .select("*")
        .eq("twitter_username", twitterAccount.username.toLowerCase())
        .maybeSingle();

      if (rewardData) {
        setReward(rewardData as any);
        if (rewardData.last_checked_at) {
          const lastMs = new Date(rewardData.last_checked_at).getTime();
          const endMs = lastMs + COOLDOWN_MS;
          if (endMs > Date.now()) setCooldownEnd(endMs);
        }

        const { data: eventsData } = await supabase
          .from("social_reward_events")
          .select("*")
          .eq("social_reward_id", rewardData.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setEvents((eventsData || []) as any);
      }

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
    if (twitterLinked) fetchRewardData();
    else setLoading(false);
  }, [twitterLinked, fetchRewardData]);

  // Auto-join if Twitter linked but no reward row
  useEffect(() => {
    if (twitterLinked && !loading && !reward && !joining && user && twitterAccount) {
      handleJoin();
    }
  }, [twitterLinked, loading, reward, user]);

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

  const handleScan = async () => {
    if (!reward) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-social-rewards-user", {
        body: {
          twitterUsername: reward.twitter_username,
          socialRewardId: reward.id,
        },
      });
      if (error) throw error;

      if (data?.cooldown) {
        setCooldownEnd(new Date(data.nextUpdateAt).getTime());
        toast.info(data.message);
        return;
      }

      if (data?.success) {
        const pts = data.pointsEarned || 0;
        const checked = data.tweetsChecked || 0;
        toast.success(
          pts > 0
            ? `Found ${checked} new tweets! +${pts} points earned 🎉`
            : `Checked ${checked} tweets. No new qualifying mentions found.`
        );
        setCooldownEnd(new Date(data.nextUpdateAt).getTime());
        await fetchRewardData();
      } else {
        throw new Error(data?.error || "Scan failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scan tweets");
    } finally {
      setScanning(false);
    }
  };

  // Conflict state (kept from original)
  const [showConflictInput, setShowConflictInput] = useState(false);
  const [conflictUsername, setConflictUsername] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [alreadyLinkedInfo, setAlreadyLinkedInfo] = useState<any>(null);
  const [unlinking, setUnlinking] = useState(false);

  const handleLinkTwitter = async () => {
    setLinking(true);
    setAlreadyLinkedInfo(null);
    setShowConflictInput(false);
    try {
      await linkTwitter();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("closed") || msg.includes("cancelled")) {
        // noop
      } else if (msg.includes("already been linked") || msg.includes("already linked")) {
        toast.error("This X account is already linked to another session.");
        setShowConflictInput(true);
      } else {
        toast.error("Failed to link X account.");
      }
    } finally {
      setLinking(false);
    }
  };

  const handleLookupConflict = async () => {
    if (!conflictUsername.trim()) return;
    setLookingUp(true);
    try {
      const { data } = await supabase.functions.invoke("privy-unlink-twitter", {
        body: { twitterUsername: conflictUsername.trim().replace(/^@/, ""), action: "info", currentPrivyDid: user?.privyId },
      });
      if (data?.found) {
        setAlreadyLinkedInfo({ ...data, twitterUsername: conflictUsername.trim().replace(/^@/, "") });
        setShowConflictInput(false);
      } else {
        toast.error("No account found with that X username linked.");
      }
    } catch {
      toast.error("Lookup failed.");
    } finally {
      setLookingUp(false);
    }
  };

  const handleForceUnlink = async () => {
    if (!alreadyLinkedInfo?.twitterUsername) return;
    setUnlinking(true);
    try {
      const { data } = await supabase.functions.invoke("privy-unlink-twitter", {
        body: { twitterUsername: alreadyLinkedInfo.twitterUsername, action: "unlink", currentPrivyDid: user?.privyId },
      });
      if (data?.success) {
        toast.success("X account unlinked! You can now link it.");
        setAlreadyLinkedInfo(null);
      } else {
        toast.error(data?.message || "Failed to unlink");
      }
    } catch (err: any) {
      toast.error("Failed to unlink.");
    } finally {
      setUnlinking(false);
    }
  };

  // ─── RENDER STATES ───

  if (!ready || isLoading) {
    return (
      <LaunchpadLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </LaunchpadLayout>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <LaunchpadLayout>
        <div className="flex items-center justify-center p-4 min-h-[60vh]">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mx-auto">
              <Gift className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-mono text-foreground">Social Rewards</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Earn points by mentioning <span className="text-primary font-bold">$SATURN</span> or tagging{" "}
              <span className="text-primary font-bold">@saturnterminal</span> in your posts on X.
            </p>
            <button
              onClick={() => login()}
              className="w-full py-3.5 rounded-xl font-mono text-sm font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
            >
              Login to get started
            </button>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  // X not linked
  if (!twitterLinked) {
    return (
      <LaunchpadLayout>
        <div className="flex items-center justify-center p-4 min-h-[60vh]">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-foreground/10 border border-border mx-auto">
              <XIcon className="h-10 w-10 text-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-mono text-foreground">Connect your X account</h1>
            <p className="text-sm text-muted-foreground">
              Authorize your X (Twitter) account to participate in Social Rewards.
            </p>
            <button
              onClick={handleLinkTwitter}
              disabled={linking}
              className="w-full py-3.5 rounded-xl font-mono text-sm font-bold uppercase tracking-widest bg-foreground text-background hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <XIcon className="h-4 w-4" />}
              {linking ? "Authorizing..." : "Authorize X Account"}
            </button>

            {/* Conflict resolution */}
            {showConflictInput && !alreadyLinkedInfo && (
              <ConflictInput
                conflictUsername={conflictUsername}
                setConflictUsername={setConflictUsername}
                onLookup={handleLookupConflict}
                lookingUp={lookingUp}
              />
            )}
            {alreadyLinkedInfo && (
              <ConflictInfo
                info={alreadyLinkedInfo}
                unlinking={unlinking}
                onUnlink={handleForceUnlink}
              />
            )}
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  // Loading
  if (loading) {
    return (
      <LaunchpadLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </LaunchpadLayout>
    );
  }

  // Not joined — auto-join in progress
  if (!reward) {
    return (
      <LaunchpadLayout>
        <div className="flex items-center justify-center p-4 min-h-[60vh]">
          <div className="max-w-md w-full text-center space-y-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground font-mono">Setting up your rewards account...</p>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  // ─── MAIN DASHBOARD ───

  const verifiedType = twitterProfile?.verifiedType;
  const badgeType = verifiedType === "business" || (reward.twitter_followers ?? 0) >= 10000
    ? "gold"
    : verifiedType === "blue" || (reward.twitter_followers ?? 0) >= 1000
    ? "blue"
    : null;

  // Group events by post_url
  const eventsByPost = events.reduce<Record<string, RewardEvent[]>>((acc, ev) => {
    const key = ev.post_url || ev.post_id;
    (acc[key] = acc[key] || []).push(ev);
    return acc;
  }, {});

  return (
    <LaunchpadLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── LEFT COLUMN: Main Content ─── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Profile + Points Card */}
            <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-6">
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  {reward.twitter_avatar_url ? (
                    <img
                      src={reward.twitter_avatar_url}
                      alt=""
                      className="h-16 w-16 rounded-full border-2 border-primary/30 shadow-lg"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                      <XIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {badgeType && (
                    <VerifiedBadge
                      type={badgeType}
                      className="absolute -bottom-1 -right-1 h-5 w-5"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-mono text-foreground truncate">
                      {reward.twitter_name || `@${reward.twitter_username}`}
                    </h2>
                  </div>
                  <a
                    href={`https://x.com/${reward.twitter_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                    @{reward.twitter_username}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {(reward.twitter_followers ?? 0).toLocaleString()} followers
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Joined {new Date(reward.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <div className="text-4xl font-black font-mono text-primary leading-none">
                    {Math.round(reward.points ?? 0)}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">
                    Points
                  </div>
                </div>
              </div>

              {/* Update Data Button */}
              <div className="mt-5 pt-4 border-t border-border/20">
                <button
                  onClick={handleScan}
                  disabled={scanning || !!cooldownText}
                  className="w-full py-3 rounded-xl font-mono text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50
                    bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scanning tweets...
                    </>
                  ) : cooldownText ? (
                    <>
                      <Clock className="h-4 w-4" />
                      Next scan in {cooldownText}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Update Data
                    </>
                  )}
                </button>
                {reward.last_checked_at && (
                  <p className="text-[10px] font-mono text-muted-foreground/50 text-center mt-2">
                    Last scanned: {new Date(reward.last_checked_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<Users className="h-4 w-4" />} value={totalUsers.toString()} label="Users Joined" />
              <StatCard icon={<Trophy className="h-4 w-4" />} value={events.length.toString()} label="Rewards Earned" />
              <StatCard
                icon={<Zap className="h-4 w-4" />}
                value={events.filter((e) => e.reward_type === "mention").length.toString()}
                label="Posts Found"
              />
            </div>

            {/* Qualifying Posts */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Qualifying Posts
              </h3>
              {Object.keys(eventsByPost).length === 0 ? (
                <div className="rounded-xl border border-border/20 bg-card/10 p-8 text-center">
                  <XIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground font-mono">
                    No qualifying posts yet. Mention <span className="text-primary">$SATURN</span> or{" "}
                    <span className="text-primary">@saturnterminal</span> on X and click "Update Data"!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(eventsByPost).map(([postKey, postEvents]) => {
                    const totalPts = postEvents.reduce((s, e) => s + e.points, 0);
                    const postUrl = postEvents[0]?.post_url;
                    const date = postEvents[0]?.created_at;
                    return (
                      <div
                        key={postKey}
                        className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {postUrl && (
                              <a
                                href={postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                              >
                                <XIcon className="h-3 w-3" />
                                View Post
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {date && (
                              <span className="text-[10px] text-muted-foreground/50 font-mono">
                                {new Date(date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold font-mono text-primary">
                            +{Math.round(totalPts * 100) / 100} pts
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {postEvents.map((ev) => {
                            const info = REWARD_TYPE_MAP[ev.reward_type] || {
                              label: ev.reward_type,
                              icon: Star,
                              color: "text-muted-foreground",
                            };
                            const Icon = info.icon;
                            return (
                              <span
                                key={ev.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-[10px] font-mono"
                              >
                                <Icon className={`h-3 w-3 ${info.color}`} />
                                {info.label}: +{ev.points}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Sidebar ─── */}
          <div className="space-y-5">
            {/* Point System */}
            <PointSystemCard />

            {/* Leaderboard */}
            <RewardsLeaderboard currentUsername={reward.twitter_username} />
          </div>
        </div>
      </div>
    </LaunchpadLayout>
  );
}

// ─── SUB-COMPONENTS ───

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/15 p-4 text-center">
      <div className="text-muted-foreground mb-1.5 flex justify-center">{icon}</div>
      <div className="text-xl font-bold font-mono text-foreground">{value}</div>
      <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function PointSystemCard() {
  return (
    <div className="rounded-xl border border-border/30 bg-card/10 p-4 space-y-3">
      <h3 className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        Point System
      </h3>
      <p className="text-[11px] font-mono text-muted-foreground/70">
        Post on X mentioning <span className="text-primary font-bold">$SATURN</span> or{" "}
        <span className="text-primary font-bold">@saturnterminal</span> to earn:
      </p>
      <div className="space-y-2">
        {[
          { icon: Star, color: "text-yellow-400", pts: "5 pts", label: "per qualifying post" },
          { icon: Eye, color: "text-blue-400", pts: "0.2 pts", label: "per view" },
          { icon: Repeat2, color: "text-green-400", pts: "0.5 pts", label: "per retweet" },
          { icon: MessageCircle, color: "text-purple-400", pts: "0.3 pts", label: "per comment" },
        ].map(({ icon: Icon, color, pts, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 ${color} flex-shrink-0`} />
            <span className="text-[11px] font-mono text-muted-foreground">
              <span className="text-primary font-bold">{pts}</span> — {label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground/40 flex items-center gap-1">
        <Zap className="h-3 w-3" /> Click "Update Data" to scan your latest tweets (1h cooldown).
      </p>
    </div>
  );
}

function ConflictInput({
  conflictUsername, setConflictUsername, onLookup, lookingUp,
}: {
  conflictUsername: string;
  setConflictUsername: (v: string) => void;
  onLookup: () => void;
  lookingUp: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/20 p-4 text-left space-y-3">
      <p className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
        Resolve Account Conflict
      </p>
      <p className="text-[11px] font-mono text-muted-foreground">
        Enter your X username to find and unlink it from the old session.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="@username"
          value={conflictUsername}
          onChange={(e) => setConflictUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLookup()}
          className="flex-1 px-3 py-2 rounded-lg border border-border/40 bg-background/60 text-foreground font-mono text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
        />
        <button
          onClick={onLookup}
          disabled={lookingUp || !conflictUsername.trim()}
          className="px-4 py-2 rounded-lg font-mono text-xs font-bold bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 disabled:opacity-50 flex items-center gap-1.5"
        >
          {lookingUp ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {lookingUp ? "Looking up..." : "Look up"}
        </button>
      </div>
    </div>
  );
}

function ConflictInfo({
  info, unlinking, onUnlink,
}: {
  info: any;
  unlinking: boolean;
  onUnlink: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left space-y-3">
      <p className="text-xs font-mono font-bold text-destructive uppercase tracking-wider">
        Account Conflict Detected
      </p>
      <p className="text-[11px] font-mono text-muted-foreground">
        <span className="text-foreground font-bold">@{info.twitterUsername}</span> is linked to a different session.
      </p>
      <button
        onClick={onUnlink}
        disabled={unlinking}
        className="w-full py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-widest bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {unlinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {unlinking ? "Unlinking..." : "Unlink from old session & retry"}
      </button>
    </div>
  );
}
