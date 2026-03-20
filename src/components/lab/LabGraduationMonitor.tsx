import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProgress, type LabPool } from "@/lib/saturn-curve";
import { GraduationCap, CheckCircle2, Circle, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Props {
  pools: LabPool[];
  onGraduated: () => void;
}

const MIGRATION_STEPS = [
  { key: "metadata", label: "Create token metadata" },
  { key: "locker", label: "Create Meteora locker" },
  { key: "migrate", label: "Migrate to DAMM V2" },
  { key: "lock_lp", label: "Lock 100% LP tokens" },
];

export function LabGraduationMonitor({ pools, onGraduated }: Props) {
  const [graduatingId, setGraduatingId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);

  const activePools = pools.filter((p) => p.status !== "graduated");
  const graduatedPools = pools.filter((p) => p.status === "graduated");

  async function handleGraduate(pool: LabPool) {
    setGraduatingId(pool.id);
    setCurrentStep(0);

    try {
      // Simulate migration steps with the edge function
      const { data, error } = await supabase.functions.invoke("saturn-curve-graduate", {
        body: { pool_id: pool.id },
      });
      if (error) throw error;

      // Simulate step progression
      for (let i = 1; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 800));
        setCurrentStep(i);
      }

      toast.success(`${pool.name} graduated!`);
      onGraduated();
    } catch (e: any) {
      toast.error(e.message || "Graduation failed");
    } finally {
      setGraduatingId(null);
      setCurrentStep(-1);
    }
  }

  return (
    <div className="space-y-6">
      {/* Active Pools */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Pre-Graduation Pools</h3>
        {activePools.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active pools.</p>
        ) : (
          <div className="space-y-3">
            {activePools.map((pool) => {
              const progress = getProgress(pool);
              const ready = progress >= 100;
              const isGraduating = graduatingId === pool.id;

              return (
                <div key={pool.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{pool.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">${pool.ticker}</span>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold",
                      ready ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                    )}>
                      {ready ? "Ready" : `${progress.toFixed(1)}%`}
                    </span>
                  </div>

                  <Progress value={progress} className="h-2" />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pool.real_sol_reserves.toFixed(4)} / {pool.graduation_threshold_sol} SOL</span>
                  </div>

                  {/* Migration Steps (shown while graduating) */}
                  {isGraduating && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      {MIGRATION_STEPS.map((step, i) => (
                        <div key={step.key} className="flex items-center gap-2 text-xs">
                          {i < currentStep ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                          ) : i === currentStep ? (
                            <div className="h-4 w-4 border-2 border-primary rounded-full animate-spin border-t-transparent" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={cn(
                            i <= currentStep ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => handleGraduate(pool)}
                    disabled={!ready || isGraduating}
                    size="sm"
                    className="w-full"
                  >
                    <GraduationCap className="h-4 w-4 mr-1" />
                    {isGraduating ? "Graduating..." : ready ? "Graduate Now" : "Threshold Not Met"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Graduated Pools */}
      {graduatedPools.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Graduated Pools</h3>
          <div className="space-y-3">
            {graduatedPools.map((pool) => (
              <div key={pool.id} className="p-4 rounded-lg border border-green-500/20 bg-green-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-semibold text-foreground">{pool.name}</span>
                    <span className="text-xs text-muted-foreground">${pool.ticker}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {pool.graduated_at ? new Date(pool.graduated_at).toLocaleDateString() : ""}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">DAMM V2 Pool</span>
                    <div className="font-mono text-foreground">
                      {pool.damm_pool_address ? `${pool.damm_pool_address.slice(0, 12)}...` : "Pending"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LP Lock</span>
                    <div className={cn("font-medium flex items-center gap-1", pool.lp_locked ? "text-green-400" : "text-yellow-400")}>
                      <Lock className="h-3 w-3" />
                      {pool.lp_locked ? "100% Locked Forever" : "Pending"}
                    </div>
                  </div>
                </div>

                {pool.lp_lock_tx && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Lock TX: </span>
                    <span className="font-mono text-foreground">{pool.lp_lock_tx.slice(0, 16)}...</span>
                  </div>
                )}

                {/* All 4 steps completed */}
                <div className="flex items-center gap-1 text-[10px] text-green-400">
                  {MIGRATION_STEPS.map((s, i) => (
                    <span key={s.key} className="flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      {s.label}
                      {i < MIGRATION_STEPS.length - 1 && <ArrowRight className="h-3 w-3 mx-0.5 text-muted-foreground" />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
