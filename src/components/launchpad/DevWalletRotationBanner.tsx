import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { supabase } from "@/integrations/supabase/client";
import { DevWalletRotationModal } from "./DevWalletRotationModal";

export function DevWalletRotationBanner() {
  const { solanaAddress, isAuthenticated } = useAuth();
  const { walletAddress: embeddedWalletAddress, isWalletReady } = useSolanaWalletWithPrivy();
  const [launchCount, setLaunchCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const resolvedWalletAddress = embeddedWalletAddress || solanaAddress || null;
  const lastCheckedAddr = useRef("");

  useEffect(() => {
    if (!isAuthenticated) {
      setLaunchCount(0);
      setChecked(true);
      lastCheckedAddr.current = "";
      return;
    }

    if (!resolvedWalletAddress) {
      setChecked(false);
      return;
    }

    if (lastCheckedAddr.current === resolvedWalletAddress) return;
    lastCheckedAddr.current = resolvedWalletAddress;
    setChecked(false);

    supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true })
      .eq("creator_wallet", resolvedWalletAddress)
      .then(({ count, error }) => {
        console.log("[RotationBanner] Launch check:", {
          resolvedWalletAddress,
          embeddedWalletAddress,
          solanaAddress,
          count,
          error,
        });
        setLaunchCount(count ?? 0);
        setChecked(true);
      });
  }, [embeddedWalletAddress, isAuthenticated, resolvedWalletAddress, solanaAddress]);

  const isCheckingWallet = isAuthenticated && (!resolvedWalletAddress || !checked || !isWalletReady);

  if (isCheckingWallet) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-2 mb-4">
        <p className="text-sm font-medium text-foreground">Reading your wallet…</p>
        <p className="text-xs text-muted-foreground">
          Checking the active launch wallet for previous launches.
        </p>
      </div>
    );
  }

  if (launchCount === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Wallet Already Used for {launchCount} Launch{launchCount > 1 ? "es" : ""}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We've noticed this wallet has been used to launch tokens before. Launching a second
              token from the same wallet typically won't generate organic volume — it's flagged by
              trackers. Rotate to a fresh wallet via a CEX to start clean.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setModalOpen(true)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Rotate Wallet via CEX
        </Button>
      </div>

      <DevWalletRotationModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
