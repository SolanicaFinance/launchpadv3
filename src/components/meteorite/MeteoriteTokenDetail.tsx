import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { BadgeCheck, Loader2, RefreshCw, DollarSign, CheckCircle2, Clock, ExternalLink, Wallet, Crown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
  const [replies, setReplies] = useState<EligibleReply[]>([]);
  const [claims, setClaims] = useState<ReplyClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [claimingUser, setClaimingUser] = useState<string | null>(null);
  const [claimWallet, setClaimWallet] = useState("");
  const [claimingOwner, setClaimingOwner] = useState(false);
  const [ownerWallet, setOwnerWallet] = useState("");
  const [showOwnerClaim, setShowOwnerClaim] = useState(false);

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
    if (open && token?.id) {
      fetchReplies();
    }
  }, [open, token?.id, fetchReplies]);

  const getClaimForUser = (username: string) =>
    claims.find((c) => c.twitter_username === username);

  const handleClaim = async (twitterUsername: string) => {
    if (!claimWallet || !claimWallet.trim()) {
      toast.error("Enter your Solana wallet address");
      return;
    }
    if (claimWallet.length < 32 || claimWallet.length > 44) {
      toast.error("Invalid Solana wallet address");
      return;
    }
    setClaimingUser(twitterUsername);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/meteorite-claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meteoriteTokenId: token!.id,
            twitterUsername,
            walletAddress: claimWallet.trim(),
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Claimed ${data.amountSol} SOL! TX: ${data.signature?.slice(0, 12)}...`);
      setClaimWallet("");
      fetchReplies();
    } catch (e: any) {
      toast.error(e.message || "Claim failed");
    } finally {
      setClaimingUser(null);
    }
  };

  const handleOwnerClaim = async () => {
    if (!ownerWallet || ownerWallet.length < 32) {
      toast.error("Enter a valid Solana wallet address");
      return;
    }
    setClaimingOwner(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/meteorite-claim-owner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meteoriteTokenId: token!.id,
            twitterUsername: token!.tweet_author,
            walletAddress: ownerWallet.trim(),
          }),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Owner share claimed: ${data.amountSol?.toFixed(4)} SOL!`);
      setOwnerWallet("");
      setShowOwnerClaim(false);
    } catch (e: any) {
      toast.error(e.message || "Owner claim failed");
    } finally {
      setClaimingOwner(false);
    }
  };

  if (!token) return null;

  const totalFees = Number(token.total_fees_earned) || 0;
  const ownerShare = totalFees * 0.25;
  const commenterPool = totalFees * 0.25;
  const ownerAlreadyClaimed = !!token.owner_claimed_at;

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

          {/* Tweet Owner Claim */}
          {token.tweet_author && (
            <Card className="bg-card/40 border-orange-500/20">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-semibold text-foreground">Tweet Owner: @{token.tweet_author}</span>
                  </div>
                  {ownerAlreadyClaimed ? (
                    <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Claimed {Number(token.owner_claimed_sol || 0).toFixed(4)} SOL
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setShowOwnerClaim(!showOwnerClaim)}>
                      <Wallet className="w-3 h-3" /> Claim {ownerShare.toFixed(4)} SOL
                    </Button>
                  )}
                </div>
                {showOwnerClaim && !ownerAlreadyClaimed && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={ownerWallet}
                      onChange={(e) => setOwnerWallet(e.target.value)}
                      placeholder="Your Solana wallet address..."
                      className="text-xs h-8 bg-background/50"
                    />
                    <Button size="sm" className="h-8 text-xs shrink-0 btn-gradient-green" onClick={handleOwnerClaim} disabled={claimingOwner}>
                      {claimingOwner ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="bg-border/30" />

        {/* Eligible replies header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Eligible Commenters</h3>
            <p className="text-xs text-muted-foreground">
              {loading ? "Updating eligible comments..." : `${replies.length} verified, non-shadowbanned repliers`}
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

        {/* Loading state */}
        {loading && replies.length === 0 && (
          <Card className="bg-card/40 border-border/30">
            <CardContent className="p-6 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-orange-400 mx-auto" />
              <p className="text-sm text-muted-foreground">Updating eligible comments...</p>
              <p className="text-xs text-muted-foreground">Scanning for Blue ✓ and Gold ✓ verified replies</p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && replies.length === 0 && (
          <Card className="bg-card/40 border-border/30">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No eligible verified commenters found yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Only X Blue ✓ or Gold ✓ non-shadowbanned accounts qualify.</p>
            </CardContent>
          </Card>
        )}

        {/* Reply list */}
        <div className="space-y-2">
          {replies.map((reply) => {
            const claim = getClaimForUser(reply.twitter_username);
            const isClaimed = claim?.status === "claimed";
            const isClaimingThis = claimingUser === reply.twitter_username;

            return (
              <Card key={reply.twitter_username} className="bg-card/40 border-border/30">
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
                      </div>
                      <span className="text-xs text-muted-foreground">@{reply.twitter_username}</span>
                    </div>

                    <div className="shrink-0">
                      {isClaimed ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Claimed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 gap-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => setClaimingUser(claimingUser === reply.twitter_username ? null : reply.twitter_username)}
                          disabled={isClaimingThis}
                        >
                          <Wallet className="w-3 h-3" />
                          Claim $1
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Claim input - shows when user clicks Claim */}
                  {claimingUser === reply.twitter_username && !isClaimed && (
                    <div className="flex gap-2 mt-2 pl-12">
                      <Input
                        value={claimWallet}
                        onChange={(e) => setClaimWallet(e.target.value)}
                        placeholder="Your Solana wallet address..."
                        className="text-xs h-8 bg-background/50"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs shrink-0 btn-gradient-green"
                        onClick={() => handleClaim(reply.twitter_username)}
                        disabled={isClaimingThis && !!claimingUser}
                      >
                        {isClaimingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send"}
                      </Button>
                    </div>
                  )}

                  {/* Claim tx info */}
                  {isClaimed && claim?.claim_tx_signature && (
                    <div className="mt-1.5 pl-12">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        TX: {claim.claim_tx_signature.slice(0, 16)}...
                      </span>
                    </div>
                  )}

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

        {/* Fee info footer */}
        {replies.length > 0 && (
          <>
            <Separator className="bg-border/30" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">How it works:</strong> 2% swap fee on every trade.
                1% goes to the platform, 1% goes to the dev wallet.
              </p>
              <p>From the dev wallet: 25% → tweet owner, 25% → commenter claims, 50% → operations.</p>
              <p>Each verified replier can claim once per tokenized tweet. Claims paid from accumulated fees.</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
