

## Change the "Connection is stable" badge shape to square

**What**: Change the green badge's `borderRadius` from `999px` (pill/round) to `4px` (square with slight rounding) on line 203 of `StickyStatsFooter.tsx`.

**Single edit**:
- `src/components/layout/StickyStatsFooter.tsx` line 203: change `borderRadius: "999px"` → `borderRadius: "4px"`

