import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface XBotAccount {
  id: string;
  name: string;
  username: string;
  email: string | null;
  password_encrypted: string | null;
  totp_secret_encrypted: string | null;
  full_cookie_encrypted: string | null;
  auth_token_encrypted: string | null;
  ct0_token_encrypted: string | null;
  proxy_url: string | null;
  socks5_urls: string[];
  current_socks5_index: number;
  last_socks5_failure_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subtuna_ticker: string | null;
}

export interface XBotAccountRules {
  id: string;
  account_id: string;
  monitored_mentions: string[];
  tracked_cashtags: string[];
  min_follower_count: number;
  require_blue_verified: boolean;
  require_gold_verified: boolean;
  author_cooldown_hours: number;
  max_replies_per_thread: number;
  enabled: boolean;
  persona_prompt: string | null;
  tracked_keywords: string[] | null;
  author_cooldown_minutes: number | null;
}

export interface XBotAccountReply {
  id: string;
  account_id: string;
  tweet_id: string;
  tweet_author: string;
  tweet_content: string;
  tweet_text: string;
  reply_content: string;
  reply_text: string;
  reply_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface XBotQueueItem {
  id: string;
  account_id: string;
  tweet_id: string;
  tweet_author: string;
  tweet_content: string;
  tweet_text: string;
  tweet_author_followers: number | null;
  tweet_author_verified: boolean | null;
  follower_count: number | null;
  match_type: string | null;
  status: string;
  created_at: string;
}

export interface XBotAccountLog {
  id: string;
  account_id: string | null;
  level: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface XBotAccountWithRules extends XBotAccount {
  rules?: XBotAccountRules;
}

// Get admin password from localStorage (set by admin panel login)
function getAdminPassword(): string {
  // admin_panel_auth_v2 stores "true" when authenticated; the actual password is needed for edge functions
  const isAuthed = localStorage.getItem("admin_panel_auth_v2") === "true";
  return isAuthed ? "saturn135@" : "";
}

// Helper to call the x-bot-admin edge function
async function callAdmin(action: string, params: Record<string, any> = {}) {
  const adminPassword = getAdminPassword();
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, adminPassword, ...params }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Admin call failed: ${response.status}`);
  return data;
}

export function useXBotAccounts() {
  const [accounts, setAccounts] = useState<XBotAccountWithRules[]>([]);
  const [replies, setReplies] = useState<XBotAccountReply[]>([]);
  const [queue, setQueue] = useState<XBotQueueItem[]>([]);
  const [logs, setLogs] = useState<XBotAccountLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const isAuthed = !!getAdminPassword();

  const fetchAccounts = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const [accountsResult, rulesResult] = await Promise.all([
        callAdmin("list_accounts"),
        callAdmin("list_rules"),
      ]);

      const accountsWithRules = (accountsResult.accounts || []).map((account: XBotAccount) => ({
        ...account,
        rules: rulesResult.rules?.find((r: XBotAccountRules) => r.account_id === account.id),
      }));

      setAccounts(accountsWithRules);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  }, [isAuthed]);

  const fetchReplies = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const data = await callAdmin("list_replies", { limit: 100 });
      setReplies(data.replies || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  }, [isAuthed]);

  const fetchQueue = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const data = await callAdmin("list_queue", { limit: 50 });
      setQueue(data.queue || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  }, [isAuthed]);

  const fetchLogs = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const data = await callAdmin("list_logs", { limit: 200 });
      setLogs((data.logs || []) as XBotAccountLog[]);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }, [isAuthed]);

  const createAccount = async (account: Partial<XBotAccount>, rules?: Partial<XBotAccountRules>) => {
    try {
      await callAdmin("create_account", { account, rules });
      toast({ title: "Account created successfully" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
      toast({ title: "Failed to create account", variant: "destructive" });
      throw error;
    }
  };

  const updateAccount = async (id: string, account: Partial<XBotAccount>, rules?: Partial<XBotAccountRules>) => {
    try {
      await callAdmin("update_account", { id, account, rules });
      toast({ title: "Account updated successfully" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error updating account:", error);
      toast({ title: "Failed to update account", variant: "destructive" });
      throw error;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await callAdmin("delete_account", { id });
      toast({ title: "Account deleted successfully" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({ title: "Failed to delete account", variant: "destructive" });
      throw error;
    }
  };

  const toggleAccountActive = async (id: string, isActive: boolean) => {
    try {
      await callAdmin("toggle_active", { id, is_active: isActive });
      toast({ title: isActive ? "Account enabled" : "Account disabled" });
      await fetchAccounts();
    } catch (error) {
      console.error("Error toggling account:", error);
      toast({ title: "Failed to toggle account", variant: "destructive" });
    }
  };

  const runScan = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      if (data.ok) {
        toast({ title: "Scan completed", description: `Queued ${data.debug?.queued || 0} tweets` });
      } else {
        toast({ title: "Scan failed", description: data.error || "Unknown error", variant: "destructive" });
      }
      await Promise.all([fetchQueue(), fetchLogs()]);
    } catch (error) {
      console.error("Error running scan:", error);
      toast({ title: "Scan failed", variant: "destructive" });
    }
  };

  const runReply = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      if (data.ok) {
        toast({ title: "Reply run completed", description: `Sent ${data.debug?.repliesSent || 0} replies` });
      } else {
        toast({ title: "Reply run failed", description: data.error || "Unknown error", variant: "destructive" });
      }
      await Promise.all([fetchReplies(), fetchQueue(), fetchLogs()]);
    } catch (error) {
      console.error("Error running reply:", error);
      toast({ title: "Reply run failed", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAccounts(), fetchReplies(), fetchQueue(), fetchLogs()]);
      setLoading(false);
    };
    loadAll();
  }, [isAuthed, fetchAccounts, fetchReplies, fetchQueue, fetchLogs]);

  return {
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
  };
}
