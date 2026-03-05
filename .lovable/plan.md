

## Quick Buy Sync + Filter Count Removal

Two changes requested:

### 1. Column header quick-buy syncs globally and persists

Currently each `PulseColumnHeaderBar` has its own local `qbInput` state and calls `onQuickBuyChange` — but the parent `AxiomTerminalGrid` doesn't have an `onQuickBuyChange` prop, so changes in the column header never propagate to the global `quickBuyAmount` or to the token card buttons.

**Fix:**
- Add `onQuickBuyChange` prop to `AxiomTerminalGrid` interface and pass it through from `TradePage.tsx`
- In `TradePage.tsx`, create a `handleQuickBuySet(amount: number)` that updates both `quickBuyAmount` state, `quickBuyInput` string state, and `localStorage`
- Pass this handler to `AxiomTerminalGrid` → each `PulseColumnHeaderBar`'s `onQuickBuyChange`
- In `PulseColumnHeaderBar`, sync `qbInput` local state when `quickBuyAmount` prop changes (useEffect), so all 3 headers instantly reflect the new value when any one is edited
- The token card "⚡ 0.5 SOL" buttons already receive `quickBuyAmount` as prop — they'll update automatically

**Files:** `TradePage.tsx`, `AxiomTerminalGrid.tsx`, `PulseColumnHeaderBar.tsx`

### 2. Remove count numbers from filter dialog column tabs

In `PulseFiltersDialog.tsx` line 99, remove the `<span>` showing `counts[col.id]` from the column tab buttons. The `counts` prop can be removed entirely from the interface.

**Files:** `PulseFiltersDialog.tsx`, `AxiomTerminalGrid.tsx` (remove `counts` prop pass)

