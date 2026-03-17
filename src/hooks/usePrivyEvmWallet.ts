import { useMemo, useEffect, useState } from "react";
import { usePrivyAvailable, usePrivyBridge } from "@/providers/PrivyProviderWrapper";

const FALLBACK = { address: undefined, isReady: true, wallet: null } as const;

export function usePrivyEvmWallet() {
  const privyAvailable = usePrivyAvailable();
  const bridge = usePrivyBridge();
  const [creatingWallet, setCreatingWallet] = useState(false);

  const { privy, evmWallets, evmCreateWallet } = bridge;

  const evmWallet = useMemo(() => {
    if (!privyAvailable || !evmWallets || evmWallets.length === 0) return null;
    return evmWallets.find(
      (w: any) => w.walletClientType === "privy" && w.address?.startsWith("0x")
    ) || evmWallets.find(
      (w: any) => w.address?.startsWith("0x")
    ) || null;
  }, [evmWallets, privyAvailable]);

  const address = evmWallet?.address || undefined;

  useEffect(() => {
    if (!privyAvailable || !privy.ready || !privy.authenticated || evmWallet || creatingWallet) return;

    setCreatingWallet(true);
    evmCreateWallet.createWallet()
      .then((wallet: any) => {
        console.log("[usePrivyEvmWallet] Created EVM wallet:", wallet?.address);
      })
      .catch((err: any) => {
        console.warn("[usePrivyEvmWallet] Create wallet:", err?.message || err);
      })
      .finally(() => setCreatingWallet(false));
  }, [privy.ready, privy.authenticated, evmWallet, evmCreateWallet, creatingWallet, privyAvailable]);

  if (!privyAvailable) return FALLBACK;

  return {
    address,
    isReady: privy.ready && !creatingWallet,
    wallet: evmWallet,
  };
}
