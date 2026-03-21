import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Loader2, RefreshCw, DollarSign, CheckCircle2, Clock, ExternalLink, Wallet, Crown, LogIn } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";

interface MeteoriteToken {
  id: string;
  tweet_url: string;
  tweet_author: string | null;
  tweet_content: string | null;
  token_name: string | null;
  token_ticker: string | null;
  mint_address: string | null;
  pumpfun_url: string | null;
  image_url: string | null;
  status: string;
  total_fees_earned: number;
  created_at: string;
  owner_claimed_at?: string | null;
  owner_claimed_sol?: number | null;
}

interface EligibleReply {
  meteorite_token_id: string;
  twitter_username: string;
  twitter_display_name: string;
  twitter_avatar_url: string;
  verified_type: string;
  is_shadowbanned: boolean;
  reply_text: string;
  reply_id: string;
}

interface ReplyClaim {
  id: string;
  meteorite_token_id: string;
  twitter_username: string;
  claim_amount_sol: number;
  status: string;
  claimed_at: string | null;
  claim_wallet_address: string | null;
  claim_tx_signature: string | null;
}

interface Props {
  token: MeteoriteToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MeteoriteTokenDetail({ token, open, onOpenChange }: Props) {
  const { isAuthenticated, login, linkTwitter, linkedAccounts, isLoading: authLoading, ready } = useAuth();
  const { walletAddress } = useSolanaWalletWithPrivy();

  const twitterAccount = linkedAccounts.find((a: any) => a.type === "twitter_oauth") as any;
  const twitterLinked = !!twitterAccount;
  const myUsername = twitterAccount?.username?.toLowerCase() || null;

  const [replies, setReplies] = useState<EligibleReply[]>([]);
  const [claims, setClaims] = useState<ReplyClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimingOwner, setClaimingOwner] = useState(false);
  const [linking, setLinking] = useState(false);

  const fetchReplies = useCallback(async () => {
    if (!token?.id) return;
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/meteorite-fetch-replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meteoriteTokenId: token.id }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplies(data.replies || []);
      setClaims(data.claims || []);
      setLastRefreshed(data.lastRefreshedAt);
      setCached(data.cached);
      if (!data.cached) {
        toast.success(`Found ${data.replies?.length || 0} eligible verified commenters`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch replies");
    } finally {
      setLoading(false);
    }
  }, [token?.id]);

  useEffect(() => {
    if (open && token?.id) fetchReplies();
  }, [open, token?.id, fetchReplies]);

  const getClaimForUser = (username: string) =>
    claims.find((c) => c.twitter_username === username);

  // Check if current user is eligible
  const myEligibility = myUsername ? replies.find(r => r.twitter_username === myUsername) : null;
  const myClaim = myUsername ? getClaimForUser(myUsername) : null;
  const myIsClaimed = myClaim?.status === "claimed";

  // Check if current user is the tweet owner
  const isOwner = myUsername && token?.tweet_author && myUsername === token.tweet_author.toLowerCase().replace("@", "");

