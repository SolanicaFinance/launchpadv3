import { useMemo, useEffect, useState } from "react";
import { useWallets, useCreateWallet, usePrivy } from "@privy-io/react-auth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";

export function usePrivyEvmWallet() {
  const privyAvailable = usePrivyAvailable();
  const { wallets } = useWallets();
  const { ready: privyReady, authenticated: privyAuth } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [creatingWallet, setCreatingWallet] = useState(false);

  const ready = privyAvailable ? privyReady : true;
  const authenticated = privyAvailable ? privyAuth : false;

  const evmWallet = useMemo(() => {
    if (!privyAvailable || !wallets || wallets.length === 0) return null;
    return wallets.find(
      (w) => w.walletClientType === "privy" && w.address?.startsWith("0x")
    ) || wallets.find(
      (w) => w.address?.startsWith("0x")
    ) || null;
  }, [wallets, privyAvailable]);

  const address = evmWallet?.address || undefined;

  useEffect(() => {
    if (!privyAvailable || !ready || !authenticated || evmWallet || creatingWallet) return;

    setCreatingWallet(true);
    createWallet()
      .then((wallet) => {
        console.log("[usePrivyEvmWallet] Created EVM wallet:", wallet?.address);
      })
      .catch((err: any) => {
        console.warn("[usePrivyEvmWallet] Create wallet:", err?.message || err);
      })
      .finally(() => setCreatingWallet(false));
  }, [privyAvailable, ready, authenticated, evmWallet, createWallet, creatingWallet]);

  return {
    address,
    isReady: ready && !creatingWallet,
    wallet: evmWallet,
  };
}
