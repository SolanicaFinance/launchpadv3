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
  AlertTriangle,
} from "lucide-react";
import { useDevWalletRotation, type RotationStep, type ExchangeRate } from "@/hooks/useDevWalletRotation";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Get a reliable icon URL for any CEX using Google's favicon service.
 * Falls back to the exchanger's website domain.
 */
function getCexIcon(id: string, name: string, website?: string): string {
  // Extract domain from website URL if available
  if (website) {
    try {
      const domain = new URL(website).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { /* ignore */ }
  }
  // Fallback: guess domain from name/id
  const slug = (name || id).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=64`;
}

const PROCESS_STEPS: { key: RotationStep; label: string; icon: React.ElementType }[] = [
  { key: "checking_launches", label: "Checking existing launches", icon: Search },
  { key: "creating_wallet", label: "Generating fresh wallet", icon: Wallet },
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
  const { state, running, loadData, startRotation, reset } = useDevWalletRotation();
  const { activeWallet } = useMultiWallet() as any;

  useEffect(() => {
    if (open && state.step === "idle" && activeWallet?.address) {
      loadData();
    }
  }, [open, state.step, loadData, activeWallet?.address]);

  useEffect(() => {
    if (!open) {
      if (state.step === "complete" || state.step === "error" || state.step === "selecting_cex") {
        setTimeout(reset, 300);
      }
    }
  }, [open, state.step, reset]);

  const isSelecting = state.step === "selecting_cex" || state.step === "loading_data";
  const isProcessing = !isSelecting && state.step !== "idle" && state.step !== "complete" && state.step !== "error";
  const isComplete = state.step === "complete";
  const isError = state.step === "error" && !isSelecting;

  const handleSelectCex = (cexId: string) => {
    startRotation(cexId);
  };

  // Merge rates with exchangers for display
  const exchangersWithRates = state.exchangers.map((ex) => {
    const rate = state.rates.find((r) => r.exchangerId === ex.id);
    return { ...ex, rate };
  });

  // Sort: available rates first, then by rate descending
  exchangersWithRates.sort((a, b) => {
    if (a.rate?.available && !b.rate?.available) return -1;
    if (!a.rate?.available && b.rate?.available) return 1;
    if (a.rate && b.rate) return b.rate.exchangeRate - a.rate.exchangeRate;
    return 0;
  });

  const balanceTooLow = state.sendAmount > 0 && state.sendAmount < state.minDeposit;

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
          <div className="space-y-3 pt-1">
            {/* From / To wallet info */}
            {activeWallet?.address && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
                    <p className="text-xs font-mono text-foreground">{shortAddr(activeWallet.address)}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                    <p className="text-xs font-mono text-foreground">{state.balance.toFixed(4)} SOL</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">To (new wallet)</p>
                    {state.newWalletAddress ? (
                      <p className="text-xs font-mono text-foreground">{shortAddr(state.newWalletAddress)}</p>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <p className="text-xs font-mono text-muted-foreground">Creating wallet...</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Send amount</p>
                    <p className="text-xs font-mono text-foreground">{state.sendAmount.toFixed(4)} SOL</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
                  <span>Min deposit: {state.minDeposit} SOL</span>
                  <span>100% balance – 0.005 fee</span>
                </div>
              </div>
            )}

            {balanceTooLow && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Balance too low. Minimum deposit is {state.minDeposit} SOL.
              </div>
            )}

            {/* Loading state */}
            {state.step === "loading_data" && (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading exchanges & rates...
              </div>
            )}

            {/* Error in loading */}
            {state.step === "selecting_cex" && state.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5">
                <p className="text-xs text-destructive">{state.error}</p>
              </div>
            )}

            {/* Exchange list with rates */}
            {state.step === "selecting_cex" && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  Select exchange {state.rates.length > 0 ? "(sorted by rate)" : ""}:
                </p>
                <ScrollArea className="h-[220px]">
                  <div className="space-y-1 pr-3">
                    {exchangersWithRates.map((ex) => {
                      const hasRate = ex.rate && ex.rate.available;
                      const noRate = ex.rate && !ex.rate.available;
                      const iconUrl = getCexIcon(ex.id, ex.name);
                      return (
                        <button
                          key={ex.id}
                          disabled={balanceTooLow || (noRate === true)}
                          onClick={() => handleSelectCex(ex.id)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all border border-transparent",
                            "hover:bg-secondary/60 hover:border-primary/20",
                            noRate && "opacity-40 cursor-not-allowed",
                            balanceTooLow && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {/* CEX icon */}
                          <div className="h-7 w-7 rounded-full bg-secondary/80 flex items-center justify-center shrink-0 overflow-hidden">
                            {iconUrl ? (
                              <img
                                src={iconUrl}
                                alt={ex.name}
                                className="h-4 w-4 object-contain"
                                onError={(e) => {
                                  // Fallback to first letter on icon load error
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                                    `<span class="text-xs font-bold text-foreground">${ex.name.charAt(0).toUpperCase()}</span>`;
                                }}
                              />
                            ) : (
                              <span className="text-xs font-bold text-foreground">{ex.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{ex.name}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {ex.category}
                              </Badge>
                            </div>
                            {hasRate && (
                              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                <span>Rate: <span className="font-mono text-foreground">{ex.rate!.exchangeRate.toFixed(6)}</span></span>
                                <span>Est: <span className="font-mono text-foreground">{ex.rate!.estimatedReceive.toFixed(4)} SOL</span></span>
                              </div>
                            )}
                            {noRate && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Unavailable for this pair</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            ~{ex.eta}m
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* ─── PROCESSING PHASE ─── */}
        {(isProcessing || isComplete || isError) && (
          <div className="space-y-3 pt-1">
            {/* Selected CEX + route info */}
            {state.selectedCex && (
              <div className="flex items-center justify-between text-xs text-muted-foreground rounded-lg bg-secondary/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  {(() => {
                    const cex = state.exchangers.find((e) => e.id === state.selectedCex);
                    const icon = cex ? getCexIcon(cex.id, cex.name) : null;
                    return (
                      <>
                        {icon && <img src={icon} alt="" className="h-4 w-4 object-contain" />}
                        <span>Exchange: <span className="font-semibold text-foreground">
                          {cex?.name || state.selectedCex}
                        </span></span>
                      </>
                    );
                  })()}
                </div>
                <span className="font-mono">{state.sendAmount.toFixed(4)} SOL</span>
              </div>
            )}

            {/* Step indicators */}
            <div className="space-y-1.5">
              {PROCESS_STEPS.map(({ key, label, icon: Icon }) => {
                const actualState = getStepState(state.step, state.failedStep, key);
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-all",
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
                  </div>
                );
              })}
            </div>

            {/* Deposit info */}
            {state.depositAddress && (
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Deposit address</p>
                <p className="text-xs font-mono break-all text-foreground">{state.depositAddress}</p>
                {state.depositAmount && (
                  <p className="text-xs text-muted-foreground">Amount: <span className="font-mono text-foreground">{state.depositAmount} SOL</span></p>
                )}
              </div>
            )}

            {/* New wallet */}
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
            <ScrollArea className="h-28 rounded-lg bg-background border border-border p-3">
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
