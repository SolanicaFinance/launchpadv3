import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowClockwise, TwitterLogo, CheckCircle, XCircle, Clock, Warning, Eye, EyeSlash, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromoMentionsPanel } from "@/components/admin/PromoMentionsPanel";

interface TwitterReply {
  id: string;
  tweet_id: string;
  tweet_author: string | null;
  tweet_text: string | null;
  reply_text: string;
  reply_id: string | null;
  created_at: string;
}

export default function TwitterBotAdminPage() {
  const [replies, setReplies] = useState<TwitterReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<any>(null);
  const [authSecret, setAuthSecret] = useState(() => 
    localStorage.getItem("twitter_bot_secret") || ""
  );
  const [showSecret, setShowSecret] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const saveAuthSecret = (secret: string) => {
    localStorage.setItem("twitter_bot_secret", secret);
    setAuthSecret(secret);
  };

  const fetchReplies = async (secret?: string) => {
    const secretToUse = secret || authSecret;
    if (!secretToUse) {
      toast.error("Enter access secret first");
      setIsCheckingAuth(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Use edge function to fetch replies (bypasses RLS)
      const { data, error } = await supabase.functions.invoke("twitter-auto-reply", {
        body: { action: "list", secret: secretToUse },
      });
      
      if (error) throw error;
      
      if (data?.error === "unauthorized") {
        toast.error("Invalid secret");
        setIsAuthed(false);
        setIsCheckingAuth(false);
        return;
      }
      
      setReplies(data?.replies || []);
      setIsAuthed(true);
    } catch (err) {
      console.error("Error fetching replies:", err);
      toast.error("Failed to fetch replies");
    } finally {
      setIsLoading(false);
      setIsCheckingAuth(false);
    }
  };

  const triggerBot = async (force = false) => {
    if (!authSecret) {
      toast.error("Enter access secret first");
      return;
    }
    
    setIsTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("twitter-auto-reply", {
        body: { action: "run", secret: authSecret, force },
      });
      
      if (error) throw error;
      
      if (data?.error === "unauthorized") {
        toast.error("Invalid secret");
        return;
      }
      
      setLastRunResult(data);
      
      if (data?.message?.includes("Cooldown")) {
        toast.info(data.message);
      } else {
        const repliesSent = data?.repliesSent || 0;
        const firstError = data?.results?.find((r: any) => r && r.success === false)?.error;
        if (repliesSent > 0) {
          toast.success(`Bot run complete: ${repliesSent} replies sent`);
        } else if (firstError) {
          toast.error(`Bot run failed: ${firstError}`);
        } else {
          toast.info("Bot run complete: 0 replies sent");
        }
      }
      
      // Refresh the list
      await fetchReplies();
    } catch (err) {
      console.error("Error triggering bot:", err);
      toast.error("Failed to trigger bot");
      setLastRunResult({ error: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    const savedSecret = localStorage.getItem("twitter_bot_secret");
    if (savedSecret) {
      fetchReplies(savedSecret);
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const stats = {
    total: replies.length,
    today: replies.filter(r => 
      new Date(r.created_at).toDateString() === new Date().toDateString()
    ).length,
    successful: replies.filter(r => r.reply_id).length,
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0d0d0f]">
        <AppHeader />
        <main className="max-w-md mx-auto px-4 py-16">
          <div className="text-center text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  // Auth gate - show login form if not authenticated
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#0d0d0f]">
        <AppHeader />
        <main className="max-w-md mx-auto px-4 py-16">
          <Card className="bg-[#12121a] border-[#1a1a1f]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TwitterLogo className="h-5 w-5 text-blue-400" weight="fill" />
                Twitter Bot Admin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-400 text-sm">
                Enter the admin secret to access the Twitter bot dashboard.
              </p>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  placeholder="Admin secret..."
                  value={authSecret}
                  onChange={(e) => saveAuthSecret(e.target.value)}
                  className="bg-[#0d0d0f] border-[#1a1a1f] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showSecret ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={() => fetchReplies()}
                disabled={!authSecret || isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? "Checking..." : "Access Dashboard"}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      <AppHeader />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TwitterLogo className="h-6 w-6 text-blue-400" weight="fill" />
            Twitter Bot Admin
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor and manage automated Twitter replies
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-[#12121a] border border-[#1a1a1f]">
            <TabsTrigger value="general" className="data-[state=active]:bg-blue-600">
              General Bot
            </TabsTrigger>
            <TabsTrigger value="promo" className="data-[state=active]:bg-purple-600">
              Promo Mentions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* General Bot Controls */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchReplies()}
                disabled={isLoading}
                className="border-gray-700"
              >
                <ArrowClockwise className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => triggerBot(false)}
                disabled={isTriggering}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isTriggering ? (
                  <>
                    <ArrowClockwise className="h-4 w-4 mr-1 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <TwitterLogo className="h-4 w-4 mr-1" weight="fill" />
                    Run
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => triggerBot(true)}
                disabled={isTriggering}
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
              >
                <Lightning className="h-4 w-4 mr-1" weight="fill" />
                Force Run
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-[#12121a] border-[#1a1a1f]">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-white">{stats.total}</div>
                  <div className="text-sm text-gray-400">Total Replies</div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#12121a] border-[#1a1a1f]">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-400">{stats.today}</div>
                  <div className="text-sm text-gray-400">Today</div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#12121a] border-[#1a1a1f]">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-400">{stats.successful}</div>
                  <div className="text-sm text-gray-400">Successful Posts</div>
                </CardContent>
              </Card>
              
              <Card className="bg-[#12121a] border-[#1a1a1f]">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-400">~20s</div>
                  <div className="text-sm text-gray-400">Post Interval</div>
                </CardContent>
              </Card>
            </div>

            {/* Last Run Result */}
            {lastRunResult && (
              <Card className="bg-[#12121a] border-[#1a1a1f]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Last Manual Run</CardTitle>
                </CardHeader>
                <CardContent>
                  {lastRunResult.error ? (
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="h-5 w-5" />
                      <span>{lastRunResult.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="h-5 w-5" />
                        <span>{lastRunResult.repliesSent} replies sent</span>
                      </div>
                      {lastRunResult.searchQuery && (
                        <div className="text-sm text-gray-400">
                          Search query: "{lastRunResult.searchQuery}"
                        </div>
                      )}
                      {lastRunResult.results && (
                        <div className="mt-2 space-y-1">
                          {lastRunResult.results.map((r: any, i: number) => (
                            <div key={i} className="text-xs flex items-center gap-2">
                              {r.success ? (
                                <CheckCircle className="h-3 w-3 text-green-400" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-400" />
                              )}
                              <span className="text-gray-500">Tweet {r.tweetId}</span>
                              {r.error && <span className="text-red-400">{r.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bot Configuration Info */}
            <Card className="bg-[#12121a] border-[#1a1a1f]">
              <CardHeader>
                <CardTitle className="text-white text-lg">Bot Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-300">Runs every minute, posts up to 2 replies per run with short delays</span>
                </div>
                <div className="flex items-center gap-2">
                  <Warning className="h-4 w-4 text-yellow-400" />
                  <span className="text-gray-300">~2 replies per minute (~120 per hour)</span>
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  Search queries: "crypto meme coin", "solana degen", "memecoin launch", "$SOL pump", "web3 meme"
                </div>
              </CardContent>
            </Card>

            {/* Replies List */}
            <Card className="bg-[#12121a] border-[#1a1a1f]">
              <CardHeader>
                <CardTitle className="text-white">Recent Replies</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-400">Loading...</div>
                ) : replies.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No replies yet. The bot will start posting when triggered.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replies.map((reply) => (
                      <div 
                        key={reply.id}
                        className="p-4 bg-[#0d0d0f] rounded-lg border border-[#1a1a1f]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-blue-400 font-medium">
                                @{reply.tweet_author || "unknown"}
                              </span>
                              <span className="text-gray-600 text-xs">
                                {formatDate(reply.created_at)}
                              </span>
                              {reply.reply_id ? (
                                <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs">
                                  Posted
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">
                                  Pending
                                </Badge>
                              )}
                            </div>
                            
                            {reply.tweet_text && (
                              <div className="text-gray-400 text-sm mb-2 p-2 bg-[#1a1a1f] rounded">
                                {reply.tweet_text}
                              </div>
                            )}
                            
                            <div className="text-white text-sm">
                              <span className="text-gray-500">Reply: </span>
                              {reply.reply_text}
                            </div>
                          </div>
                          
                          <div className="flex-shrink-0">
                            {reply.tweet_id && (
                              <a
                                href={`https://x.com/i/web/status/${reply.tweet_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs"
                              >
                                View →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promo">
            <PromoMentionsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
