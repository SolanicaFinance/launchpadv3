import { memo } from "react";
import { useTickingAge } from "@/hooks/useTickingAge";
import { cn } from "@/lib/utils";

interface LiveAgeProps {
  createdAt: string | null | undefined;
  isUnixSeconds?: boolean;
  className?: string;
}

function getAgeMs(createdAt: string | null | undefined, isUnixSeconds?: boolean): number {
  if (!createdAt) return 0;
  try {
    const ts = isUnixSeconds ? parseInt(createdAt) * 1000 : new Date(createdAt).getTime();
    return Math.max(0, Date.now() - ts);
  } catch {
    return 0;
  }
}

function getAgeColor(ms: number): string {
  if (ms <= 0) return "text-foreground/50";
  if (ms < 3 * 60 * 1000) return "text-emerald-400"; // < 3 min — green
  if (ms < 10 * 60 * 1000) return "text-yellow-400"; // < 10 min — yellow
  if (ms < 60 * 60 * 1000) return "text-foreground/50"; // < 1h — default
  return "text-orange-500/70"; // > 1h — darker orange
}

export const LiveAge = memo(function LiveAge({ createdAt, isUnixSeconds, className }: LiveAgeProps) {
  const age = useTickingAge(createdAt, isUnixSeconds);
  const ms = getAgeMs(createdAt, isUnixSeconds);
  const colorClass = getAgeColor(ms);
  const isFresh = ms > 0 && ms < 10 * 60 * 1000; // bold if under 10 min

  return (
    <span className={cn(
      "text-[10px] font-mono",
      colorClass,
      isFresh && "font-bold",
      className
    )}>
      {age}
    </span>
  );
});
