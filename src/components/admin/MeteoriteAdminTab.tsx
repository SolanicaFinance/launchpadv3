import { useState } from "react";
import { Flame, Search, CheckCircle2, XCircle, ExternalLink, Users, DollarSign, MessageSquare, BadgeCheck, Clock, Copy, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface MeteoriteTweet {
  id: string;
  tweetUrl: string;
  author: string;
  content: string;
  tokenCA: string | null;
  status: "pending" | "scanning" | "tokenized" | "failed";
  totalComments: number;
  eligibleCommenters: number;
  rejectedCommenters: number;
  tweetOwnerEarnings: number;
  commenterPoolEarnings: number;
  createdAt: string;
  commenters: {
    username: string;
    isVerified: boolean;
    isShadowbanned: boolean;
    isEligible: boolean;
    commentText: string;
    earningsSol: number;
  }[];
}

// Mock data for admin view
const MOCK_DATA: MeteoriteTweet[] = [
  {
    id: "1",
    tweetUrl: "https://x.com/elonmusk/status/123456",
    author: "@elonmusk",
    content: "The future of money is digital. Banks are running on software from the 80s.",
    tokenCA: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    status: "tokenized",
    totalComments: 847,
    eligibleCommenters: 312,
    rejectedCommenters: 535,
    tweetOwnerEarnings: 6.175,
    commenterPoolEarnings: 6.175,
    createdAt: "2025-03-20T10:30:00Z",
    commenters: [
      { username: "@cryptodev_sol", isVerified: true, isShadowbanned: false, isEligible: true, commentText: "This is the way. DeFi is eating TradFi.", earningsSol: 0.019 },
      { username: "@whale_alert", isVerified: true, isShadowbanned: false, isEligible: true, commentText: "Banks will adapt or die. Simple.", earningsSol: 0.019 },
      { username: "@spambot2024", isVerified: false, isShadowbanned: true, isEligible: false, commentText: "FREE CRYPTO TAP LINK IN BIO", earningsSol: 0 },
      { username: "@defi_maxi", isVerified: true, isShadowbanned: false, isEligible: true, commentText: "Already building the replacement. WAGMI", earningsSol: 0.019 },
      { username: "@nocheck_user", isVerified: false, isShadowbanned: false, isEligible: false, commentText: "Interesting take", earningsSol: 0 },
    ],
  },
  {
    id: "2",
    tweetUrl: "https://x.com/VitalikButerin/status/789012",
    author: "@VitalikButerin",
    content: "Ethereum's roadmap is about making L1 simpler and L2s more powerful.",
    tokenCA: "9pKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgBsV",
    status: "tokenized",
    totalComments: 1203,
    eligibleCommenters: 489,
    rejectedCommenters: 714,
    tweetOwnerEarnings: 4.575,
    commenterPoolEarnings: 4.575,
    createdAt: "2025-03-20T08:15:00Z",
    commenters: [],
  },
  {
    id: "3",
    tweetUrl: "https://x.com/someone/status/345678",
    author: "@CryptoWhale",
    content: "Just bought 500 $SOL at $180. This is the bottom. Screenshot this.",
    tokenCA: null,
    status: "scanning",
    totalComments: 234,
    eligibleCommenters: 0,
    rejectedCommenters: 0,
    tweetOwnerEarnings: 0,
    commenterPoolEarnings: 0,
    createdAt: "2025-03-20T12:45:00Z",
    commenters: [],
  },
];

export function MeteoriteAdminTab() {
  const [tweets, setTweets] = useState(MOCK_DATA);
  const [selectedTweet, setSelectedTweet] = useState<MeteoriteTweet | null>(null);
  const [newTweetUrl, setNewTweetUrl] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "scanning" | "tokenized" | "failed">("all");

  const filteredTweets = filter === "all" ? tweets : tweets.filter(t => t.status === filter);

  const totalEarnings = tweets.reduce((sum, t) => sum + t.tweetOwnerEarnings + t.commenterPoolEarnings, 0);
  const totalTokenized = tweets.filter(t => t.status === "tokenized").length;
  const totalEligible = tweets.reduce((sum, t) => sum + t.eligibleCommenters, 0);

  const handleAddTweet = () => {
    if (!newTweetUrl.includes("x.com") && !newTweetUrl.includes("twitter.com")) {
      toast.error("Please enter a valid X/Twitter URL");
      return;
    }
    toast.success("Tweet submitted for scanning");
    setNewTweetUrl("");
  };

  const handleTokenize = (tweetId: string) => {
    toast.success("Tokenization initiated — deploying token...");
    setTweets(prev => prev.map(t => t.id === tweetId ? { ...t, status: "tokenized" as const, tokenCA: "NEW_TOKEN_CA_HERE" } : t));
  };

  const copyCA = (ca: string) => {
    navigator.clipboard.writeText(ca);
    toast.success("CA copied");
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/40 border-border/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Tweets</div>
            <div className="text-xl font-bold text-foreground tabular-nums">{tweets.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Tokenized</div>
            <div className="text-xl font-bold text-green-400 tabular-nums">{totalTokenized}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Eligible Commenters</div>
            <div className="text-xl font-bold text-orange-400 tabular-nums">{totalEligible.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Fees Earned</div>
            <div className="text-xl font-bold text-foreground tabular-nums">{totalEarnings.toFixed(2)} SOL</div>
          </CardContent>
        </Card>
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
            <Input
              value={newTweetUrl}
              onChange={(e) => setNewTweetUrl(e.target.value)}
              placeholder="https://x.com/username/status/..."
              className="bg-background/50"
            />
            <Button onClick={handleAddTweet} className="shrink-0">
              <Search className="w-4 h-4 mr-2" />
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "scanning", "tokenized", "failed"] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Tweet list */}
      <div className="space-y-3">
        {filteredTweets.map(tweet => (
          <Card key={tweet.id} className="bg-card/40 border-border/30">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-foreground text-sm">{tweet.author}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider font-semibold ${
                        tweet.status === "tokenized"
                          ? "border-green-500/30 text-green-400 bg-green-500/5"
                          : tweet.status === "scanning"
                          ? "border-blue-500/30 text-blue-400 bg-blue-500/5"
                          : tweet.status === "failed"
                          ? "border-red-500/30 text-red-400 bg-red-500/5"
                          : "border-yellow-500/30 text-yellow-400 bg-yellow-500/5"
                      }`}
                    >
                      {tweet.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{tweet.content}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {tweet.status === "scanning" && (
                    <Button size="sm" onClick={() => handleTokenize(tweet.id)} className="text-xs btn-gradient-green">
                      Tokenize
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSelectedTweet(tweet)} className="text-xs">
                    Details
                  </Button>
                  <a href={tweet.tweetUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="text-xs">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {tweet.totalComments}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  {tweet.eligibleCommenters} eligible
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-400" />
                  {tweet.rejectedCommenters} rejected
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-orange-400" />
                  {(tweet.tweetOwnerEarnings + tweet.commenterPoolEarnings).toFixed(2)} SOL
                </span>
                {tweet.tokenCA && (
                  <button onClick={() => copyCA(tweet.tokenCA!)} className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors">
                    <Copy className="w-3 h-3" />
                    <span className="font-mono text-[10px] truncate max-w-[100px]">{tweet.tokenCA}</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail panel */}
      {selectedTweet && (
        <Card className="bg-card/40 border-border/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Commenters for {selectedTweet.author}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTweet(null)} className="text-xs">
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="text-lg font-bold text-green-400">{selectedTweet.tweetOwnerEarnings.toFixed(3)}</div>
                <div className="text-[10px] text-muted-foreground">Owner Earnings (SOL)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <div className="text-lg font-bold text-orange-400">{selectedTweet.commenterPoolEarnings.toFixed(3)}</div>
                <div className="text-[10px] text-muted-foreground">Commenter Pool (SOL)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="text-lg font-bold text-blue-400">{selectedTweet.eligibleCommenters}</div>
                <div className="text-[10px] text-muted-foreground">Eligible Commenters</div>
              </div>
            </div>

            {selectedTweet.commenters.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {selectedTweet.commenters.map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                    c.isEligible
                      ? "bg-green-500/5 border-green-500/10"
                      : "bg-red-500/5 border-red-500/10 opacity-60"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{c.username}</span>
                        {c.isVerified && <BadgeCheck className="w-3 h-3 text-blue-400" />}
                        {c.isShadowbanned && (
                          <Badge variant="outline" className="text-[8px] border-red-500/30 text-red-400 bg-red-500/5 px-1">
                            SHADOWBANNED
                          </Badge>
                        )}
                        {!c.isVerified && (
                          <Badge variant="outline" className="text-[8px] border-yellow-500/30 text-yellow-400 bg-yellow-500/5 px-1">
                            NO CHECK
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.commentText}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.isEligible ? (
                        <span className="text-green-400 font-mono text-xs">{c.earningsSol.toFixed(4)} SOL</span>
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-6">
                No commenter data loaded for this tweet yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
