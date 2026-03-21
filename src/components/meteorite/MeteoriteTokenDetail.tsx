import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Loader2, RefreshCw, DollarSign, CheckCircle2, Clock, ExternalLink } from "lucide-react";
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

  // Fetch on open
  useEffect(() => {
    if (open && token?.id) {
      fetchReplies();
    }
  }, [open, token?.id, fetchReplies]);

  const getClaimForUser = (username: string) =>
    claims.find((c) => c.twitter_username === username);

  if (!token) return null;

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

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a
              href={token.tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Original Tweet
            </a>
            {token.pumpfun_url && (
              <a
                href={token.pumpfun_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Pump.fun
              </a>
            )}
            {token.total_fees_earned > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-orange-400" />
                {Number(token.total_fees_earned).toFixed(4)} SOL earned
              </span>
            )}
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Eligible replies header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Eligible Commenters</h3>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Updating eligible comments..."
                : `${replies.length} verified, non-shadowbanned repliers`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReplies}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
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
              <p className="text-sm text-muted-foreground">
                Updating eligible comments...
              </p>
              <p className="text-xs text-muted-foreground">
                Scanning for Blue ✓ and Gold ✓ verified replies
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reply list */}
        {!loading && replies.length === 0 && (
          <Card className="bg-card/40 border-border/30">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No eligible verified commenters found yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Only X Blue ✓ or Gold ✓ non-shadowbanned accounts qualify.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {replies.map((reply) => {
            const claim = getClaimForUser(reply.twitter_username);
            const isClaimed = claim?.status === "claimed";

            return (
              <Card
                key={reply.twitter_username}
                className="bg-card/40 border-border/30"
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={reply.twitter_avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-muted">
                        {reply.twitter_display_name?.slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {reply.twitter_display_name}
                        </span>
                        <BadgeCheck
                          className={`w-4 h-4 shrink-0 fill-current ${
                            reply.verified_type === "gold"
                              ? "text-badge-gold"
                              : "text-badge-blue"
                          }`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        @{reply.twitter_username}
                      </span>
                    </div>

                    {/* Claim status */}
                    <div className="shrink-0">
                      {isClaimed ? (
                        <Badge
                          variant="outline"
                          className="border-green-500/30 text-green-400 bg-green-500/5 text-[10px] gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          $1 Claimed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-yellow-500/30 text-yellow-400 bg-yellow-500/5 text-[10px] gap-1"
                        >
                          <Clock className="w-3 h-3" />
                          $1 Unclaimed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Reply text preview */}
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
                <strong className="text-foreground">How claims work:</strong> Each verified
                replier can claim $1 per tokenized tweet from the trading fees generated.
              </p>
              <p>
                1% of swap fees → dev wallet (funds replier payouts) • 1% → platform
              </p>
              <p>Only 1 claim per account per tokenized tweet.</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
