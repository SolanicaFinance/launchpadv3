

## Current Layout vs Desired

Currently on **desktop (lg+)**, the layout is:
- **Left col (9/12)**: Chart → TokenDataTabs → **TradeSection** (buy/sell is BELOW trades table)
- **Right col (3/12)**: Token Details → Contract → Description → Comments → Wallet

The screenshot shows buy/sell panel should be on the **right side, top**, like pump.fun — not below the chart/trades.

## Plan

### Move TradeSection to right column (top) on Desktop

In the desktop layout (lines 834-869), restructure from:
```
Left (9): Chart → DataTabs → Trade
Right (3): Details → Contract → Desc → Comments → Wallet
```
To:
```
Left (9): Chart → DataTabs
Right (3): Trade → Wallet → Details → Contract → Desc → Comments
```

Make right column wider (col-span-4) and left narrower (col-span-8) so the trade panel has enough room for the buy/sell UI (matching the screenshot proportions).

### Same fix for Tablet layout

Already correct on tablet — trade is in right column (col-span-5). No change needed.

### Same fix for ExternalTokenView desktop layout

Lines 247-282: Move `UniversalTradePanel` from left col-span-9 into right col-span-3 (top), same pattern.

### Files to modify:
- `src/pages/FunTokenDetailPage.tsx` — restructure desktop grid in both `ExternalTokenView` and the main token view

