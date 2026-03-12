import { useMemo, useEffect, useState } from "react";
import { useWallets, useCreateWallet, usePrivy } from "@privy-io/react-auth";

export function usePrivyEvmWallet() {
  const { wallets } = useWallets();
  const { ready, authenticated } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [creatingWallet, setCreatingWallet] = useState(false);

  const evmWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    // Privy embedded EVM wallet
    return wallets.find(
      (w) => w.walletClientType === "privy" && w.address?.startsWith("0x")
    ) || wallets.find(
      (w) => w.address?.startsWith("0x")
    ) || null;
  }, [wallets]);

  const address = evmWallet?.address || undefined;

  // Auto-create EVM wallet for logged-in users who don't have one
  useEffect(() => {
    if (!ready || !authenticated || evmWallet || creatingWallet) return;

    setCreatingWallet(true);
    createWallet()
      .then((wallet) => {
        console.log("[usePrivyEvmWallet] Created EVM wallet:", wallet?.address);
      })
      .catch((err: any) => {
        // "already has an embedded wallet" is expected
        console.warn("[usePrivyEvmWallet] Create wallet:", err?.message || err);
      })
      .finally(() => setCreatingWallet(false));
  }, [ready, authenticated, evmWallet, createWallet, creatingWallet]);

  return {
    address,
    isReady: ready && !creatingWallet,
    wallet: evmWallet,
  };
}
