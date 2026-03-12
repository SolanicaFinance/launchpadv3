import { useMemo, useEffect, useState } from "react";
import { useWallets, useCreateWallet } from "@privy-io/react-auth";

export function usePrivyEvmWallet() {
  const { wallets, ready } = useWallets();
  const { createWallet } = useCreateWallet();
  const [creatingWallet, setCreatingWallet] = useState(false);

  // Debug: log all wallets from Privy
  useEffect(() => {
    if (ready && wallets && wallets.length > 0) {
      console.log("[usePrivyEvmWallet] All Privy wallets:", wallets.map((w: any) => ({
        address: w.address,
        chainType: w.chainType,
        walletClientType: w.walletClientType,
        type: w.type,
        connectorType: w.connectorType,
      })));
    }
  }, [ready, wallets]);

  const evmWallet = useMemo(() => {
    if (!wallets || wallets.length === 0) return null;
    // Try multiple detection strategies
    const found = wallets.find(
      (w: any) =>
        w.walletClientType === "privy" &&
        (w.chainType === "ethereum" || (w.address && w.address.startsWith("0x")))
    ) || wallets.find(
      (w: any) => w.address && w.address.startsWith("0x")
    ) || null;
    if (found) {
      console.log("[usePrivyEvmWallet] Found EVM wallet:", found.address, "chainType:", (found as any).chainType);
    }
    return found;
  }, [wallets]);

  const address = evmWallet?.address || undefined;

  // Force create EVM wallet for existing users who don't have one
  useEffect(() => {
    if (!ready || evmWallet || creatingWallet) return;
    // Check if user is logged in (has any privy wallet)
    const hasAnyPrivyWallet = wallets.some(
      (w: any) => w.walletClientType === "privy"
    );
    if (!hasAnyPrivyWallet && wallets.length === 0) return; // not logged in

    console.log("[usePrivyEvmWallet] No EVM wallet found, attempting to create one...");
    setCreatingWallet(true);
    (createWallet as any)({ chainType: "ethereum" })
      .then((wallet: any) => {
        console.log("[usePrivyEvmWallet] Created EVM wallet:", wallet?.address);
      })
      .catch((err: any) => {
        console.warn("[usePrivyEvmWallet] Failed to create embedded EVM wallet:", err?.message || err);
      })
      .finally(() => setCreatingWallet(false));
  }, [ready, evmWallet, wallets, createWallet, creatingWallet]);

  return {
    address,
    isReady: ready && !creatingWallet,
    wallet: evmWallet,
  };
}
