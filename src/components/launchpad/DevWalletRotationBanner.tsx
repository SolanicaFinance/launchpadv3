import { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { supabase } from "@/integrations/supabase/client";
import { DevWalletRotationModal } from "./DevWalletRotationModal";

export function DevWalletRotationBanner() {
  const { managedWallets, ready } = useMultiWallet();
  const [launchCount, setLaunchCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Stable key derived from sorted addresses — only changes when actual addresses change
  const addressKey = useMemo(
    () => managedWallets.map((w) => w.address).sort().join(","),
    [managedWallets]
  );

  const lastCheckedKey = useRef("");

  useEffect(() => {
    if (!ready || !addressKey) return;
    // Skip if we already checked this exact set of addresses
    if (lastCheckedKey.current === addressKey) return;
    lastCheckedKey.current = addressKey;

    const addresses = addressKey.split(",").filter(Boolean);
    if (addresses.length === 0) {
      setChecked(true);
      return;
    }

    supabase
      .from("fun_tokens")
      .select("id")
      .in("creator_wallet", addresses)
      .then(({ data, error }) => {
        console.log("[RotationBanner] Launch check:", { addresses, count: data?.length, error });
        setLaunchCount(data?.length ?? 0);
        setChecked(true);
      });
  }, [addressKey, ready]);

  if (!checked || launchCount === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-semibold text-yellow-500">
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
          className="w-full gap-2 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
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
