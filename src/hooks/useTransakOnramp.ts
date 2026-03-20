import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TransakOptions {
  fiatAmount?: number;
  fiatCurrency?: string;
  cryptoCurrency?: string;
}

export function useTransakOnramp() {
  const { isAuthenticated, solanaAddress } = useAuth();
  const { getEmbeddedWallet, walletAddress: privyWalletAddress } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const walletAddress = privyWalletAddress || solanaAddress;

  const openTransak = useCallback(async (options?: TransakOptions) => {
    if (!walletAddress) {
      toast({ title: "No wallet", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("transak-widget-url", {
        body: {
          walletAddress,
          fiatAmount: options?.fiatAmount,
          fiatCurrency: options?.fiatCurrency,
          cryptoCurrency: options?.cryptoCurrency,
        },
      });

      if (error) throw error;

      const url = data?.widgetUrl;
      if (!url) throw new Error("No widget URL returned");

      setWidgetUrl(url);
      setIsOpen(true);
    } catch (err: any) {
      console.error("[Transak] Failed to create widget URL:", err);
      toast({
        title: "Failed to open buy widget",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
    isLoading,
    isReady: !!walletAddress,
    walletAddress,
  };
}
