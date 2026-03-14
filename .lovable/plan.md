

## Plan: Add "Generate PnL Card" Button to Trade Success Popup

### Changes

**1. Extend `TradeSuccessData` store** (`src/stores/tradeSuccessStore.ts`)
- Add `tokenName?: string` field (needed by ProfitCardModal)

**2. Update `TradeSuccessPopup`** (`src/components/TradeSuccessPopup.tsx`)
- Increase auto-dismiss from 6s → 15s for sell trades (buy stays at 6s)
- Add state for `showProfitCard` 
- Add a "Generate PnL Card" button below "View Transaction" (styled with lime-green Saturn branding)
- Clicking it pauses auto-dismiss, opens `ProfitCardModal` with data mapped from `TradeSuccessData`
- Import and render `ProfitCardModal` inside the component

**3. Pass `tokenName` from call sites**
- Update `showTradeSuccess` calls in `PulseQuickBuyButton.tsx` and `useFastSwap.ts` to include `tokenName` from available token data (e.g. `funToken.name` or `codexToken.name`)

**4. No changes needed to `ProfitCardModal`** — it already has Share to X, Save Image, and Skip buttons built in.

### Button Layout (sell popup)

```text
[View Transaction ↗]
[🪐 Generate PnL Card]    ← new, lime-green accent
```

Both buttons full-width, stacked. The PnL card button only appears on sell trades (where PnL data exists).

