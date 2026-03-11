import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface TrackedWallet {
  id: string;
  wallet_address: string;
  wallet_label: string | null;
  created_at: string;
  is_copy_trading_enabled: boolean;
  notifications_enabled: boolean;
  total_pnl_sol: number | null;
  trades_copied: number | null;
}

export interface WalletWithBalance extends TrackedWallet {
  balance: number | null;
  lastActive: string | null;
}

export const TRACKER_TABS = ["All", "Manager", "Trades", "Monitor"] as const;
export type TrackerTab = typeof TRACKER_TABS[number];

function getRpcUrl(): string {
  if (typeof window !== "undefined" && (window as any).__PUBLIC_CONFIG__?.HELIUS_RPC_URL) {
    return (window as any).__PUBLIC_CONFIG__.HELIUS_RPC_URL;
  }
  return import.meta.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
}

export function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function useWalletTracker() {
  const { isAuthenticated, profileId, login } = useAuth();
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchWallets = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "list", user_profile_id: profileId },
      });
      if (fnError) throw fnError;
      const tracked = (resp?.data || []) as TrackedWallet[];

      const connection = new Connection(getRpcUrl(), "confirmed");
      const enriched: WalletWithBalance[] = await Promise.all(
        tracked.map(async (w) => {
          let balance: number | null = null;
          let lastActive: string | null = null;
          try {
            const pub = new PublicKey(w.wallet_address);
            const [lamports, sigs] = await Promise.all([
              connection.getBalance(pub),
              connection.getSignaturesForAddress(pub, { limit: 1 }),
            ]);
            balance = lamports / LAMPORTS_PER_SOL;
            if (sigs.length > 0 && sigs[0].blockTime) {
              lastActive = new Date(sigs[0].blockTime * 1000).toISOString();
            }
          } catch {}
          return { ...w, balance, lastActive };
        })
      );
      setWallets(enriched);
    } catch (err) {
      console.error("Failed to fetch tracked wallets:", err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (profileId) fetchWallets();
  }, [profileId, fetchWallets]);

  const addWallet = async (address: string, label: string | null) => {
    if (!profileId || !address.trim()) return;
    setAdding(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke("wallet-tracker-manage", {
        body: {
          action: "add",
          user_profile_id: profileId,
          wallet_address: address.trim(),
          wallet_label: label?.trim() || null,
        },
      });
      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);
      fetchWallets();
      return true;
    } catch (err) {
      console.error("Failed to add wallet:", err);
      return false;
    } finally {
      setAdding(false);
    }
  };

  const removeWallet = async (id: string) => {
    try {
      await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "remove", user_profile_id: profileId, wallet_id: id },
      });
      setWallets((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to remove wallet:", err);
    }
  };

  const removeAll = async () => {
    if (!profileId) return;
    try {
      await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "clear", user_profile_id: profileId },
      });
      setWallets([]);
    } catch (err) {
      console.error("Failed to remove wallets:", err);
    }
  };

  return {
    isAuthenticated,
    login,
    wallets,
    loading,
    adding,
    fetchWallets,
    addWallet,
    removeWallet,
    removeAll,
  };
}
