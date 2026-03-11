import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Play, ExternalLink, MessageCircle, Users, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { InfluencerRunDebugCard, type ManualRunDebugState } from "@/components/admin/InfluencerRunDebugCard";

interface PromoReply {
  id: string;
  tweet_id: string;
  tweet_author: string;
  tweet_text: string | null;
  reply_id: string | null;
  reply_text: string | null;
  reply_type: string;
  mention_type: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function PromoMentionsAdminPage() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [debugState, setDebugState] = useState<ManualRunDebugState | null>(null);

  // Fetch recent replies
  const { data: replies, isLoading } = useQuery({
    queryKey: ["promo-mention-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_mention_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as PromoReply[];
    },
    refetchInterval: 30000,
  });

  // Calculate stats
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const repliesLastHour = replies?.filter(
    (r) => new Date(r.created_at) > oneHourAgo && r.status === "sent"
  ).length || 0;

  const successCount = replies?.filter((r) => r.status === "sent").length || 0;
  const failedCount = replies?.filter((r) => r.status === "failed").length || 0;

  const uniqueConversations = new Set(replies?.map((r) => r.tweet_author)).size;

  const handleRunNow = async () => {
    setIsRunning(true);
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/promo-mention-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startMs;
      const rawText = await response.text();

      let data: unknown;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (response.ok) {
        setDebugState({
          kind: "success",
          startedAt,
          finishedAt,
          durationMs,
          httpStatus: response.status,
          data,
          rawText,
        });

        const result = data as { repliesSent?: number; followUpsProcessed?: number };
        toast({
          title: "Run completed",
          description: `Sent ${result.repliesSent || 0} replies, ${result.followUpsProcessed || 0} follow-ups`,
        });
      } else {
        setDebugState({
          kind: "error",
          startedAt,
          finishedAt,
          durationMs,
          httpStatus: response.status,
          message: `HTTP ${response.status}`,
          rawText,
        });

        toast({
          title: "Run failed",
          description: `HTTP ${response.status}`,
          variant: "destructive",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["promo-mention-replies"] });
    } catch (e) {
      const finishedAt = new Date().toISOString();
      setDebugState({
        kind: "error",
        startedAt,
        finishedAt,
        durationMs: Date.now() - startMs,
        message: e instanceof Error ? e.message : "Unknown error",
        name: e instanceof Error ? e.name : undefined,
      });

      toast({
        title: "Run failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500/20 text-green-400">Sent</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getReplyTypeBadge = (type: string) => {
    switch (type) {
      case "initial":
        return <Badge variant="outline">Initial</Badge>;
      case "followup_1":
        return <Badge className="bg-blue-500/20 text-blue-400">Follow-up 1</Badge>;
      case "followup_2":
        return <Badge className="bg-purple-500/20 text-purple-400">Follow-up 2</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Promo Mention Replies</h1>
            <p className="text-muted-foreground mt-1">
              Automated replies to @moltbook and @saturntrade mentions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["promo-mention-replies"] })}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleRunNow} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Now
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Replies / Hour
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repliesLastHour} / 20</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Successful
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{successCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Failed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{failedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Unique Authors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueConversations}</div>
            </CardContent>
          </Card>
        </div>

        {/* Debug Panel */}
        <InfluencerRunDebugCard state={debugState} />

        {/* Configuration Info */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Search Query</div>
                <code className="text-xs">(@moltbook OR @saturntrade OR @saturntrade)</code>
              </div>
              <div>
                <div className="text-muted-foreground">Max Replies/Hour</div>
                <div className="font-mono">20</div>
              </div>
              <div>
                <div className="text-muted-foreground">Author Cooldown</div>
                <div className="font-mono">6 hours</div>
              </div>
              <div>
                <div className="text-muted-foreground">Max Replies/Thread</div>
                <div className="font-mono">3 (1 + 2 follow-ups)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Replies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Replies</CardTitle>
            <CardDescription>Last 50 replies sent to mention tweets</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !replies?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No replies yet. Click "Run Now" to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Original Tweet</TableHead>
                      <TableHead>Our Reply</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {replies.map((reply) => (
                      <TableRow key={reply.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(reply.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`https://x.com/${reply.tweet_author}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            @{reply.tweet_author}
                          </a>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {reply.tweet_text}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {reply.reply_text}
                        </TableCell>
                        <TableCell>{getReplyTypeBadge(reply.reply_type)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(reply.status)}
                            {reply.error_message && (
                              <span className="text-xs text-red-400 truncate max-w-[100px]">
                                {reply.error_message}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <a
                              href={`https://x.com/i/status/${reply.tweet_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="View original tweet"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            {reply.reply_id ? (
                              <a
                                href={`https://x.com/i/status/${reply.reply_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-400 hover:text-green-300"
                                title="View our reply"
                              >
                                <MessageCircle className="w-4 h-4 fill-current" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground/50" title="No reply sent">
                                <MessageCircle className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
