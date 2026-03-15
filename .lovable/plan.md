
## Plan: Remove PNL Simulator from Trade Page

The `PnlSimulator` component is defined inline in `src/pages/FunTokenDetailPage.tsx` (lines 660-704) and rendered in 3 places (lines 926, 945, 1006).

**Changes to `src/pages/FunTokenDetailPage.tsx`:**
1. Delete the `PnlSimulator` function definition (lines 660-704)
2. Remove the 3 `<PnlSimulator />` usages at lines 926, 945, and 1006
3. Remove the `TrendingUp` import if no longer used elsewhere
