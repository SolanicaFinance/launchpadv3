

# Add Launchpad Stats Dropdown to Footer

## Overview
Add a second dropdown in the footer (next to the region selector) that shows live launchpad data — same visual style as the regions dropdown with icons, labels, and live-updating metrics.

## Data Source
Create a new edge function `launchpad-stats` that queries the `fun_tokens` table, grouping by `launchpad_type` to get per-launchpad counts. It will return token count, active token count, and latest launch time for each platform. Data cached server-side for 5 minutes, client refreshes every 5 minutes.

### Launchpads to show (with icons):
| Launchpad | Icon | Source |
|-----------|------|--------|
| Pump.fun | `pumpfun-pill.webp` (local asset) | `launchpad_type = 'pumpfun'` |
| Meteora | `tuna-logo.png` (local asset) | `launchpad_type = 'dbc'` |
| Bags.fm | `https://bags.fm/favicon.ico` | `launchpad_type = 'bags'` |
| Bonk | `https://www.bonk.fun/favicon.ico` | `launchpad_type = 'bonk'` |
| Believe | `https://believe.app/images/icons/icon.png` | `launchpad_type = 'believe'` |
| Boop | `https://boop.fun/images/brand.png` | `launchpad_type = 'boop'` |
| Moonshot | `https://moonshot.money/favicon.ico` | `launchpad_type = 'moonshot'` |
| Phantom | favicon | `launchpad_type = 'phantom'` |

## Files

### 1. New: `supabase/functions/launchpad-stats/index.ts`
- Query `fun_tokens` grouped by `launchpad_type`
- For each type: `COUNT(*)` total, `COUNT(*) WHERE status='active'` active, `MAX(created_at)` last launch
- 5-minute server-side cache
- Return array: `[{ type, total, active, lastLaunch }]`

### 2. New: `src/hooks/useLaunchpadStats.ts`
- Calls `supabase.functions.invoke("launchpad-stats")`
- `refetchInterval: 5 * 60 * 1000` (5 min)
- Returns typed array of launchpad stats

### 3. Update: `src/components/layout/StickyStatsFooter.tsx`
- Add a "Launchpads" dropdown button to the left of the region selector
- Same visual pattern: button shows current selected launchpad + token count
- Dropdown opens upward with header "Launchpads" + refresh button
- Each row: launchpad icon (14x14) + name + token count (color-coded)
- Selected item gets left border accent like regions
- Icons: use local assets for Pump.fun and Meteora, external URLs for others

### 4. Update: `supabase/config.toml`
- Add `[functions.launchpad-stats]` with `verify_jwt = false`

## Visual Layout (matching screenshot style)
```text
┌──────────────────────────┐
│  Launchpads            ↻ │
├──────────────────────────┤
│ 🟢 Pump.fun      1,234  │
│ 🔵 Meteora          892  │
│ │🔵 Bags.fm         456  │  ← selected
│ 🟠 Bonk             321  │
│ 🟣 Moonshot         198  │
│ 🟢 Believe          156  │
│ 🟣 Boop              89  │
│ 🟣 Phantom            45 │
└──────────────────────────┘
```

Token counts will be color-coded: green (>500), yellow (100-500), red (<100) to match the ping color scheme.