  const handleClaimReply = async () => {
    if (!walletAddress) { toast.error("No wallet connected"); return; }
    if (!myUsername) return;
    setClaiming(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/meteorite-claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meteoriteTokenId: token!.id,
            twitterUsername: myUsername,
            walletAddress,
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Claimed ${data.amountSol} SOL! TX: ${data.signature?.slice(0, 12)}...`);
      fetchReplies();
    } catch (e: any) {
      toast.error(e.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimOwner = async () => {
    if (!walletAddress) { toast.error("No wallet connected"); return; }
    if (!myUsername || !token) return;
    setClaimingOwner(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/meteorite-claim-owner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meteoriteTokenId: token.id,
            twitterUsername: myUsername,
            walletAddress,
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Owner share claimed: ${data.amountSol?.toFixed(4)} SOL!`);
    } catch (e: any) {
      toast.error(e.message || "Owner claim failed");
    } finally {
      setClaimingOwner(false);
    }
  };

  const handleLinkTwitter = async () => {
    setLinking(true);
    try {
      await linkTwitter();
    } catch {
      // user cancelled
    } finally {
      setLinking(false);
    }
  };

  if (!token) return null;

  const totalFees = Number(token.total_fees_earned) || 0;
  const ownerShare = totalFees * 0.25;
  const commenterPool = totalFees * 0.25;
  const ownerAlreadyClaimed = !!token.owner_claimed_at;
  const totalEligible = replies.length;
  const totalClaimedCount = claims.filter(c => c.status === "claimed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {token.image_url && (
              <img src={token.image_url} className="w-6 h-6 rounded-full object-cover" alt="" />
            )}
            {token.token_name || "Tokenized Tweet"}
            {token.token_ticker && (
              <span className="text-sm text-muted-foreground">${token.token_ticker}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Token info */}
        <div className="space-y-3">
          {token.tweet_content && (
            <p className="text-sm text-foreground/80 leading-relaxed">{token.tweet_content}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <a href={token.tweet_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <ExternalLink className="w-3 h-3" /> Original Tweet
            </a>
            {token.pumpfun_url && (
              <a href={token.pumpfun_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ExternalLink className="w-3 h-3" /> Pump.fun
              </a>
            )}
          </div>

          {/* Fee breakdown */}
          <Card className="bg-card/40 border-border/30">
            <CardContent className="p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-orange-400" /> Fee Distribution
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-bold text-foreground tabular-nums">{totalFees.toFixed(4)}</div>
                  <div className="text-[10px] text-muted-foreground">Total Fees SOL</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-orange-400 tabular-nums">{ownerShare.toFixed(4)}</div>
                  <div className="text-[10px] text-muted-foreground">Tweet Owner (25%)</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-green-400 tabular-nums">{commenterPool.toFixed(4)}</div>
                  <div className="text-[10px] text-muted-foreground">Commenters (25%)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-border/30" />

        {/* YOUR CLAIM STATUS — Auth-gated section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Your Claim Status
          </h3>

          {/* Not logged in */}
          {!isAuthenticated && ready && (
            <Card className="bg-card/40 border-primary/20">
              <CardContent className="p-4 text-center space-y-3">
                <LogIn className="w-6 h-6 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Sign in to check if you're eligible to claim</p>
                <Button onClick={login} className="btn-gradient-green font-bold">
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Logged in but X not linked */}
          {isAuthenticated && !twitterLinked && (
            <Card className="bg-card/40 border-orange-500/20">
              <CardContent className="p-4 text-center space-y-3">
                <XIcon className="w-6 h-6 text-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Link your X account to check your eligibility for commenter rewards
                </p>
                <Button
                  onClick={handleLinkTwitter}
                  disabled={linking}
                  className="bg-foreground text-background hover:opacity-90 font-bold"
                >
                  {linking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XIcon className="w-4 h-4 mr-2" />}
                  {linking ? "Authorizing..." : "Authorize X Account"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* X linked — show personal claim panel */}
          {isAuthenticated && twitterLinked && (
            <Card className="bg-card/40 border-border/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {twitterAccount?.profilePictureUrl && (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={twitterAccount.profilePictureUrl} />
                      <AvatarFallback className="text-xs bg-muted">
                        {twitterAccount.name?.slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {twitterAccount?.name || myUsername}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">@{myUsername}</span>
                  </div>
                </div>

                {walletAddress && (
                  <div className="text-[10px] text-muted-foreground">
                    Claims go to: <span className="font-mono text-foreground">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                  </div>
                )}

                <Separator className="bg-border/30" />

                {/* Owner status */}
                {isOwner && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-orange-500/5 border border-orange-500/15">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-orange-400" />
                      <div>
                        <div className="text-xs font-semibold text-foreground">Tweet Owner Share</div>
                        <div className="text-[10px] text-muted-foreground">{ownerShare.toFixed(4)} SOL (25% of fees)</div>
                      </div>
                    </div>
                    {ownerAlreadyClaimed ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Claimed
                      </Badge>
                    ) : (
                      <Button size="sm" className="h-7 text-xs btn-gradient-green" onClick={handleClaimOwner} disabled={claimingOwner || ownerShare < 0.001}>
                        {claimingOwner ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Commenter status */}
                {myEligibility ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/15">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className={`w-4 h-4 fill-current ${myEligibility.verified_type === "gold" ? "text-badge-gold" : "text-badge-blue"}`} />
                      <div>
                        <div className="text-xs font-semibold text-foreground">Eligible Commenter</div>
                        <div className="text-[10px] text-muted-foreground">You replied with a verified account</div>
                      </div>
                    </div>
                    {myIsClaimed ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" /> $1 Claimed
                      </Badge>
                    ) : (
                      <Button size="sm" className="h-7 text-xs btn-gradient-green" onClick={handleClaimReply} disabled={claiming}>
                        {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim $1"}
                      </Button>
                    )}
                  </div>
                ) : !loading && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Not Eligible</div>
                      <div className="text-[10px] text-muted-foreground">
                        {!isOwner ? "You haven't replied to this tweet with a verified account" : "No commenter claim — you're the tweet owner"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/20">
                    <div className="text-sm font-bold text-foreground tabular-nums">
                      {isOwner && !ownerAlreadyClaimed ? ownerShare.toFixed(4) : "0"} +{" "}
                      {myEligibility && !myIsClaimed ? "~$1" : "$0"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Available to Claim</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <div className="text-sm font-bold text-green-400 tabular-nums">
                      {(Number(token.owner_claimed_sol || 0) + (myIsClaimed ? (myClaim?.claim_amount_sol || 0) : 0)).toFixed(4)} SOL
                    </div>
                    <div className="text-[10px] text-muted-foreground">Already Claimed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="bg-border/30" />

        {/* All eligible replies */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">All Eligible Commenters</h3>
            <p className="text-xs text-muted-foreground">
              {loading ? "Updating eligible comments..." : `${totalEligible} eligible • ${totalClaimedCount} claimed`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReplies} disabled={loading} className="text-xs gap-1.5">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </Button>
        </div>

        {lastRefreshed && (
          <p className="text-[10px] text-muted-foreground -mt-2">
            {cached ? "Cached • " : "Fresh • "}
            Last updated {formatDistanceToNow(new Date(lastRefreshed), { addSuffix: true })}
            {" • Refreshes every 5 min on click"}
          </p>
        )}

        {loading && replies.length === 0 && (
          <Card className="bg-card/40 border-border/30">
            <CardContent className="p-6 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-orange-400 mx-auto" />
              <p className="text-sm text-muted-foreground">Updating eligible comments...</p>
              <p className="text-xs text-muted-foreground">Scanning for Blue ✓ and Gold ✓ verified replies</p>
            </CardContent>
          </Card>
        )}

        {!loading && replies.length === 0 && (
          <Card className="bg-card/40 border-border/30">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No eligible verified commenters found yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Only X Blue ✓ or Gold ✓ non-shadowbanned accounts qualify.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {replies.map((reply) => {
            const claim = getClaimForUser(reply.twitter_username);
            const isClaimed = claim?.status === "claimed";
            const isMe = myUsername === reply.twitter_username;

            return (
              <Card key={reply.twitter_username} className={`bg-card/40 border-border/30 ${isMe ? "ring-1 ring-primary/30" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={reply.twitter_avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-muted">
                        {reply.twitter_display_name?.slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {reply.twitter_display_name}
                        </span>
                        <BadgeCheck
                          className={`w-4 h-4 shrink-0 fill-current ${
                            reply.verified_type === "gold" ? "text-badge-gold" : "text-badge-blue"
                          }`}
                        />
                        {isMe && (
                          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 ml-1">YOU</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">@{reply.twitter_username}</span>
                    </div>

                    <div className="shrink-0">
                      {isClaimed ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Claimed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/5 text-[10px] gap-1">
                          <Clock className="w-3 h-3" /> Unclaimed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {reply.reply_text && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2 pl-12">
                      {reply.reply_text}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        {replies.length > 0 && (
          <>
            <Separator className="bg-border/30" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">How it works:</strong> 2% swap fee on every trade. 1% → platform, 1% → dev wallet.</p>
              <p>From dev wallet: 25% → tweet owner, 25% → commenter claims, 50% → operations.</p>
              <p>Each verified replier can claim once per tokenized tweet. Claims sent to your connected wallet.</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
