

## Plan: Cap Unrealistic change24h Percentages Across the Site

### Problem
When BNB Chain is selected, `change24h` values from Codex/DexScreener return astronomically large numbers (e.g., `+2764299117320.0%`, `+13486652452.2%`). These are mathematically "correct" for micro-cap tokens that went from near-zero to some value, but they are meaningless to users and clutter the UI. This affects the homepage trending ticker, Pulse terminal, King of the Hill, token detail pages, and the new pairs panel.

### Solution
Create a single utility function `formatChange24h(value: number): string` that caps the displayed percentage and formats it readably. All components displaying `change24h` will use this function.

**Capping logic:**
- If `|change24h| > 999_999` (1M%), display as `>999999%` or a compact form like `>1M%`
- If `|change24h| > 9999`, display compact like `+12.5K%` or `+1.2B%`
- Otherwise, display normally with 1 decimal: `+58.5%`

### Files to Change

#### 1. `src/lib/formatters.ts` (create or add to existing)
- Add `formatChange24h(value: number): string` utility
- Compact formatting: values > 9999 get K/M/B suffix, capped display

#### 2. Components to update (replace raw `.toFixed()` calls):
- `src/components/launchpad/CodexPairRow.tsx` — line 192
- `src/components/launchpad/KingOfTheHill.tsx` — line 291
- `src/components/launchpad/PriceChart.tsx` — line 217
- `src/components/layout/NewPairsPanel.tsx` — line 288
- `src/pages/FunTokenDetailPage.tsx` — lines 152, 331, 755, 835, 1000
- `src/components/agents/AgentTokenCard.tsx` — line 92
- `src/components/agents/AgentTopTokens.tsx` — where priceChange is displayed
- `src/components/punch/PunchTokenCard.tsx` — where change is displayed
- `src/pages/SaturnCommunityPage.tsx` — line 236

Each location replaces patterns like `{change24h.toFixed(1)}%` with `{formatChange24h(change24h)}`.

### Technical Detail

```typescript
// src/lib/formatters.ts
export function formatChange24h(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1e9).toFixed(1)}B%`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1e6).toFixed(1)}M%`;
  if (abs >= 10_000) return `${sign}${(abs / 1e3).toFixed(1)}K%`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}%`;
  return `${sign}${abs.toFixed(1)}%`;
}
```

This keeps numbers readable across all chains while preserving directional accuracy.

