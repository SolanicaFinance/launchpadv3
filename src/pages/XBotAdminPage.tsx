import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useXBotAccounts, type XBotAccountWithRules, type XBotAccountRules } from "@/hooks/useXBotAccounts";
import { XBotAccountsPanel } from "@/components/admin/XBotAccountsPanel";
import { XBotAccountForm } from "@/components/admin/XBotAccountForm";
import { XBotRulesForm } from "@/components/admin/XBotRulesForm";
import { XBotActivityPanel } from "@/components/admin/XBotActivityPanel";
import { Play, RefreshCw, Shield, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function XBotAdminPage() {

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showRulesForm, setShowRulesForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<XBotAccountWithRules | null>(null);
  const [viewingAccount, setViewingAccount] = useState<XBotAccountWithRules | null>(null);
  const [learningVoice, setLearningVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState<Record<string, unknown> | null>(null);

  const {
    accounts,
    replies,
    queue,
    logs,
    loading,
    fetchAccounts,
    fetchReplies,
    fetchQueue,
    fetchLogs,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleAccountActive,
    runScan,
    runReply,
  } = useXBotAccounts();

  const handleAddAccount = () => {
    setSelectedAccount(null);
    setShowAccountForm(true);
  };

  const handleEditAccount = (account: XBotAccountWithRules) => {
    setSelectedAccount(account);
    setShowAccountForm(true);
  };

  const handleEditRules = (account: XBotAccountWithRules) => {
    setSelectedAccount(account);
    setShowRulesForm(true);
  };

  const handleViewActivity = (account: XBotAccountWithRules) => {
    setViewingAccount(account);
  };

  const handleSaveAccount = async (data: Partial<XBotAccountWithRules>) => {
    if (selectedAccount) {
      await updateAccount(selectedAccount.id, data);
    } else {
      await createAccount(data);
    }
  };

  const handleSaveRules = async (rules: Partial<XBotAccountRules>) => {
    if (selectedAccount) {
      await updateAccount(selectedAccount.id, {}, rules);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchAccounts(), fetchReplies(), fetchQueue()]);
  };

  const handleLearnVoice = async () => {
    setLearningVoice(true);
    setVoiceResult(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-learn-voice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ username: "LobstarWilde", count: 100 }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setVoiceResult(data.style);
        toast.success(`Learned voice from ${data.tweetsAnalyzed} tweets!`);
      } else {
        toast.error(data.error || "Failed to learn voice");
      }
    } catch (err) {
      toast.error("Failed to reach learn-voice function");
      console.error(err);
    } finally {
      setLearningVoice(false);
    }
  };

  const activeAccounts = accounts.filter((a) => a.is_active);
  const totalActiveRules = accounts.filter((a) => a.is_active && a.rules?.enabled).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">X Bot Admin</h1>
            <p className="text-muted-foreground">
              Manage multiple X reply bot accounts
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={runScan}>
              <Play className="w-4 h-4 mr-2" />
              Run Scan
            </Button>
            <Button variant="outline" onClick={handleLearnVoice} disabled={learningVoice}>
              <Brain className={`w-4 h-4 mr-2 ${learningVoice ? "animate-pulse" : ""}`} />
              {learningVoice ? "Learning..." : "Learn Voice"}
            </Button>
            <Button onClick={runReply}>
              <Play className="w-4 h-4 mr-2" />
              Run Reply
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{accounts.length}</div>
              <div className="text-sm text-muted-foreground">Total Accounts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">
                {activeAccounts.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Accounts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{totalActiveRules}</div>
              <div className="text-sm text-muted-foreground">Rules Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {queue.filter((q) => q.status === "pending").length}
              </div>
              <div className="text-sm text-muted-foreground">Queued Tweets</div>
            </CardContent>
          </Card>
        </div>

        {/* Voice Learning Result */}
        {voiceResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🦞 Learned Voice: @LobstarWilde</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Tone:</span> <span className="font-medium">{String(voiceResult.tone)}</span></div>
                <div><span className="text-muted-foreground">Energy:</span> <span className="font-medium">{String(voiceResult.energy_level || "—")}</span></div>
                <div><span className="text-muted-foreground">Vocabulary:</span> <span className="font-medium">{String(voiceResult.vocabulary_style)}</span></div>
                <div><span className="text-muted-foreground">Emojis:</span> <span className="font-medium">{(voiceResult.preferred_emojis as string[] || []).join(" ")}</span></div>
              </div>
              {voiceResult.sample_voice && (
                <div className="mt-3 p-3 bg-muted rounded-md text-sm italic">
                  "{String(voiceResult.sample_voice)}"
                </div>
              )}
              {voiceResult.humor_patterns && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <strong>Humor:</strong> {String(voiceResult.humor_patterns)}
                </div>
              )}
              {voiceResult.common_phrases && (
                <div className="mt-2 text-sm">
                  <strong>Phrases:</strong> {(voiceResult.common_phrases as string[]).join(" • ")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Accounts Panel */}
          <XBotAccountsPanel
            accounts={accounts}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onEditRules={handleEditRules}
            onDeleteAccount={deleteAccount}
            onToggleActive={toggleAccountActive}
            onViewActivity={handleViewActivity}
          />

          {/* Activity Panel */}
          <XBotActivityPanel
            account={viewingAccount}
            replies={replies}
            queue={queue}
            logs={logs}
            onRefresh={handleRefresh}
            loading={loading}
          />
        </div>

        {/* Modals */}
        <XBotAccountForm
          open={showAccountForm}
          onClose={() => setShowAccountForm(false)}
          account={selectedAccount}
          onSave={handleSaveAccount}
        />

        {selectedAccount && (
          <XBotRulesForm
            open={showRulesForm}
            onClose={() => setShowRulesForm(false)}
            account={selectedAccount}
            onSave={handleSaveRules}
          />
        )}
      </div>
    </div>
  );
}
