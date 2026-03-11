import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface BribeInitResult {
  bribeId: string;
  walletAddress: string;
  amountSol: number;
}

interface BribeConfirmResult {
  success: boolean;
  childAgent?: {
    name: string;
    ticker: string;
    description: string;
    avatarUrl: string | null;
    agentId: string;
    mintAddress: string;
  };
  subclaw?: { id: string; ticker: string } | null;
}

export function useSaturnBribe() {
  const [initResult, setInitResult] = useState<BribeInitResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<BribeConfirmResult | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const initBribe = async (parentAgentId: string, briberWallet: string) => {
    setIsInitializing(true);
    setInitResult(null);
    setConfirmResult(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-bribe-init`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ parentAgentId, briberWallet }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to init bribe");
      setInitResult({
        bribeId: data.bribeId,
        walletAddress: data.walletAddress,
        amountSol: data.amountSol,
      });
      return data;
    } catch (err: any) {
      toast({ title: "Bribe Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setIsInitializing(false);
    }
  };

  const confirmBribe = async (bribeId: string, txSignature: string) => {
    setIsConfirming(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-bribe-confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ bribeId, txSignature }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to confirm bribe");
      setConfirmResult(data);
      toast({ title: "🪐 Bribe Successful!", description: `New agent ${data.childAgent?.name} launched!` });
      return data;
    } catch (err: any) {
      toast({ title: "Confirmation Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setIsConfirming(false);
    }
  };

  const reset = () => {
    setInitResult(null);
    setConfirmResult(null);
  };

  return { initBribe, confirmBribe, reset, initResult, confirmResult, isInitializing, isConfirming };
}
