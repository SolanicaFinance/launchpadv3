

## Use Official Launchpad Logos in LaunchpadBadge

### Problem
Currently using generic Lucide icons (Rocket, Briefcase, Zap) as fallbacks instead of real launchpad logos.

### Solution
Replace all Lucide icon fallbacks with official logo URLs. Use local assets where available (`pumpfun-pill.webp`, `tuna-logo.png`), and hardcoded official icon URLs for the rest as fallbacks when Codex `iconUrl` isn't provided.

### Official Icon Sources
| Launchpad | Source |
|-----------|--------|
| Pump.fun | Local `pumpfun-pill.webp` (already works) |
| Meteora | Local `tuna-logo.png` (already exists, not used) |
| Bonk | `https://www.bonk.fun/favicon.ico` |
| Believe | `https://believe.app/images/icons/icon.png` |
| Boop | `https://boop.fun/images/brand.png` |
| Jupiter | `https://jup.ag/favicon.ico` |
| bags.fm | `https://bags.fm/favicon.ico` |
| Moonshot | Codex `iconUrl` or `https://moonshot.money/favicon.ico` |

### Changes

**File**: `src/components/launchpad/LaunchpadBadge.tsx`

1. Import `tuna-logo.png` for Meteora (local asset)
2. Add `officialIcon` URL to each entry in `LAUNCHPAD_CONFIG`
3. Remove `FallbackIcon` component and Lucide icon imports (Rocket, Briefcase, Zap)
4. Always render `<img>` tags — use `iconUrl` (from Codex) → `officialIcon` (hardcoded) → generic text-only fallback
5. Update bags.fm and Meteora special cases to use their real logos instead of Briefcase icon / 🐟 emoji

No other files need changes — `CodexPairRow` and `AxiomTokenRow` already pass `iconUrl` through.

