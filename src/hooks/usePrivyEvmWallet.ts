import { useMemo, useEffect, useState } from "react";
import { useWallets, useCreateWallet, usePrivy } from "@privy-io/react-auth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";

const FALLBACK = { address: undefined, isReady: true, wallet: null } as const;

function usePrivyEvmWalletInner() {
  const { wallets } = useWallets();
  const { ready, authenticated } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [creatingWallet, setCreatingWallet] = useState(false);

  const evmWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    return wallets.find(
      (w) => w.walletClientType === "privy" && w.address?.startsWith("0x")
    ) || wallets.find(
      (w) => w.address?.startsWith("0x")
    ) || null;
  }, [wallets]);

  const address = evmWallet?.address || undefined;

  useEffect(() => {
    if (!ready || !authenticated || evmWallet || creatingWallet) return;

    setCreatingWallet(true);
    createWallet()
      .then((wallet) => {
        console.log("[usePrivyEvmWallet] Created EVM wallet:", wallet?.address);
      })
      .catch((err: any) => {
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

export function usePrivyEvmWallet() {
  const privyAvailable = usePrivyAvailable();
  if (!privyAvailable) return FALLBACK;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePrivyEvmWalletInner();
}
