import { cn } from "@/lib/utils";
import pumpfunPill from "@/assets/pumpfun-pill.webp";
import tunaLogo from "@/assets/tuna-logo.png";

interface LaunchpadBadgeProps {
  launchpadName?: string | null;
  launchpadType?: string | null;
  iconUrl?: string | null;
  className?: string;
}

const LAUNCHPAD_CONFIG: Record<string, { label: string; colors: string; officialIcon?: string }> = {
  "Pump.fun": { label: "pump", colors: "bg-primary/20 text-primary" },
  "Bonk": { label: "bonk", colors: "bg-orange-500/20 text-orange-400", officialIcon: "https://www.bonk.fun/favicon.ico" },
  "Moonshot": { label: "moon", colors: "bg-purple-500/20 text-purple-400", officialIcon: "https://moonshot.money/favicon.ico" },
  "Believe": { label: "believe", colors: "bg-cyan-500/20 text-cyan-400", officialIcon: "https://believe.app/images/icons/icon.png" },
  "boop": { label: "boop", colors: "bg-pink-500/20 text-pink-400", officialIcon: "https://boop.fun/images/brand.png" },
  "Jupiter Studio": { label: "jup", colors: "bg-emerald-500/20 text-emerald-400", officialIcon: "https://jup.ag/favicon.ico" },
};

const SPECIAL_CASES: Record<string, { label: string; colors: string; icon: string }> = {
  "bags.fm": { label: "bags", colors: "bg-blue-500/20 text-blue-400", icon: "https://bags.fm/favicon.ico" },
  "Meteora": { label: "meteora", colors: "bg-blue-500/20 text-blue-400", icon: tunaLogo },
};

function resolveFromType(type?: string | null): string | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === "pump" || t === "pumpfun" || t === "pump.fun") return "Pump.fun";
  if (t === "dbc" || t === "meteora") return "Meteora";
  if (t === "bags") return "bags.fm";
  if (t === "bonk") return "Bonk";
  if (t === "moonshot") return "Moonshot";
  if (t === "believe") return "Believe";
  if (t === "boop") return "boop";
  return null;
}

export function LaunchpadBadge({ launchpadName, launchpadType, iconUrl, className }: LaunchpadBadgeProps) {
  const resolved = launchpadName || resolveFromType(launchpadType);
  if (!resolved) return null;

  // Special cases (bags.fm, Meteora)
  const special = SPECIAL_CASES[resolved];
  if (special) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", special.colors, className)}>
        <img src={iconUrl || special.icon} alt="" className="h-2.5 w-2.5 rounded-full object-cover" />
        {special.label}
      </span>
    );
  }

  // Pump.fun uses local pill image
  if (resolved === "Pump.fun") {
    const config = LAUNCHPAD_CONFIG[resolved];
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", config.colors, className)}>
        <img src={iconUrl || pumpfunPill} alt="" className="h-2.5 w-2.5 object-contain" />
        {config.label}
      </span>
    );
  }

  const config = LAUNCHPAD_CONFIG[resolved];
  if (!config) {
    // Generic fallback
    return (
      <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium bg-muted text-muted-foreground", className)}>
        {iconUrl ? <img src={iconUrl} alt="" className="h-2.5 w-2.5 rounded-full object-cover" /> : null}
        {resolved.slice(0, 6).toLowerCase()}
      </span>
    );
  }

  // All others: use iconUrl → officialIcon → text-only
  const imgSrc = iconUrl || config.officialIcon;
  return (
    <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-medium", config.colors, className)}>
      {imgSrc && <img src={imgSrc} alt="" className="h-2.5 w-2.5 rounded-full object-cover" />}
      {config.label}
    </span>
  );
}
