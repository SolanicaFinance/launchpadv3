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
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Wallet,
  ArrowRightLeft,
  Search,
  Send,
  RefreshCw,
  Sparkles,
  Clock,
  ArrowDown,
} from "lucide-react";
import { useDevWalletRotation, type RotationStep, type Exchanger } from "@/hooks/useDevWalletRotation";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROCESS_STEPS: { key: RotationStep; label: string; icon: React.ElementType }[] = [
  { key: "checking_launches", label: "Checking existing launches", icon: Search },
  { key: "creating_wallet", label: "Generating fresh wallet", icon: Wallet },
  { key: "fetching_balance", label: "Fetching balance", icon: Wallet },
  { key: "getting_quote", label: "Getting SplitNOW quote", icon: ArrowRightLeft },
  { key: "creating_order", label: "Creating exchange order", icon: ArrowRightLeft },
  { key: "sending_sol", label: "Sending SOL to deposit", icon: Send },
  { key: "polling_status", label: "Processing through CEX", icon: RefreshCw },
  { key: "switching_wallet", label: "Switching to new wallet", icon: Sparkles },
];

const STEP_ORDER = PROCESS_STEPS.map((s) => s.key);

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

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function DevWalletRotationModal({ open, onOpenChange }: Props) {
  const { state, running, loadExchangers, previewQuote, startRotation, reset } = useDevWalletRotation();
  const { activeWallet } = useMultiWallet() as any;

  useEffect(() => {
    if (open && state.step === "idle") {
      loadExchangers();
    }
  }, [open, state.step, loadExchangers]);

  useEffect(() => {
    if (!open) {
      if (state.step === "complete" || state.step === "error" || state.step === "selecting_cex") {
        setTimeout(reset, 300);
      }
    }
  }, [open, state.step, reset]);

  const isSelecting = state.step === "selecting_cex" || state.step === "loading_exchangers" || state.step === "previewing_quote";
  const isProcessing = !isSelecting && state.step !== "idle" && state.step !== "complete" && state.step !== "error";
  const isComplete = state.step === "complete";
  const isError = state.step === "error" && !isSelecting;

  const sendAmount = state.balance > 0.005 ? state.balance - 0.005 : 0;

  return (
    <Dialog open={open} onOpenChange={running ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            CEX Wallet Rotation
          </DialogTitle>
          <DialogDescription>
            Route funds through a CEX to a fresh wallet, breaking on-chain links.
          </DialogDescription>
        </DialogHeader>

        {/* ─── SELECTION PHASE ─── */}
        {isSelecting && (
          <div className="space-y-4 pt-2">
            {/* From / To wallet info */}
            {activeWallet && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From (current wallet)</p>
                    <p className="text-xs font-mono text-foreground">{shortAddr(activeWallet.address)}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                    <p className="text-xs font-mono text-foreground">{state.balance.toFixed(4)} SOL</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">To (new wallet — auto-generated)</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {state.newWalletAddress ? shortAddr(state.newWalletAddress) : "Will be created on start"}
                  </p>
                </div>

                {sendAmount > 0 && (
                  <div className="pt-1 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Amount to rotate</span>
                      <span className="font-mono font-medium text-foreground">{sendAmount.toFixed(4)} SOL</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      100% balance minus ~0.005 SOL tx fee reserve
                    </p>
                  </div>
                )}

                {state.minDeposit > 0 && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Min deposit</span>
                    <span className="font-mono">{state.minDeposit} SOL</span>
                  </div>
                )}
              </div>
            )}

            {/* Quote preview */}
            {state.quotePreview && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Quote Preview</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Send</p>
                    <p className="font-mono text-foreground">{state.quotePreview.fromAmount.toFixed(4)} SOL</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. Receive</p>
                    <p className="font-mono text-foreground">{state.quotePreview.estimatedReceive.toFixed(4)} SOL</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rate</p>
                    <p className="font-mono text-foreground">{state.quotePreview.rate.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. Fee</p>
                    <p className="font-mono text-foreground">{state.quotePreview.fee.toFixed(4)} SOL</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Floating rate — final amount may vary slightly</p>
              </div>
            )}

            {/* Error in selection phase */}
            {state.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive">{state.error}</p>
              </div>
            )}

            {/* Exchange selector */}
            {state.step === "loading_exchangers" && (
              <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading available exchanges...
              </div>
            )}

            {(state.step === "selecting_cex" || state.step === "previewing_quote") && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Select exchange to route through:</p>
                <ScrollArea className="h-[240px]">
                  <div className="space-y-1.5 pr-3">
                    {state.exchangers.map((ex) => {
                      const isSelected = state.selectedCex === ex.id;
                      const isQuoting = state.step === "previewing_quote" && isSelected;
                      return (
                        <button
                          key={ex.id}
                          disabled={state.step === "previewing_quote" && !isSelected}
                          onClick={() => previewQuote(ex.id)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all border",
                            isSelected
                              ? "border-primary/40 bg-primary/10"
                              : "border-transparent hover:bg-secondary/60",
                            state.step === "previewing_quote" && !isSelected && "opacity-50"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{ex.name}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {ex.category}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            ~{ex.eta} min
                          </div>
                          {isQuoting && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                          {isSelected && !isQuoting && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Confirm button */}
            {state.selectedCex && state.quotePreview && state.step === "selecting_cex" && (
              <Button
                className="w-full gap-2"
                onClick={() => startRotation(state.selectedCex!)}
                disabled={sendAmount < state.minDeposit}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Start Rotation via {state.exchangers.find((e) => e.id === state.selectedCex)?.name || state.selectedCex}
              </Button>
            )}

            {sendAmount > 0 && sendAmount < state.minDeposit && (
              <p className="text-xs text-destructive text-center">
                Balance too low. Minimum deposit is {state.minDeposit} SOL.
              </p>
            )}
          </div>
        )}

        {/* ─── PROCESSING PHASE ─── */}
        {(isProcessing || isComplete || isError) && (
          <div className="space-y-4 pt-2">
            {/* Selected CEX badge */}
            {state.selectedCex && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Exchange:</span>
                <span className="font-semibold text-foreground">
                  {state.exchangers.find((e) => e.id === state.selectedCex)?.name || state.selectedCex}
                </span>
              </div>
            )}

            {/* Step indicators */}
            <div className="space-y-2">
              {PROCESS_STEPS.map(({ key, label, icon: Icon }) => {
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
                    {key === "fetching_balance" && state.balance > 0 && actualState !== "pending" && (
                      <span className="text-xs font-mono">{state.balance.toFixed(4)} SOL</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New wallet address */}
            {state.newWalletAddress && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">New wallet</p>
                <p className="text-xs font-mono break-all text-foreground">{state.newWalletAddress}</p>
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
                  <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{l}</p>
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
                <p className="text-sm font-semibold text-green-500">✅ Wallet rotation complete!</p>
                <p className="text-xs text-muted-foreground mt-1">Your new wallet is now active and ready for a fresh launch.</p>
              </div>
            )}

            {/* Actions */}
            {isError && (
              <div className="flex gap-2">
                <Button variant="default" className="flex-1 gap-2" onClick={() => reset()}>
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            )}
            {isComplete && (
              <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
