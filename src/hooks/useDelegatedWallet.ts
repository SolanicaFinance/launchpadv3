import { useCallback, useState } from "react";
import { usePrivyAvailable, usePrivyBridge } from "@/providers/PrivyProviderWrapper";

const DELEGATION_KEY = "claw_wallet_delegated";

const FALLBACK = {
  isDelegated: false,
  isDelegating: false,
  needsDelegation: false,
  requestDelegation: async () => {},
  dismiss: () => {},
  embeddedWallet: undefined,
} as const;

export function useDelegatedWallet() {
  const privyAvailable = usePrivyAvailable();
  const bridge = usePrivyBridge();

  const { solanaWallets } = bridge;

  // Track which addresses have been delegated (persisted per-address)
  const [delegatedAddresses, setDelegatedAddresses] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(DELEGATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
      return new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [isDelegating, setIsDelegating] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem("claw_delegation_dismissed") === "true"; } catch { return false; }
  });

  const embeddedWallet = privyAvailable ? solanaWallets?.find(
    (w: any) =>
      w.walletClientType === "privy" ||
      w.standardWallet?.name === "Privy" ||
      String(w?.name ?? "").toLowerCase().includes("privy")
  ) : undefined;

  const walletAddress = embeddedWallet?.address;
  const isDelegated = !!(walletAddress && delegatedAddresses.has(walletAddress));
  const needsDelegation = privyAvailable && !!walletAddress && !isDelegated && !dismissed;

  const saveDelegated = useCallback((addr: string) => {
    setDelegatedAddresses((prev) => {
      const next = new Set(prev);
      next.add(addr);
      try { localStorage.setItem(DELEGATION_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // TEE mode: "delegation" just marks the address as ready since server already has signing access
  const requestDelegation = useCallback(async () => {
    if (!walletAddress) throw new Error("No embedded wallet found");
    setIsDelegating(true);
    try {
      console.log("[delegation] TEE mode — marking wallet as ready:", walletAddress);
      // In TEE mode, the server already has signing access.
      // We just persist the flag so the prompt doesn't show again.
      saveDelegated(walletAddress);
      console.log("[delegation] ✅ Wallet marked as ready:", walletAddress);
    } finally {
      setIsDelegating(false);
    }
  }, [walletAddress, saveDelegated]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { sessionStorage.setItem("claw_delegation_dismissed", "true"); } catch {}
  }, []);

  if (!privyAvailable) return FALLBACK;

  return {
    isDelegated,
    isDelegating,
    needsDelegation,
    requestDelegation,
    dismiss,
    embeddedWallet,
  };
}
