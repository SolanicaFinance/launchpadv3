

## Fix KingCard Layout, Alignment & Polish

After reviewing the component code and CSS, the KingCard in `KingOfTheHill.tsx` is structurally sound but has several visual inconsistencies visible in the screenshot. Here is the targeted fix plan:

### Problems & Fixes

**1. MCAP / HOLDERS misalignment across cards**
- The current layout uses `flex items-center gap-4` which causes values to float loosely when content widths differ between cards
- Fix: Use a CSS grid with fixed columns (`grid grid-cols-2`) for MCAP and HOLDERS, so labels and values always align vertically. Volume 24h spans full width below if present.

**2. Progress bar: "BONDING PROGRESS" not duplicated in code (only one instance), but the bar is still thin at 8px**
- Increase to 10px height for more visual weight
- Keep the single label + percentage layout (already correct in code)
- Make percentage text slightly larger (13px bold)

**3. Footer buttons inconsistent sizing**
- Trade button and Quick Buy button have different padding/height
- Fix: Give both buttons the same `py-2 px-4` and `rounded-xl`, ensure flex-1 so they share width equally
- Social icons: add a subtle separator (thin border-left) and ensure consistent 28px icon button sizing

**4. Card hover effect**
- Already has `hover:scale-[1.02]` and glow -- this is fine, keep it
- Add a subtle `hover:border-opacity` transition for smoother feel

**5. X handle row**
- Already implemented with "— None" fallback -- this is correct
- No changes needed

### Files to Modify

**`src/components/launchpad/KingOfTheHill.tsx`** (lines 268-305, 312-330):
- Replace the MCAP/HOLDERS flex layout with a 2-column grid for consistent alignment
- Make MCAP value `text-lg` (was `text-xl` -- slightly smaller for better fit)
- Holders value bumped to `text-sm font-bold`
- Progress bar height increased to 10px
- Footer: both buttons get `flex-1` for equal width, matched padding

**`src/index.css`** (lines 1370-1393):
- Ensure `.king-quick-buy-wrapper` button gets `flex: 1` and `width: 100%`
- Add `min-height: 36px` to both footer buttons for consistent height

### Technical Details

MCAP/HOLDERS grid structure:
```text
┌─────────────┬─────────────┐
│ MCAP        │ HOLDERS     │
│ $2.6K +5.2% │ 👥 2        │
└─────────────┴─────────────┘
│ VOL 24H (optional, full width) │
```

Footer buttons:
```text
┌──────────┬──────────┐
│  Trade ↗ │ ⚡0.8 SOL │
└──────────┴──────────┘
  [𝕏] [💬] [🌐] [📋] [📊]
```

