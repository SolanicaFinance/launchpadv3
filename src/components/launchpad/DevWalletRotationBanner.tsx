import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { supabase } from "@/integrations/supabase/client";
import { DevWalletRotationModal } from "./DevWalletRotationModal";

export function DevWalletRotationBanner() {
  const { isAuthenticated } = useAuth();
  const { walletAddress: embeddedWalletAddress, isWalletReady } = useSolanaWalletWithPrivy();
  const [launchCount, setLaunchCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const lastCheckedAddr = useRef("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setLaunchCount(0);
      setChecked(true);
      lastCheckedAddr.current = "";
      requestIdRef.current += 1;
      return;
    }

    if (!isWalletReady || !embeddedWalletAddress) {
      setChecked(false);
      return;
    }

    if (lastCheckedAddr.current === embeddedWalletAddress) return;

    lastCheckedAddr.current = embeddedWalletAddress;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setChecked(false);

    supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true })
      .eq("creator_wallet", embeddedWalletAddress)
      .then(({ count, error }) => {
        if (requestId !== requestIdRef.current) return;

        console.log("[RotationBanner] Launch check:", {
          embeddedWalletAddress,
          count,
          error,
        });
        setLaunchCount(count ?? 0);
        setChecked(true);
      });
  }, [embeddedWalletAddress, isAuthenticated, isWalletReady]);

  const isCheckingWallet = isAuthenticated && (!isWalletReady || !embeddedWalletAddress || !checked);

  if (isCheckingWallet) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-2 mb-4">
        <p className="text-sm font-medium text-foreground">Reading your wallet…</p>
        <p className="text-xs text-muted-foreground">
          Checking your embedded launch wallet for previous launches.
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

