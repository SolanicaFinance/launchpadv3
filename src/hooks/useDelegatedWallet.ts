import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";

const DELEGATION_KEY = "claw_wallet_delegated";

const FALLBACK = {
  isDelegated: false,
  isDelegating: false,
  needsDelegation: false,
  requestDelegation: async () => {},
  dismiss: () => {},
  embeddedWallet: undefined,
} as const;

function useDelegatedWalletInner() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [isDelegated, setIsDelegated] = useState(() => {
    try {
      return localStorage.getItem(DELEGATION_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [isDelegating, setIsDelegating] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("claw_delegation_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const embeddedWallet = wallets?.find(
    (w: any) =>
      w.walletClientType === "privy" ||
      w.standardWallet?.name === "Privy" ||
      String(w?.name ?? "").toLowerCase().includes("privy")
  );

  useEffect(() => {
    if (embeddedWallet) {
      setIsDelegated(true);
      try {
        localStorage.setItem(DELEGATION_KEY, "true");
      } catch {}
    }
  }, [embeddedWallet]);

  const needsDelegation = false;

  const requestDelegation = useCallback(async () => {
    setIsDelegated(true);
    try {
      localStorage.setItem(DELEGATION_KEY, "true");
    } catch {}
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem("claw_delegation_dismissed", "true");
    } catch {}
  }, []);

  return {
    isDelegated,
    isDelegating,
    needsDelegation,
    requestDelegation,
    dismiss,
    embeddedWallet,
  };
}

export function useDelegatedWallet() {
  const privyAvailable = usePrivyAvailable();
  if (!privyAvailable) return FALLBACK;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useDelegatedWalletInner();
}
