/**
 * Multi-Wallet Management Hook (Axiom-style)
 *
 * Uses Privy HD wallets to create up to 25 embedded wallets per user.
 * Tracks active wallet, syncs labels to DB.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useWallets, useCreateWallet } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { getPersistedOrder, clearPersistedOrder } from "@/hooks/useDevWalletRotation";

const MAX_WALLETS = 25;
const ACTIVE_WALLET_KEY = "claw_active_wallet";

export interface ManagedWallet {
  address: string;
  label: string;
  isDefault: boolean;
  balance: number | null;
  index: number;
}

const FALLBACK = {
  managedWallets: [] as ManagedWallet[],
  activeWallet: null,
  activeAddress: null as string | null,
  switchWallet: (_addr: string) => {},
  createNewWallet: async () => { throw new Error("Privy not available"); return "" as string; },
  renameWallet: async (_addr: string, _label: string) => {},
  hideWallet: async (_addr: string) => {},
  refreshBalances: async () => {},
  getWalletByAddress: (_addr: string) => null,
  creating: false,
  ready: false,
  canCreateMore: false,
  walletCount: 0,
} as const;

function useMultiWalletInner() {
  const { profileId } = useAuth();
  const { wallets, ready } = useWallets();
  const { createWallet } = useCreateWallet();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [hiddenAddresses, setHiddenAddresses] = useState<Set<string>>(new Set());
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const embeddedWalletsRef = useRef<any[]>([]);

  const rpcUrl = getRpcUrl().url;

  const embeddedWallets = useMemo(() => {
    if (!wallets) return [];
    return wallets.filter((w: any) => {
      const type = w?.walletClientType;
      const name = String(w?.standardWallet?.name ?? w?.name ?? "").toLowerCase();
      return type === "privy" || name.includes("privy") || name.includes("embedded");
    });
  }, [wallets]);

  useEffect(() => {
    embeddedWalletsRef.current = embeddedWallets;
  }, [embeddedWallets]);

  useEffect(() => {
    if (!profileId) return;
    supabase
      .from("user_wallets")
      .select("wallet_address, label, is_default, is_hidden")
      .eq("profile_id", profileId)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        const hidden = new Set<string>();
        data.forEach((row: any) => {
          map[row.wallet_address] = row.label;
          if (row.is_hidden) hidden.add(row.wallet_address);
        });
        setLabels(map);
        setHiddenAddresses(hidden);
      });
  }, [profileId]);

  useEffect(() => {
    if (embeddedWallets.length === 0) return;
    const stored = localStorage.getItem(ACTIVE_WALLET_KEY);
    if (stored && embeddedWallets.some((w: any) => w.address === stored)) {
      setActiveAddress(stored);
    } else {
      setActiveAddress(embeddedWallets[0]?.address || null);
    }
  }, [embeddedWallets]);

  // Auto-recovery: if a rotation order was persisted (page crash), finalize the switch
  useEffect(() => {
    if (embeddedWallets.length === 0 || !profileId) return;
    const order = getPersistedOrder();
    if (!order?.newWalletAddress) return;

    const newAddr = order.newWalletAddress;
    const found = embeddedWallets.some((w: any) => w.address === newAddr);
    if (!found) return;

    console.log("[MultiWallet] Recovering rotation – switching to", newAddr);
    setActiveAddress(newAddr);
    localStorage.setItem(ACTIVE_WALLET_KEY, newAddr);

    // Register in DB
    const idx = embeddedWallets.findIndex((w: any) => w.address === newAddr);
    const label = `Wallet ${idx + 1}`;
    supabase.from("user_wallets").upsert({
      profile_id: profileId,
      wallet_address: newAddr,
      label,
      is_default: false,
    }, { onConflict: "profile_id,wallet_address" }).then(() => {
      setLabels((prev) => ({ ...prev, [newAddr]: label }));
    });

    clearPersistedOrder();
  }, [embeddedWallets, profileId]);

  const managedWallets: ManagedWallet[] = useMemo(() => {
    return embeddedWallets
      .filter((w: any) => !hiddenAddresses.has(w.address))
      .map((w: any, i: number) => ({
        address: w.address,
        label: labels[w.address] || (i === 0 ? "Main" : `Wallet ${i + 1}`),
        isDefault: i === 0,
        balance: balances[w.address] ?? null,
        index: i,
      }));
  }, [embeddedWallets, labels, balances, hiddenAddresses]);

  // All addresses including hidden — for portfolio aggregation
  const allAddresses: string[] = useMemo(() => {
    return embeddedWallets.map((w: any) => w.address);
  }, [embeddedWallets]);

  const activeWallet = useMemo(() => {
    return managedWallets.find((w) => w.address === activeAddress) || managedWallets[0] || null;
  }, [managedWallets, activeAddress]);

  const switchWallet = useCallback((address: string) => {
    setActiveAddress(address);
    localStorage.setItem(ACTIVE_WALLET_KEY, address);
  }, []);

  const createNewWallet = useCallback(async () => {
    if (embeddedWallets.length >= MAX_WALLETS) {
      throw new Error(`Maximum ${MAX_WALLETS} wallets reached`);
    }

    const existingAddresses = new Set(embeddedWalletsRef.current.map((w: any) => w.address));

    setCreating(true);
    try {
      const newWallet = await createWallet({ createAdditional: true });
      let address = (newWallet as any)?.address as string | undefined;

      if (!address) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < 20000) {
          const detectedWallet = embeddedWalletsRef.current.find((w: any) => !existingAddresses.has(w.address));
          if (detectedWallet?.address) {
            address = detectedWallet.address;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (!address) {
        throw new Error("Wallet was created but is still syncing. Please try again in a moment.");
      }

      if (profileId) {
        const label = `Wallet ${embeddedWalletsRef.current.length}`;
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

  const hideWallet = useCallback(async (address: string) => {
    setHiddenAddresses((prev) => new Set([...prev, address]));
    if (profileId) {
      await supabase.from("user_wallets").upsert({
        profile_id: profileId,
        wallet_address: address,
        label: labels[address] || "Hidden",
        is_default: false,
        is_hidden: true,
      } as any, { onConflict: "profile_id,wallet_address" });
    }
  }, [profileId, labels]);

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

  useEffect(() => {
    if (embeddedWallets.length > 0) {
      refreshBalances();
    }
  }, [embeddedWallets.length]);

  const getWalletByAddress = useCallback((address: string) => {
    return embeddedWallets.find((w: any) => w.address === address) || null;
  }, [embeddedWallets]);

  return {
    managedWallets,
    allAddresses,
    activeWallet,
    activeAddress: activeAddress || activeWallet?.address || null,
    switchWallet,
    createNewWallet,
    renameWallet,
    hideWallet,
    refreshBalances,
    getWalletByAddress,
    creating,
    ready,
    canCreateMore: embeddedWallets.length < MAX_WALLETS,
    walletCount: embeddedWallets.length,
  };
}

export function useMultiWallet() {
  const privyAvailable = usePrivyAvailable();
  if (!privyAvailable) return FALLBACK;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useMultiWalletInner();
}
