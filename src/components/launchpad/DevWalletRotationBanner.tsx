import { useState, useEffect } from "react";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { supabase } from "@/integrations/supabase/client";
import { DevWalletRotationModal } from "./DevWalletRotationModal";

export function DevWalletRotationBanner() {
  const { activeWallet, ready } = useMultiWallet();
  const [launchCount, setLaunchCount] = useState(0);
  const [checked, setChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!activeWallet?.address || !ready) return;
    setChecked(false);

    supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true })
      .eq("creator_wallet", activeWallet.address)
      .then(({ count }) => {
        setLaunchCount(count ?? 0);
        setChecked(true);
      });
  }, [activeWallet?.address, ready]);

  if (!checked || launchCount === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
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
