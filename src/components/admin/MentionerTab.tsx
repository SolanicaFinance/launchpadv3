import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Users, Play, Pause, Trash2, Search,
  CheckCircle, XCircle, Clock, Send, Shield, RefreshCw,
} from "lucide-react";

interface BotAccount {
  id: string;
  name: string;
  username: string;
  is_active: boolean;
  has_full_cookie: boolean;
  has_auth_token: boolean;
  socks5_urls: string[];
}

interface Campaign {
  id: string;
  account_id: string;
  source_username: string;
  source_url: string | null;
  interval_minutes: number;
  is_active: boolean;
  socks5_url: string | null;
  total_targets: number;
  sent_count: number;
  current_index: number;
  pitch_template: string | null;
  created_at: string;
  updated_at: string;
}

interface Target {
  id: string;
  campaign_id: string;
  username: string;
  display_name: string | null;
  status: string;
  sent_at: string | null;
  reply_text: string | null;
  error_message: string | null;
  created_at: string;
}

function getAdminPassword(): string {
  return localStorage.getItem("admin_panel_auth_v2") === "true" ? "saturn135@" : "";
}

async function callMentioner(action: string, params: Record<string, any> = {}) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentioner-admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, adminPassword: getAdminPassword(), ...params }),
    }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Request failed: ${resp.status}`);
  return data;
}

async function callBotAdmin(action: string, params: Record<string, any> = {}) {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, adminPassword: getAdminPassword(), ...params }),
    }
  );
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Request failed: ${resp.status}`);
  return data;
}

