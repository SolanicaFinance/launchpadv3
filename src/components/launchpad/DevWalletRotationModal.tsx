import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Wallet,
  Shuffle,
  ArrowRightLeft,
  Search,
  Send,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useDevWalletRotation, type RotationStep } from "@/hooks/useDevWalletRotation";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS: { key: RotationStep; label: string; icon: React.ElementType }[] = [
  { key: "checking_launches", label: "Checking existing launches", icon: Search },
  { key: "creating_wallet", label: "Generating fresh wallet", icon: Wallet },
  { key: "randomizing_cex", label: "Selecting exchange", icon: Shuffle },
  { key: "fetching_balance", label: "Fetching balance", icon: Wallet },
  { key: "getting_quote", label: "Getting SplitNOW quote", icon: ArrowRightLeft },
  { key: "creating_order", label: "Creating exchange order", icon: ArrowRightLeft },
  { key: "sending_sol", label: "Sending SOL to deposit", icon: Send },
  { key: "polling_status", label: "Processing through CEX", icon: RefreshCw },
  { key: "switching_wallet", label: "Switching to new wallet", icon: Sparkles },
];

const STEP_ORDER = STEPS.map((s) => s.key);

function getStepState(
  currentStep: RotationStep,
  failedStep: RotationStep | null,
  targetStep: RotationStep
): "done" | "active" | "pending" | "error" {
  if (currentStep === "complete") return "done";
  if (currentStep === "error") {
    if (failedStep === targetStep) return "error";
    if (failedStep) {
      const failedIndex = STEP_ORDER.indexOf(failedStep);
      const targetIndex = STEP_ORDER.indexOf(targetStep);
      if (targetIndex < failedIndex) return "done";
    }
    return "pending";
  }

  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const targetIndex = STEP_ORDER.indexOf(targetStep);
  if (targetIndex < currentIndex) return "done";
  if (targetIndex === currentIndex) return "active";
  return "pending";
}

export function DevWalletRotationModal({ open, onOpenChange }: Props) {
  const { state, running, startRotation, reset } = useDevWalletRotation();

  useEffect(() => {
    if (!open) {
      // Allow reset after close if complete or error
      if (state.step === "complete" || state.step === "error") {
        setTimeout(reset, 300);
      }
    }
  }, [open, state.step, reset]);

  const isIdle = state.step === "idle";
  const isComplete = state.step === "complete";
  const isError = state.step === "error";

  return (
    <Dialog open={open} onOpenChange={running ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            CEX Wallet Rotation
          </DialogTitle>
          <DialogDescription>
            Route funds through a randomized CEX to a fresh wallet, breaking on-chain links.
          </DialogDescription>
        </DialogHeader>

        {isIdle && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-secondary/50 p-4 text-sm text-muted-foreground space-y-2">
              <p>This will:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Create a new embedded wallet</li>
                <li>Pick a random CEX (Binance, KuCoin, or Gate.io)</li>
                <li>Route your SOL through that CEX to the new wallet</li>
                <li>Hide the old wallet and switch to the new one</li>
              </ol>
            </div>
            <Button className="w-full gap-2" onClick={startRotation}>
              <ArrowRightLeft className="h-4 w-4" />
              Start Rotation
            </Button>
          </div>
        )}

        {!isIdle && (
          <div className="space-y-4 pt-2">
            {/* Step indicators */}
            <div className="space-y-2">
              {STEPS.map(({ key, label, icon: Icon }) => {
                const actualState = getStepState(state.step, state.failedStep, key);

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                      actualState === "active" && "bg-primary/10 text-primary",
                      actualState === "done" && "text-green-500",
                      actualState === "error" && "bg-destructive/10 text-destructive border border-destructive/20",
                      actualState === "pending" && "text-muted-foreground/50"
                    )}
                  >
                    {actualState === "done" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {actualState === "active" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                    {actualState === "error" && <XCircle className="h-4 w-4 shrink-0" />}
                    {actualState === "pending" && <Icon className="h-4 w-4 shrink-0 opacity-40" />}
                    <span className="flex-1">{label}</span>
                    {key === "randomizing_cex" && state.selectedCex && actualState !== "pending" && (
                      <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
                        {state.selectedCex}
                      </span>
                    )}
                    {key === "fetching_balance" && state.balance > 0 && actualState !== "pending" && (
                      <span className="text-xs font-mono">
                        {state.balance.toFixed(4)} SOL
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New wallet address */}
            {state.newWalletAddress && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">New wallet</p>
                <p className="text-xs font-mono break-all text-foreground">
                  {state.newWalletAddress}
                </p>
              </div>
            )}

            {/* Tx signature */}
            {state.txSignature && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Transaction</p>
                <a
                  href={`https://solscan.io/tx/${state.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-primary hover:underline break-all"
                >
                  {state.txSignature.slice(0, 20)}...{state.txSignature.slice(-8)}
                </a>
              </div>
            )}

            {/* Live logs */}
            <ScrollArea className="h-32 rounded-lg bg-background border border-border p-3">
              <div className="space-y-1">
                {state.logs.map((l, i) => (
                  <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    {l}
                  </p>
                ))}
              </div>
            </ScrollArea>

            {/* Error */}
            {isError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive">{state.error}</p>
              </div>
            )}

            {/* Complete */}
            {isComplete && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                <p className="text-sm font-semibold text-green-500">
                  ✅ Wallet rotation complete!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your new wallet is now active and ready for a fresh launch.
                </p>
              </div>
            )}

            {/* Actions */}
            {isError && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1 gap-2"
                  onClick={() => { reset(); startRotation(); }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            )}
            {isComplete && (
              <Button
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
