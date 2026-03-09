

## Plan: Fix Launchpad Dropdown to Match Reference Image 1:1

### Problems Identified
1. **Wrong Meteora icon** — currently using `tuna-logo.png` (Tuna launchpad), need actual Meteora logo
2. **Footer button icons** — should show overlapping Pumpfun, Bonk, and Meteora icons specifically
3. **Dropdown styling doesn't match reference** — icons too small, spacing off, need exact 1:1 match

### Reference Image Analysis (image-588)
- Dark card background, rounded corners
- **"Launchpads"** title (bold, ~24px) with refresh icon top-right
- Thin separator line below title
- Each row: **~40px rounded-square icon** | **name** (white, ~18px) | **green count** (bold, right-aligned, ~20px, comma-formatted)
- 6 rows: pumpfun (8,500,000), bonk (45,000), meteora (125,000), bags.fm (12,000), moonshot (85,000), raydium (350,000)
- All counts are green (`hsl(142, 71%, 45%)`)
- Generous vertical padding per row (~16px)

### Changes

#### 1. Download correct Meteora icon
- Fetch from `https://app.meteora.ag/favicon.ico` or `https://app.meteora.ag` and save as `src/assets/meteora-icon.png`
- Replace the `tunaLogo` import with new meteora icon

#### 2. Update footer button icons
- Show exactly Pumpfun, Bonk, Meteora overlapping icons (not first 3 from API response)
- Hardcode the 3 icon imports in the button

#### 3. Fix dropdown styling to match reference exactly
- Icon size: **40px** with `borderRadius: 8px` (rounded square, not circle)
- Icon background: subtle dark bg
- Name: `18px`, white, font-weight 500
- Count: `20px`, bold, **always green** (not conditional color)
- Row padding: `14px 8px`
- Dropdown width: `320px`
- Title: `24px` bold

### Files to modify
- `src/components/layout/StickyStatsFooter.tsx` — fix imports, button icons, dropdown styling
- Download and create `src/assets/meteora-icon.png` from Meteora website

