import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivyAvailable, usePrivyBridge } from "@/providers/PrivyProviderWrapper";

export type ClaimWalletKind = "embedded" | "external";

export interface ClaimWalletOption {
  address: string;
  kind: ClaimWalletKind;
  label: string;
  wallet: any;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

const FALLBACK = {
  options: [] as ClaimWalletOption[],
  selected: null,
  selectedAddress: null as string | null,
  setSelectedAddress: (() => {}) as React.Dispatch<React.SetStateAction<string | null>>,
  isReady: false,
} as const;

export function useClaimWallet(preferredAddress?: string | null) {
  const privyAvailable = usePrivyAvailable();
  const bridge = usePrivyBridge();

  const { privy, solanaWallets } = bridge;

  const isPrivyEmbeddedWallet = useCallback((w: any) => {
    const walletClientType = w?.walletClientType;
    const standardName = w?.standardWallet?.name;
    const name = String(w?.name ?? "").toLowerCase();
    return (
      walletClientType === "privy" ||
      standardName === "Privy" ||
      name.includes("privy") ||
      name.includes("embedded")
    );
  }, []);

  const options: ClaimWalletOption[] = useMemo(() => {
    if (!privyAvailable) return [];
    const list = (solanaWallets ?? [])
      .filter((w: any) => typeof w?.address === "string" && w.address.length > 30)
      .map((w: any) => {
        const kind: ClaimWalletKind = isPrivyEmbeddedWallet(w) ? "embedded" : "external";
        const label = kind === "embedded" ? `Embedded (${shortAddr(w.address)})` : `${w?.standardWallet?.name ?? w?.name ?? "Wallet"} (${shortAddr(w.address)})`;
        return { address: w.address, kind, label, wallet: w };
      });
    list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "external" ? -1 : 1));
    return list;
  }, [solanaWallets, isPrivyEmbeddedWallet, privyAvailable]);

  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!privyAvailable || !options.length) {
      if (selectedAddress !== null) setSelectedAddress(null);
      return;
    }

    const preferred =
      preferredAddress && options.some((o) => o.address === preferredAddress)
        ? preferredAddress
        : null;

    if (preferred && selectedAddress !== preferred) {
      setSelectedAddress(preferred);
      return;
    }

    if (!selectedAddress || !options.some((o) => o.address === selectedAddress)) {
      setSelectedAddress(options[0].address);
    }
  }, [options, preferredAddress, selectedAddress, privyAvailable]);

  const selected = useMemo(() => {
    if (!selectedAddress) return null;
    return options.find((o) => o.address === selectedAddress) ?? null;
  }, [options, selectedAddress]);

  if (!privyAvailable) return FALLBACK;

  return {
    options,
    selected,
    selectedAddress,
    setSelectedAddress,
    isReady: privy.ready && privy.authenticated && !!selected?.address,
  };
}
