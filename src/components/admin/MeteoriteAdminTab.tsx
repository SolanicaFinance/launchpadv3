import { useState, useEffect } from "react";
import { Flame, Search, CheckCircle2, XCircle, ExternalLink, DollarSign, Copy, RefreshCw, Loader2, Users, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MeteoriteToken {
  id: string;
  tweet_url: string;
  tweet_id: string | null;
  tweet_author: string | null;
  tweet_content: string | null;
  token_name: string | null;
  token_ticker: string | null;
  mint_address: string | null;
  pumpfun_url: string | null;
  dev_wallet_address: string;
  image_url: string | null;
  status: string;
  creator_wallet: string | null;
  total_fees_earned: number;
  error_message: string | null;
  created_at: string;
  owner_claimed_at: string | null;
  owner_claimed_sol: number | null;
  eligible_replies_count: number | null;
}

export function MeteoriteAdminTab() {
  const [tokens, setTokens] = useState<MeteoriteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [newTweetUrl, setNewTweetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTokens = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("meteorite_tokens" as any)
      .select("id, tweet_url, tweet_id, tweet_author, tweet_content, token_name, token_ticker, mint_address, pumpfun_url, dev_wallet_address, image_url, status, creator_wallet, total_fees_earned, error_message, created_at, owner_claimed_at, owner_claimed_sol, eligible_replies_count")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) setTokens(data as unknown as MeteoriteToken[]);
    if (error) toast.error("Failed to load tokens");
    setLoading(false);
  };

  useEffect(() => { fetchTokens(); }, []);

  const filteredTokens = filter === "all" ? tokens : tokens.filter(t => t.status === filter);
  const totalLive = tokens.filter(t => t.status === "live").length;
  const totalFees = tokens.reduce((sum, t) => sum + (Number(t.total_fees_earned) || 0), 0);
  const totalClaimed = tokens.reduce((sum, t) => sum + (Number(t.owner_claimed_sol) || 0), 0);
  const totalRepliers = tokens.reduce((sum, t) => sum + (Number(t.eligible_replies_count) || 0), 0);

  const handleAddTweet = async () => {
    if (!newTweetUrl.includes("x.com") && !newTweetUrl.includes("twitter.com")) {
      toast.error("Please enter a valid X/Twitter URL");
      return;
    }
    setSubmitting(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/meteorite-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetUrl: newTweetUrl }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Tweet registered! Dev wallet: ${data.devWalletAddress}`);
      setNewTweetUrl("");
      fetchTokens();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSubmitting(false);
  };

  const handleLaunch = async (tokenId: string) => {
    toast.info("Launching token...");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/meteorite-launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`🚀 ${data.tokenName} launched! CA: ${data.mintAddress}`);
      fetchTokens();
    } catch (e: any) {
      toast.error(e.message);
      fetchTokens();
    }
  };

  const copyCA = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Tweets", value: tokens.length, color: "text-foreground" },
          { label: "Live Tokens", value: totalLive, color: "text-green-400" },
          { label: "Pending", value: tokens.filter(t => t.status === "pending_payment").length, color: "text-yellow-400" },
          { label: "Total Fees", value: `${totalFees.toFixed(2)} SOL`, color: "text-orange-400" },
          { label: "Owner Claimed", value: `${totalClaimed.toFixed(2)} SOL`, color: "text-green-400" },
        ].map((stat, i) => (
          <Card key={i} className="bg-card/40 border-border/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
              <div className={`text-xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add tweet */}
      <Card className="bg-card/40 border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            Submit Tweet for Tokenization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={newTweetUrl} onChange={(e) => setNewTweetUrl(e.target.value)} placeholder="https://x.com/username/status/..." className="bg-background/50" />
            <Button onClick={handleAddTweet} disabled={submitting} className="shrink-0">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" /> Init</>}
            </Button>
            <Button onClick={fetchTokens} variant="outline" size="icon" className="shrink-0">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending_payment", "generating_image", "launching", "live", "failed"].map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="text-xs capitalize">
            {f.replace("_", " ")}
          </Button>
        ))}
      </div>

      {/* Token list */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {filteredTokens.map(token => (
            <Card key={token.id} className="bg-card/40 border-border/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground text-sm">
                        {token.token_name ? `${token.token_name} ($${token.token_ticker})` : token.tweet_url.split("/").pop()?.slice(0, 12) + "..."}
                      </span>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${
                        token.status === "live" ? "border-green-500/30 text-green-400 bg-green-500/5"
                        : token.status === "failed" ? "border-red-500/30 text-red-400 bg-red-500/5"
                        : token.status === "launching" || token.status === "generating_image" ? "border-blue-500/30 text-blue-400 bg-blue-500/5"
                        : "border-yellow-500/30 text-yellow-400 bg-yellow-500/5"
                      }`}>
                        {token.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {token.tweet_content && <p className="text-sm text-muted-foreground truncate">{token.tweet_content}</p>}
                    {token.error_message && <p className="text-xs text-red-400 mt-1 truncate">{token.error_message}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(token.status === "pending_payment" || token.status === "generating_image") && (
                      <Button size="sm" onClick={() => handleLaunch(token.id)} className="text-xs btn-gradient-green">Launch</Button>
                    )}
                    <a href={token.tweet_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="text-xs"><ExternalLink className="w-3 h-3" /></Button>
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="font-mono text-[10px] truncate max-w-[140px]" title={token.dev_wallet_address}>
                    Dev: {token.dev_wallet_address.slice(0, 6)}...{token.dev_wallet_address.slice(-4)}
                  </span>
                  {token.tweet_author && (
                    <span className="flex items-center gap-1">
                      <Crown className="w-3 h-3 text-orange-400" />
                      @{token.tweet_author}
                      {token.owner_claimed_at && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                    </span>
                  )}
                  {(token.eligible_replies_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-400" />
                      {token.eligible_replies_count} repliers
                    </span>
                  )}
                  {Number(token.total_fees_earned) > 0 && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-orange-400" />
                      {Number(token.total_fees_earned).toFixed(2)} SOL
                    </span>
                  )}
                  {token.mint_address && (
                    <button onClick={() => copyCA(token.mint_address!)} className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors">
                      <Copy className="w-3 h-3" />
                      <span className="font-mono text-[10px] truncate max-w-[100px]">{token.mint_address}</span>
                    </button>
                  )}
                  {token.pumpfun_url && (
                    <a href={token.pumpfun_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredTokens.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">No tokens found for this filter.</div>
          )}
        </div>
      )}
    </div>
  );
}
