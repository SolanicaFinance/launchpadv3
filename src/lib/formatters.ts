/**
 * Format a 24h percentage change into a compact, readable string.
 * Handles astronomically large values from DexScreener/Codex for micro-cap tokens.
 */
export function formatChange24h(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1e9).toFixed(1)}B%`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1e6).toFixed(1)}M%`;
  if (abs >= 10_000) return `${sign}${(abs / 1e3).toFixed(1)}K%`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}%`;
  return `${sign}${abs.toFixed(1)}%`;
}
