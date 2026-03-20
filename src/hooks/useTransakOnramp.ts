import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useToast } from "@/hooks/use-toast";

const TRANSAK_API_KEY = import.meta.env.VITE_TRANSAK_API_KEY || "";
const TRANSAK_ENV = "PRODUCTION";
const TRANSAK_BASE_URL = "https://global.transak.com";

interface TransakOptions {
  /** Fiat amount to prefill */
  fiatAmount?: number;
  /** Fiat currency code (default: USD) */
  fiatCurrency?: string;
  /** Crypto to buy (default: SOL) */
  cryptoCurrency?: string;
}

export function useTransakOnramp() {
  const { isAuthenticated, solanaAddress } = useAuth();
  const { getEmbeddedWallet, walletAddress: privyWalletAddress } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);

  const walletAddress = privyWalletAddress || solanaAddress;

  const openTransak = useCallback((options?: TransakOptions) => {
    if (!TRANSAK_API_KEY) {
      toast({ title: "Configuration error", description: "Transak API key not configured", variant: "destructive" });
      return;
    }

    if (!walletAddress) {
      toast({ title: "No wallet", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    const params = new URLSearchParams({
      apiKey: TRANSAK_API_KEY,
      environment: TRANSAK_ENV,
      cryptoCurrencyCode: options?.cryptoCurrency || "SOL",
      network: "solana",
      walletAddress: walletAddress,
      defaultPaymentMethod: "credit_debit_card",
      disableWalletAddressForm: "true",
      themeColor: "7c3aed",
      hideMenu: "true",
    });

    if (options?.fiatAmount) {
      params.set("defaultFiatAmount", String(options.fiatAmount));
    }
    if (options?.fiatCurrency) {
      params.set("defaultFiatCurrency", options.fiatCurrency);
    }

    const url = `${TRANSAK_BASE_URL}?${params.toString()}`;
    setWidgetUrl(url);
    setIsOpen(true);
  }, [walletAddress, toast]);

  const closeTransak = useCallback(() => {
    setIsOpen(false);
    setWidgetUrl(null);
  }, []);

  return {
    openTransak,
    closeTransak,
    isOpen,
    widgetUrl,
    isReady: !!TRANSAK_API_KEY && !!walletAddress,
    walletAddress,
  };
}
