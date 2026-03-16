import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DevWalletRotationModal } from "./DevWalletRotationModal";

export function DevWalletRotationBanner() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Rotate Wallet via CEX
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Move funds to a fresh embedded wallet routed through a randomized CEX to break
              on-chain links. Recommended before every new launch.
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
          Rotate Wallet
        </Button>
      </div>

      <DevWalletRotationModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

