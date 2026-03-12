import { useMemo, useEffect, useState } from "react";
import { useWallets, useCreateWallet } from "@privy-io/react-auth";

export function usePrivyEvmWallet() {
  const { wallets, ready } = useWallets();
  const { createWallet } = useCreateWallet();
  const [creatingWallet, setCreatingWallet] = useState(false);

  const evmWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    return wallets.find(
      (w: any) =>
        w.walletClientType === "privy" &&
        (w.chainType === "ethereum" || (w.address && w.address.startsWith("0x")))
    ) || null;
  }, [wallets]);

  const address = evmWallet?.address || undefined;

  // Force create EVM wallet for existing users who don't have one
  useEffect(() => {
    if (!ready || evmWallet || creatingWallet) return;
    const hasSolanaWallet = wallets.some(
      (w: any) => w.walletClientType === "privy" && w.chainType === "solana"
    );
    if (!hasSolanaWallet) return; // not logged in

    setCreatingWallet(true);
    (createWallet as any)({ chainType: "ethereum" })
      .catch((err: any) => {
        console.warn("Failed to create embedded EVM wallet:", err);
      })
      .finally(() => setCreatingWallet(false));
  }, [ready, evmWallet, wallets, createWallet, creatingWallet]);

  return {
    address,
    isReady: ready && !creatingWallet,
    wallet: evmWallet,
  };
}