export function MentionerTab() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BotAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // New campaign form
  const [showForm, setShowForm] = useState(false);
  const [formAccountId, setFormAccountId] = useState("");
  const [formSourceUrl, setFormSourceUrl] = useState("");
  const [formInterval, setFormInterval] = useState("3");
  const [formSocks5, setFormSocks5] = useState("");
  const [formPitch, setFormPitch] = useState(
    "Saturn Terminal is a recently launched Trading Terminal product. It supports trading on Solana, BNB Chain, and has launched Bitcoin meme trading with its own protocol called TAT. The platform has a token called CLAW. The team is looking for investors and collaborators."
  );
  const [socks5Status, setSocks5Status] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const fetchData = useCallback(async () => {
    try {
      const [accResult, campResult] = await Promise.all([
        callBotAdmin("list_accounts"),
        callMentioner("list_campaigns"),
      ]);
      setAccounts(
        (accResult.accounts || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          username: a.username,
          is_active: a.is_active,
          has_full_cookie: a.has_full_cookie,
          has_auth_token: a.has_auth_token,
          socks5_urls: a.socks5_urls || [],
        }))
      );
      setCampaigns(campResult.campaigns || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTargets = useCallback(async (campaignId: string) => {
    try {
      const result = await callMentioner("list_targets", { campaign_id: campaignId, limit: 500 });
      setTargets(result.targets || []);
    } catch (err) {
      console.error("Fetch targets error:", err);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedCampaign) fetchTargets(selectedCampaign); }, [selectedCampaign, fetchTargets]);

  const extractUsername = (url: string) => {
    const match = url.match(/x\.com\/([^/]+)/);
    return match ? match[1] : url.replace("@", "");
  };

  const verifySocks5 = async () => {
    if (!formSocks5) return;
    setSocks5Status("checking");
    try {
      const result = await callMentioner("verify_socks5", { socks5_url: formSocks5 });
      setSocks5Status(result.valid ? "valid" : "invalid");
      toast({ title: result.message });
    } catch {
      setSocks5Status("invalid");
      toast({ title: "SOCKS5 verification failed", variant: "destructive" });
    }
  };

  const createCampaign = async () => {
    if (!formAccountId || !formSourceUrl) {
      toast({ title: "Select an account and enter source URL", variant: "destructive" });
      return;
    }
    try {
      const username = extractUsername(formSourceUrl);
      await callMentioner("create_campaign", {
        campaign: {
          account_id: formAccountId,
          source_username: username,
          source_url: formSourceUrl,
          interval_minutes: parseInt(formInterval) || 3,
          socks5_url: formSocks5 || null,
          pitch_template: formPitch || null,
        },
      });
      toast({ title: "Campaign created" });
      setShowForm(false);
      setFormSourceUrl("");
      await fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const scrapeFollowing = async (campaign: Campaign) => {
    setScraping(true);
    try {
      const result = await callMentioner("scrape_following", {
        campaign_id: campaign.id,
        username: campaign.source_username,
      });
      toast({ title: `Scraped ${result.count} accounts from @${campaign.source_username}` });
      await fetchData();
      if (selectedCampaign === campaign.id) await fetchTargets(campaign.id);
    } catch (err: any) {
      toast({ title: `Scrape failed: ${err.message}`, variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const toggleCampaign = async (campaign: Campaign) => {
    try {
      await callMentioner("update_campaign", {
        id: campaign.id,
        updates: { is_active: !campaign.is_active },
      });
      toast({ title: campaign.is_active ? "Campaign paused" : "Campaign activated" });
      await fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await callMentioner("delete_campaign", { id });
      toast({ title: "Campaign deleted" });
      if (selectedCampaign === id) { setSelectedCampaign(null); setTargets([]); }
      await fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const processNext = async (campaignId: string) => {
    setSending(true);
    try {
      const result = await callMentioner("process_next", { campaign_id: campaignId });
      if (result.success && result.tweet) {
        toast({ title: "Mention sent!", description: result.tweet.substring(0, 100) + "..." });
      } else {
        toast({ title: result.message || "No pending targets" });
      }
      await fetchData();
      if (selectedCampaign === campaignId) await fetchTargets(campaignId);
    } catch (err: any) {
      toast({ title: `Send failed: ${err.message}`, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendToTarget = async (campaignId: string, targetId: string) => {
    setSending(true);
    try {
      const result = await callMentioner("send_mention", { campaign_id: campaignId, target_id: targetId });
      if (result.success) {
        toast({ title: "Mention sent!" });
      } else {
        toast({ title: `Failed: ${result.error}`, variant: "destructive" });
      }
      await fetchTargets(campaignId);
      await fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCampaign = campaigns.find(c => c.id === selectedCampaign);
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Mentioner System
          </h2>
          <p className="text-sm text-muted-foreground">
            Scrape following lists & send AI-generated pitch mentions
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Create Campaign Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">New Mentioner Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Bot Account (sender)</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        @{a.username} ({a.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source X Profile URL (whose following to scrape)</Label>
                <Input
                  value={formSourceUrl}
                  onChange={e => setFormSourceUrl(e.target.value)}
                  placeholder="https://x.com/cz_binance/following"
                />
              </div>
              <div>
                <Label>Interval (minutes between mentions)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formInterval}
                  onChange={e => setFormInterval(e.target.value)}
                  placeholder="3"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  SOCKS5 Proxy
                  {socks5Status === "valid" && <CheckCircle className="h-3 w-3 text-primary" />}
                  {socks5Status === "invalid" && <XCircle className="h-3 w-3 text-destructive" />}
                  {socks5Status === "checking" && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formSocks5}
                    onChange={e => { setFormSocks5(e.target.value); setSocks5Status("idle"); }}
                    placeholder="socks5://user:pass@host:port"
                  />
                  <Button variant="outline" size="sm" onClick={verifySocks5} disabled={!formSocks5}>
                    <Shield className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label>Pitch Context (used by AI to generate unique messages)</Label>
              <Textarea
                value={formPitch}
                onChange={e => setFormPitch(e.target.value)}
                rows={3}
                placeholder="Describe what to pitch..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createCampaign}>Create Campaign</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">No campaigns yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => {
                  const acc = accountMap[c.account_id];
                  return (
                    <TableRow
                      key={c.id}
                      className={selectedCampaign === c.id ? "bg-muted/50" : "cursor-pointer hover:bg-muted/30"}
                      onClick={() => setSelectedCampaign(c.id)}
                    >
                      <TableCell>
                        <span className="font-medium">@{c.source_username}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          @{acc?.username || "unknown"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">
                            {c.sent_count}/{c.total_targets}
                          </span>
                          {c.total_targets > 0 && (
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.min((c.sent_count / c.total_targets) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{c.interval_minutes}m</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={() => toggleCampaign(c)}
                          onClick={e => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => scrapeFollowing(c)}
                            disabled={scraping}
                            title="Scrape following"
                          >
                            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => processNext(c.id)}
                            disabled={sending || c.total_targets === 0}
                            title="Send next mention"
                          >
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCampaign(c.id)}
                            title="Delete"
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Targets List */}
      {selectedCampaign && activeCampaign && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">
              Targets from @{activeCampaign.source_username}
                          <Badge variant="outline" className="ml-2">{targets.length} accounts</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => fetchTargets(selectedCampaign)}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {targets.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No targets scraped yet. Click the <Search className="h-3 w-3 inline" /> button on the campaign to scrape the following list.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reply</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">@{t.username}</span>
                            {t.display_name && (
                              <span className="block text-xs text-muted-foreground">{t.display_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.status === "sent" ? "default" : t.status === "failed" ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {t.status === "sent" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {t.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                            {t.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {t.reply_text ? (
                            <span className="text-xs text-muted-foreground truncate block">{t.reply_text}</span>
                          ) : t.error_message ? (
                            <span className="text-xs text-destructive truncate block">{t.error_message}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.sent_at ? new Date(t.sent_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {t.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => sendToTarget(selectedCampaign, t.id)}
                              disabled={sending}
                              title="Send to this user"
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
