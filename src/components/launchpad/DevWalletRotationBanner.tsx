import { useState, useEffect } from "react";
import { ArrowRightLeft, ShieldAlert, Info, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DevWalletRotationModal } from "./DevWalletRotationModal";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function DevWalletRotationBanner() {
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [launchCount, setLaunchCount] = useState<number | null>(null);
  const { activeAddress } = useMultiWallet();
  const { solanaAddress } = useAuth();

  const address = activeAddress || solanaAddress || null;

  useEffect(() => {
    if (!address) return;
    supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true })
      .eq("creator_wallet", address)
      .then(({ count }) => setLaunchCount(count ?? 0));
  }, [address]);

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          {/* Blinking icon */}
          <div className="relative mt-0.5 shrink-0">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
          </div>

          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Rotate Wallet via CEX
              </p>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="More info"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Move funds to a fresh embedded wallet routed through a randomized CEX to break
              on-chain links. Recommended before every new launch.
            </p>
          </div>
        </div>

        {/* Info box */}
        {expanded && (
          <div className="rounded-lg bg-secondary/60 border border-border/50 p-3 space-y-2 animate-fade-in text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Why rotate?</strong> Every token you launch from the same wallet creates an on-chain paper trail. Snipers and trackers can link your launches together and front-run your new tokens.
            </p>
            <p>
              <strong className="text-foreground">How it works:</strong> Your SOL is sent to a deposit address on a randomly selected CEX (Binance, KuCoin, or Gate.io), then withdrawn to a brand-new embedded wallet. This breaks the direct on-chain link between your old and new wallet.
            </p>
            <p>
              <strong className="text-foreground">When to use:</strong> Ideally before every new token launch — especially if your previous launches are public. The old wallet is hidden automatically after rotation.
            </p>
          </div>
        )}

        {/* Launch count badge */}
        <div className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
          <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Launches from this wallet:
          </span>
          <span className="text-xs font-bold text-foreground ml-auto tabular-nums">
            {launchCount === null ? "…" : launchCount}
          </span>
          {launchCount !== null && launchCount > 0 && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full animate-pulse">
              Rotation recommended
            </span>
          )}
        </div>

        <Button
          size="sm"
          className="w-full gap-2 btn-gradient-green hover:shadow-[0_0_24px_hsl(72_100%_50%/0.3)]"
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
