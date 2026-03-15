import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  created_at: string;
}

export interface XBotAccountReply {
  id: string;
  account_id: string;
  tweet_id: string;
  tweet_author: string | null;
  tweet_author_id: string | null;
  tweet_text: string | null;
  conversation_id: string | null;
  reply_id: string | null;
  reply_text: string | null;
  reply_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface XBotQueueItem {
  id: string;
  account_id: string;
  tweet_id: string;
  tweet_author: string | null;
  tweet_author_id: string | null;
  tweet_text: string | null;
  conversation_id: string | null;
  follower_count: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export interface XBotAccountLog {
  id: string;
  account_id: string;
  log_type: string;
  level: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface XBotAccountWithRules extends XBotAccount {
  rules?: XBotAccountRules;
}

// Helper to call the x-bot-admin edge function
async function callAdmin(action: string, adminWallet: string, params: Record<string, any> = {}) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-bot-admin`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, adminWallet, ...params }),
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
  const { solanaAddress } = useAuth();

  const adminWallet = solanaAddress || "";

  const fetchAccounts = useCallback(async () => {
    if (!adminWallet) return;
    try {
      const [accountsResult, rulesResult] = await Promise.all([
        callAdmin("list_accounts", adminWallet),
        callAdmin("list_rules", adminWallet),
      ]);

      const accountsWithRules = (accountsResult.accounts || []).map((account: XBotAccount) => ({
        ...account,
        rules: rulesResult.rules?.find((r: XBotAccountRules) => r.account_id === account.id),
      }));

      setAccounts(accountsWithRules);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  }, [adminWallet]);

  const fetchReplies = useCallback(async (accountId?: string) => {
    if (!adminWallet) return;
    try {
      const data = await callAdmin("list_replies", adminWallet, { limit: 100 });
      setReplies(data.replies || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  }, [adminWallet]);

  const fetchQueue = useCallback(async (accountId?: string) => {
    if (!adminWallet) return;
    try {
      const data = await callAdmin("list_queue", adminWallet, { limit: 50 });
      setQueue(data.queue || []);
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  }, [adminWallet]);

  const fetchLogs = useCallback(async (accountId?: string) => {
    if (!adminWallet) return;
    try {
      const data = await callAdmin("list_logs", adminWallet, { limit: 200 });
      setLogs((data.logs || []) as XBotAccountLog[]);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }, [adminWallet]);

  const createAccount = async (account: Partial<XBotAccount>, rules?: Partial<XBotAccountRules>) => {
    try {
      await callAdmin("create_account", adminWallet, { account, rules });
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
      await callAdmin("update_account", adminWallet, { id, account, rules });
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
      await callAdmin("delete_account", adminWallet, { id });
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
      await callAdmin("toggle_active", adminWallet, { id, is_active: isActive });
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
    if (!adminWallet) {
      setLoading(false);
      return;
    }
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchAccounts(), fetchReplies(), fetchQueue(), fetchLogs()]);
      setLoading(false);
    };
    loadAll();
  }, [adminWallet, fetchAccounts, fetchReplies, fetchQueue, fetchLogs]);

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
