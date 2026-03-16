import { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Copy,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useDevWalletRotation, type RotationStep, type ExchangeRate } from "@/hooks/useDevWalletRotation";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getCexIcon(id: string, name: string, website?: string): string {
  if (website) {
    try {
      const domain = new URL(website).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { /* ignore */ }
  }
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

function shortAddr(addr: string, chars = 6) {
  if (!addr) return "";
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`;
}

/* ─── Copyable Address Component ─── */
function CopyableAddress({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    toast.success(ok ? "Copied to clipboard" : "Copy failed");
  };

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-secondary/40 border border-border/30 group transition-all hover:border-primary/20">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xs font-mono text-foreground truncate">{shortAddr(value, 8)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isLink && (
          <a
            href={`https://solscan.io/tx/${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
            title="View on Solscan"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors active:scale-90"
          title="Copy to clipboard"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Step Item Component ─── */
function StepItem({ stepKey, label, icon: Icon, currentStep, failedStep }: {
  stepKey: RotationStep;
  label: string;
  icon: React.ElementType;
  currentStep: RotationStep;
  failedStep: RotationStep | null;
}) {
  const state = getStepState(currentStep, failedStep, stepKey);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300",
        state === "active" && "bg-primary/10 border border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.1)]",
        state === "done" && "bg-emerald-500/5 border border-emerald-500/10",
        state === "error" && "bg-destructive/10 border border-destructive/20",
        state === "pending" && "border border-transparent opacity-50"
      )}
    >
      <div className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
        state === "done" && "bg-emerald-500/15 text-emerald-400",
        state === "active" && "bg-primary/15 text-primary",
        state === "error" && "bg-destructive/15 text-destructive",
        state === "pending" && "bg-secondary/60 text-muted-foreground/50"
      )}>
        {state === "done" && <CheckCircle2 className="h-4 w-4 animate-scale-in" />}
        {state === "active" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "error" && <XCircle className="h-4 w-4" />}
        {state === "pending" && <Icon className="h-3.5 w-3.5" />}
      </div>
      <span className={cn(
        "text-sm font-medium flex-1",
        state === "done" && "text-emerald-400",
        state === "active" && "text-primary",
        state === "error" && "text-destructive",
        state === "pending" && "text-muted-foreground/50"
      )}>
        {label}
      </span>
      {state === "done" && (
        <ChevronRight className="h-3.5 w-3.5 text-emerald-500/40 shrink-0" />
      )}
    </div>
  );
}

