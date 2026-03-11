import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowClockwise, At, CheckCircle, XCircle, ChatCircle, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";

interface PromoMentionReply {
  id: string;
  tweet_id: string;
  tweet_author: string;
  tweet_text: string | null;
  reply_text: string;
  reply_id: string | null;
  reply_type: string;
  mention_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface DebugInfo {
  tweetsSearched: number;
  eligibleTweets: number;
  repliesSent: number;
  followUpsProcessed: number;
  errors: string[];
  scanStoppedReason: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export function PromoMentionsPanel() {
  const [replies, setReplies] = useState<PromoMentionReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastRunDebug, setLastRunDebug] = useState<DebugInfo | null>(null);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchReplies = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("promo_mention_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setReplies((data as PromoMentionReply[]) || []);
    } catch (err) {
      console.error("Error fetching promo mention replies:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      // Fetch edge function logs from analytics
      const { data, error } = await supabase
        .from("function_edge_logs" as any)
        .select("timestamp, event_message, metadata")
        .ilike("event_message", "%promo%")
        .order("timestamp", { ascending: false })
        .limit(50);

      if (!error && data) {
        const parsedLogs: LogEntry[] = data.map((log: any) => ({
          timestamp: log.timestamp,
          level: log.metadata?.[0]?.level || "info",
          message: log.event_message || "",
        }));
        setLogs(parsedLogs);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
      // Fallback: just show last run debug info
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const triggerRun = async () => {
    setIsTriggering(true);
    const startedAt = new Date().toISOString();
    
    try {
      const { data, error } = await supabase.functions.invoke("promo-mention-reply");
      
      if (error) throw error;

      setLastRunDebug(data?.debug || null);
      setLastRunTime(new Date().toISOString());

      if (data?.repliesSent > 0) {
        toast.success(`Sent ${data.repliesSent} replies, ${data.followUpsProcessed || 0} follow-ups`);
      } else {
        toast.info(data?.debug?.scanStoppedReason || "No new replies sent");
      }

      await fetchReplies();
    } catch (err) {
      console.error("Error triggering promo mention reply:", err);
      toast.error("Failed to trigger promo mention reply");
      setLastRunDebug({
        tweetsSearched: 0,
        eligibleTweets: 0,
        repliesSent: 0,
        followUpsProcessed: 0,
        errors: [err instanceof Error ? err.message : "Unknown error"],
        scanStoppedReason: "Request failed",
      });
      setLastRunTime(new Date().toISOString());
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    fetchReplies();
    fetchLogs();
  }, [fetchReplies, fetchLogs]);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const stats = {
    total: replies.length,
    today: replies.filter(r =>
      new Date(r.created_at).toDateString() === new Date().toDateString()
    ).length,
    sent: replies.filter(r => r.status === "sent").length,
    failed: replies.filter(r => r.status === "failed").length,
    followUps: replies.filter(r => r.reply_type !== "initial").length,
  };

  const getMentionBadge = (type: string) => {
    switch (type) {
      case "moltbook":
        return <Badge variant="outline" className="text-purple-400 border-purple-400/30 text-xs">@moltbook</Badge>;
      case "saturntrade":
        return <Badge variant="outline" className="text-cyan-400 border-cyan-400/30 text-xs">@saturntrade</Badge>;
      case "both":
        return <Badge variant="outline" className="text-pink-400 border-pink-400/30 text-xs">both</Badge>;
      default:
        return null;
    }
  };

  const getReplyTypeBadge = (type: string) => {
    if (type === "initial") return null;
    return (
      <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs">
        <ChatCircle className="h-3 w-3 mr-1" />
        {type === "followup_1" ? "Follow-up 1" : "Follow-up 2"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <At className="h-5 w-5 text-purple-400" weight="bold" />
            Promo Mentions (@moltbook / @saturntrade)
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Auto-replies to mentions with conversational AI responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReplies}
            disabled={isLoading}
            className="border-gray-700"
          >
            <ArrowClockwise className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={triggerRun}
            disabled={isTriggering}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isTriggering ? (
              <>
                <ArrowClockwise className="h-4 w-4 mr-1 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Lightning className="h-4 w-4 mr-1" weight="fill" />
                Run Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="text-2xl font-bold text-blue-400">{stats.sent}</div>
            <div className="text-sm text-gray-400">Sent</div>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-sm text-gray-400">Failed</div>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-400">{stats.followUps}</div>
            <div className="text-sm text-gray-400">Follow-ups</div>
          </CardContent>
        </Card>
      </div>

      {/* Last Run Debug */}
      {lastRunDebug && (
        <Card className="bg-[#12121a] border-[#1a1a1f]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-gray-400">Last Manual Run</CardTitle>
              {lastRunTime && (
                <span className="text-xs text-gray-500">{formatDate(lastRunTime)}</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="rounded-md bg-[#0d0d0f] p-3">
                <div className="text-xs text-gray-500">Tweets Searched</div>
                <div className="text-lg font-semibold text-white">{lastRunDebug.tweetsSearched}</div>
              </div>
              <div className="rounded-md bg-[#0d0d0f] p-3">
                <div className="text-xs text-gray-500">Eligible</div>
                <div className="text-lg font-semibold text-white">{lastRunDebug.eligibleTweets}</div>
              </div>
              <div className="rounded-md bg-[#0d0d0f] p-3">
                <div className="text-xs text-gray-500">Replies Sent</div>
                <div className="text-lg font-semibold text-green-400">{lastRunDebug.repliesSent}</div>
              </div>
              <div className="rounded-md bg-[#0d0d0f] p-3">
                <div className="text-xs text-gray-500">Follow-ups</div>
                <div className="text-lg font-semibold text-orange-400">{lastRunDebug.followUpsProcessed}</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-400">
              <span className="text-gray-500">Status: </span>
              {lastRunDebug.scanStoppedReason}
            </div>

            {lastRunDebug.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {lastRunDebug.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {err}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Info */}
      <Card className="bg-[#12121a] border-[#1a1a1f]">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-400 space-y-1">
          <div>• Runs every 1 minute via cron</div>
          <div>• Max 20 replies per hour</div>
          <div>• 6-hour cooldown per author</div>
          <div>• Max 3 replies per thread (initial + 2 follow-ups)</div>
          <div>• Signature: "Tuna Launchpad for AI Agents on Solana."</div>
        </CardContent>
      </Card>

      {/* Edge Function Logs */}
      <Card className="bg-[#12121a] border-[#1a1a1f]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm">Edge Function Logs</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchLogs}
              disabled={isLoadingLogs}
              className="h-7"
            >
              <ArrowClockwise className={`h-3 w-3 ${isLoadingLogs ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lastRunDebug?.errors && lastRunDebug.errors.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lastRunDebug.errors.map((err, i) => (
                <div
                  key={i}
                  className="font-mono text-xs p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400"
                >
                  {err}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              Run the function to see logs. Check Lovable Cloud backend logs for detailed function output.
            </div>
          )}
          
          <div className="mt-4 p-3 rounded bg-[#0d0d0f] border border-[#1a1a1f]">
            <div className="text-xs text-gray-500 mb-2">Tip: For full logs, check:</div>
            <code className="text-xs text-purple-400 break-all">
              Backend → Edge Functions → promo-mention-reply → Logs
            </code>
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
              No replies yet. Wait for mentions or trigger a manual run.
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
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-purple-400 font-medium">
                          @{reply.tweet_author}
                        </span>
                        <span className="text-gray-600 text-xs">
                          {formatDate(reply.created_at)}
                        </span>
                        {getMentionBadge(reply.mention_type)}
                        {getReplyTypeBadge(reply.reply_type)}
                        {reply.status === "sent" ? (
                          <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-400 border-red-400/30 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
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

                      {reply.error_message && (
                        <div className="text-xs text-red-400 mt-2">
                          Error: {reply.error_message}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {reply.tweet_id && (
                        <a
                          href={`https://x.com/i/web/status/${reply.tweet_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-xs"
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
    </div>
  );
}
