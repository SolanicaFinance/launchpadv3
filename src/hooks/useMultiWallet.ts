/**
 * Multi-Wallet Management Hook (Axiom-style)
 *
 * Uses Privy HD wallets to create up to 25 embedded wallets per user.
 * Tracks active wallet, syncs labels to DB.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useWallets, useCreateWallet } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getRpcUrl } from "@/hooks/useSolanaWallet";

const MAX_WALLETS = 25;
const ACTIVE_WALLET_KEY = "claw_active_wallet";

export interface ManagedWallet {
  address: string;
  label: string;
  isDefault: boolean;
  balance: number | null; // null = not yet fetched
  index: number;
}

export function useMultiWallet() {
  const { profileId } = useAuth();
  const { wallets, ready } = useWallets();
  const { createWallet } = useCreateWallet();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rpcUrl = getRpcUrl().url;

  // Filter to embedded wallets only
  const embeddedWallets = useMemo(() => {
    if (!wallets) return [];
    return wallets.filter((w: any) => {
      const type = w?.walletClientType;
      const name = String(w?.standardWallet?.name ?? w?.name ?? "").toLowerCase();
      return type === "privy" || name.includes("privy") || name.includes("embedded");
    });
  }, [wallets]);

  // Load labels from DB
  useEffect(() => {
    if (!profileId) return;
    supabase
      .from("user_wallets")
      .select("wallet_address, label, is_default")
      .eq("profile_id", profileId)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((row) => {
          map[row.wallet_address] = row.label;
        });
        setLabels(map);
      });
  }, [profileId]);

  // Restore active wallet from localStorage
  useEffect(() => {
    if (embeddedWallets.length === 0) return;
    const stored = localStorage.getItem(ACTIVE_WALLET_KEY);
    if (stored && embeddedWallets.some((w: any) => w.address === stored)) {
      setActiveAddress(stored);
    } else {
      setActiveAddress(embeddedWallets[0]?.address || null);
    }
  }, [embeddedWallets]);

  // Build managed wallet list
  const managedWallets: ManagedWallet[] = useMemo(() => {
    return embeddedWallets.map((w: any, i: number) => ({
      address: w.address,
      label: labels[w.address] || (i === 0 ? "Main" : `Wallet ${i + 1}`),
      isDefault: i === 0,
      balance: balances[w.address] ?? null,
      index: i,
    }));
  }, [embeddedWallets, labels, balances]);

  const activeWallet = useMemo(() => {
    return managedWallets.find((w) => w.address === activeAddress) || managedWallets[0] || null;
  }, [managedWallets, activeAddress]);

  // Switch wallet
  const switchWallet = useCallback((address: string) => {
    setActiveAddress(address);
    localStorage.setItem(ACTIVE_WALLET_KEY, address);
  }, []);

  // Create new wallet
  const createNewWallet = useCallback(async () => {
    if (embeddedWallets.length >= MAX_WALLETS) {
      throw new Error(`Maximum ${MAX_WALLETS} wallets reached`);
    }
    setCreating(true);
    try {
      const newWallet = await createWallet({ createAdditional: true });
      const address = (newWallet as any)?.address;
      if (address && profileId) {
        const label = `Wallet ${embeddedWallets.length + 1}`;
        await supabase.from("user_wallets").upsert({
          profile_id: profileId,
          wallet_address: address,
          label,
          is_default: false,
        }, { onConflict: "profile_id,wallet_address" });
        setLabels((prev) => ({ ...prev, [address]: label }));
      }
      return address;
    } finally {
      setCreating(false);
    }
  }, [createWallet, embeddedWallets.length, profileId]);

  // Rename wallet
  const renameWallet = useCallback(async (address: string, newLabel: string) => {
    setLabels((prev) => ({ ...prev, [address]: newLabel }));
    if (profileId) {
      await supabase.from("user_wallets").upsert({
        profile_id: profileId,
        wallet_address: address,
        label: newLabel,
        is_default: false,
      }, { onConflict: "profile_id,wallet_address" });
    }
  }, [profileId]);

  // Refresh balances
  const refreshBalances = useCallback(async () => {
    if (embeddedWallets.length === 0) return;
    const connection = new Connection(rpcUrl, "confirmed");
    const results: Record<string, number> = {};
    await Promise.allSettled(
      embeddedWallets.map(async (w: any) => {
        try {
          const bal = await connection.getBalance(new PublicKey(w.address));
          results[w.address] = bal / LAMPORTS_PER_SOL;
        } catch {
          results[w.address] = 0;
        }
      })
    );
    setBalances(results);
  }, [embeddedWallets, rpcUrl]);

  // Auto-refresh balances on mount and when wallets change
  useEffect(() => {
    if (embeddedWallets.length > 0) {
      refreshBalances();
    }
  }, [embeddedWallets.length]);

  // Get Privy wallet object for a specific address (for signing)
  const getWalletByAddress = useCallback((address: string) => {
    return embeddedWallets.find((w: any) => w.address === address) || null;
  }, [embeddedWallets]);

  return {
    managedWallets,
    activeWallet,
    activeAddress: activeWallet?.address || null,
    switchWallet,
    createNewWallet,
    renameWallet,
    refreshBalances,
    getWalletByAddress,
    creating,
    ready,
    canCreateMore: embeddedWallets.length < MAX_WALLETS,
    walletCount: embeddedWallets.length,
  };
}