/* ─── Log Entry Component ─── */
function LogEntry({ message, index }: { message: string; index: number }) {
  // Try to extract timestamp
  const tsMatch = message.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)/);
  const timestamp = tsMatch ? tsMatch[1] : null;
  const content = tsMatch ? tsMatch[2] : message;

  return (
    <div className={cn(
      "flex gap-2 text-[11px] py-1 border-b border-border/20 last:border-0 animate-fade-in",
    )}>
      {timestamp && (
        <span className="text-muted-foreground/60 font-mono shrink-0 tabular-nums">{timestamp}</span>
      )}
      <span className="text-muted-foreground font-mono break-all leading-relaxed">{content}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN MODAL
   ═══════════════════════════════════════════════ */
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

  // Progress bar percentage
  const progressPercent = useMemo(() => {
    if (isComplete) return 100;
    const currentIdx = STEP_ORDER.indexOf(state.step as RotationStep);
    if (currentIdx < 0) return 0;
    return Math.round(((currentIdx + 0.5) / STEP_ORDER.length) * 100);
  }, [state.step, isComplete]);

  // Merge & sort exchangers
  const exchangersWithRates = useMemo(() => {
    const merged = state.exchangers.map((ex) => {
      const rate = state.rates.find((r) => r.exchangerId === ex.id);
      return { ...ex, rate };
    });
    merged.sort((a, b) => {
      if (a.rate?.available && !b.rate?.available) return -1;
      if (!a.rate?.available && b.rate?.available) return 1;
      if (a.rate && b.rate) return b.rate.exchangeRate - a.rate.exchangeRate;
      return 0;
    });
    return merged;
  }, [state.exchangers, state.rates]);

  const balanceTooLow = state.sendAmount > 0 && state.sendAmount < state.minDeposit;

  return (
    <Dialog open={open} onOpenChange={running ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-xl shadow-[0_8px_64px_rgba(0,0,0,0.5)]">

        {/* ─── Header ─── */}
        <div className="px-5 pt-5 pb-3 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ArrowRightLeft className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">CEX Wallet Rotation</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Route funds via CEX to break on-chain links</p>
            </div>
          </div>

          {/* Progress bar - only show during processing */}
          {(isProcessing || isComplete) && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isComplete ? "Complete" : "Processing"}
                </span>
                <span className="text-[10px] font-mono text-primary tabular-nums">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}
        </div>

        {/* ─── Content ─── */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-3">

          {/* ═══ SELECTION PHASE ═══ */}
          {isSelecting && (
            <>
              {/* Wallet flow card */}
              {activeWallet?.address && (
                <div className="rounded-xl bg-secondary/30 border border-border/40 p-3.5 space-y-2.5">
                  {/* From */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
                      <p className="text-xs font-mono text-foreground mt-0.5">{shortAddr(activeWallet.address)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                      <p className="text-sm font-mono font-bold text-primary mt-0.5">{state.balance.toFixed(4)} SOL</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center py-0.5">
                    <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <ArrowDown className="h-3 w-3 text-primary" />
                    </div>
                  </div>

                  {/* To */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">To (fresh wallet)</p>
                      {state.newWalletAddress ? (
                        <p className="text-xs font-mono text-foreground mt-0.5">{shortAddr(state.newWalletAddress)}</p>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Creating...</p>
                          <button onClick={(e) => { e.stopPropagation(); loadData(); }} className="text-[10px] text-primary hover:underline ml-1">Retry</button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Send amount</p>
                      <p className="text-sm font-mono font-bold text-primary mt-0.5">{state.sendAmount.toFixed(4)} SOL</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                    <span>Min: {state.minDeposit} SOL</span>
                    <span>100% balance – 0.005 fee</span>
                  </div>
                </div>
              )}

              {/* Balance too low warning */}
              {balanceTooLow && (
                <div className="flex items-center gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">Balance too low. Minimum deposit is {state.minDeposit} SOL.</p>
                </div>
              )}

              {/* Loading */}
              {state.step === "loading_data" && (
                <div className="flex items-center justify-center py-8 gap-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading exchanges & rates...</span>
                </div>
              )}

              {/* Selection error */}
              {state.step === "selecting_cex" && state.error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-xs text-destructive">{state.error}</p>
                </div>
              )}

              {/* Exchange list */}
              {state.step === "selecting_cex" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Select Exchange {state.rates.length > 0 ? "· sorted by rate" : ""}
                  </p>
                  <ScrollArea className="h-[200px] sm:h-[240px]">
                    <div className="space-y-1.5 pr-2">
                      {exchangersWithRates.map((ex) => {
                        const hasRate = ex.rate && ex.rate.available;
                        const noRate = ex.rate && !ex.rate.available;
                        const iconUrl = getCexIcon(ex.id, ex.name, ex.website);
                        return (
                          <button
                            key={ex.id}
                            disabled={balanceTooLow || (noRate === true)}
                            onClick={() => handleSelectCex(ex.id)}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all border",
                              "border-border/30 hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_16px_hsl(var(--primary)/0.08)]",
                              "active:scale-[0.98]",
                              noRate && "opacity-35 cursor-not-allowed hover:bg-transparent hover:border-border/30",
                              balanceTooLow && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <div className="h-8 w-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/30">
                              <img
                                src={iconUrl}
                                alt={ex.name}
                                className="h-4.5 w-4.5 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                                    `<span class="text-xs font-bold text-foreground">${ex.name.charAt(0).toUpperCase()}</span>`;
                                }}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{ex.name}</span>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md font-normal">
                                  {ex.category}
                                </Badge>
                              </div>
                              {hasRate && (
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                                  <span>Rate: <span className="font-mono text-foreground">{ex.rate!.exchangeRate.toFixed(6)}</span></span>
                                  <span>Est: <span className="font-mono text-primary font-medium">{ex.rate!.estimatedReceive.toFixed(4)} SOL</span></span>
                                </div>
                              )}
                              {noRate && (
                                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Unavailable for this pair</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 bg-secondary/40 rounded-md px-1.5 py-0.5">
                              <Clock className="h-3 w-3" />
                              <span className="font-mono">~{ex.eta}m</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {/* ═══ PROCESSING / COMPLETE / ERROR PHASE ═══ */}
          {(isProcessing || isComplete || isError) && (
            <>
              {/* Selected CEX pill */}
              {state.selectedCex && (
                <div className="flex items-center justify-between rounded-xl bg-secondary/30 border border-border/40 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cex = state.exchangers.find((e) => e.id === state.selectedCex);
                      const icon = cex ? getCexIcon(cex.id, cex.name, cex.website) : null;
                      return (
                        <>
                          {icon && (
                            <div className="h-6 w-6 rounded-md bg-secondary/60 flex items-center justify-center overflow-hidden">
                              <img src={icon} alt="" className="h-3.5 w-3.5 object-contain" />
                            </div>
                          )}
                          <span className="text-xs text-muted-foreground">
                            via <span className="font-semibold text-foreground">{cex?.name || state.selectedCex}</span>
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <span className="text-sm font-mono font-bold text-primary">{state.sendAmount.toFixed(4)} SOL</span>
                </div>
              )}

              {/* Steps checklist */}
              <div className="space-y-1">
                {PROCESS_STEPS.map(({ key, label, icon }) => (
                  <StepItem
                    key={key}
                    stepKey={key}
                    label={label}
                    icon={icon}
                    currentStep={state.step}
                    failedStep={state.failedStep}
                  />
                ))}
              </div>

              {/* Details grid - addresses, tx, amount */}
              {(state.depositAddress || state.newWalletAddress || state.txSignature) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Details</p>
                  <div className="space-y-1.5">
                    {state.depositAddress && (
                      <CopyableAddress label="Deposit Address" value={state.depositAddress} />
                    )}
                    {state.depositAmount && (
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/40 border border-border/30">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                        <p className="text-sm font-mono font-bold text-primary">{state.depositAmount} SOL</p>
                      </div>
                    )}
                    {state.newWalletAddress && (
                      <CopyableAddress label="New Wallet" value={state.newWalletAddress} />
                    )}
                    {state.txSignature && (
                      <CopyableAddress label="Transaction" value={state.txSignature} isLink />
                    )}
                  </div>
                </div>
              )}

              {/* Logs section */}
              {state.logs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Activity Log</p>
                  <div className="relative rounded-xl bg-background/60 border border-border/30 overflow-hidden">
                    <ScrollArea className="h-28 sm:h-36">
                      <div className="p-3 space-y-0">
                        {state.logs.map((l, i) => (
                          <LogEntry key={i} message={l} index={i} />
                        ))}
                      </div>
                    </ScrollArea>
                    {/* Bottom fade overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Error display */}
              {isError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-0.5">Rotation failed</p>
                    <p className="text-[11px] text-destructive/80">{state.error}</p>
                  </div>
                </div>
              )}

              {/* Complete state */}
              {isComplete && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <p className="text-sm font-bold text-emerald-400">Wallet Rotation Complete</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Your new wallet is active and ready for a fresh launch. On-chain links have been broken.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Footer Actions ─── */}
        {(isError || isComplete) && (
          <div className="px-5 pb-5 pt-1">
            {isError && (
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={() => reset()}>
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            )}
            {isComplete && (
              <Button
                className="w-full gap-2 btn-gradient-green hover:shadow-[0_0_24px_hsl(72_100%_50%/0.3)]"
                onClick={() => onOpenChange(false)}
              >
                <ShieldCheck className="h-4 w-4" />
                Done — Start Fresh Launch
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
