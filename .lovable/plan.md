

# BTC Trade: Double-Spend Prevention, Popup & PnL Card

## Current State

**Double-spend protection**: Already handled. The `execute_btc_swap` Postgres function uses `SELECT ... FOR UPDATE` row-level locking on both the token and user balance rows. Even if a user spam-clicks buy, each request queues up and the second one will fail with "Insufficient BTC balance" if the first already drained the funds. No changes needed here.

**Solana proof timing**: The proof memo is fired asynchronously (`fireAndForget`) after the swap edge function returns. It does NOT block the trade response. Typical latency: ~1-3 seconds after the user sees the success popup.

**Trade success popup**: Already called via `showTradeSuccess()` after a successful BTC trade. However, it's missing PnL data and the Solana proof signature (which arrives async).

## What Needs Fixing

1. **UI button disable during trade** — The buy/sell button on `V2BtcMemeDetailPage` uses a `trading` state but doesn't prevent re-submission while a request is in flight. Need to ensure the button is properly disabled.

2. **PnL data missing from popup** — The `execute_btc_swap` function doesn't return `avg_buy_price_btc` or PnL calculations. On sell, we need to compute profit/loss and pass it to `showTradeSuccess`.

3. **Solana proof not shown in popup** — The proof signature arrives async. We should poll/subscribe for it and update the popup or make it available on the PnL card.

4. **PnL Card generation for BTC trades** — The `ProfitCardModal` already supports `chain: 'btc'` but needs proper `pnlSol` (actually pnlBtc) and `pnlPercent` data.

## Plan

### Step 1: Extend `execute_btc_swap` to return PnL data
Add to the Postgres function's return JSON:
- `avgBuyPrice` — user's average buy price for this token
- `pnlBtc` — realized PnL in BTC (sell only): `(sell_price - avg_buy_price) * token_amount`
- `pnlPercent` — percentage gain/loss

This is a migration that alters the function to include these fields in the `jsonb_build_object` return.

### Step 2: Pass PnL to `showTradeSuccess` in V2BtcMemeDetailPage
Update `handleTrade` to extract PnL fields from the swap response and include them:
```
showTradeSuccess({
  ...existing fields,
  pnlSol: trade.pnlBtc,      // reused field, displayed as BTC via chain:'btc'
  pnlPercent: trade.pnlPercent,
  signature: data.tradeId,     // use trade ID as reference
});
```

### Step 3: Poll for Solana proof signature
After trade success, set up a short poll (every 2s, max 30s) querying `btc_meme_trades` for the `solana_proof_signature` on the returned `tradeId`. Once found, update the store with the proof signature so the popup shows the "Solana Proof" link.

### Step 4: Ensure button disable on trade in-flight
Verify the trade button in `V2BtcMemeDetailPage` is properly disabled when `trading` is true to prevent double-click submissions. The Postgres lock is the real guard, but UX should prevent unnecessary error toasts.

## Technical Details

- **Migration**: `ALTER` the `execute_btc_swap` function to compute and return `avgBuyPrice`, `pnlBtc`, `pnlPercent` for sell trades (buy trades return null for these)
- **Edge function**: Pass the new fields through in `btc-meme-swap/index.ts` response
- **Frontend**: ~15 lines changed in `V2BtcMemeDetailPage.tsx` to wire PnL data and proof polling
- **No new components needed** — existing `TradeSuccessPopup` and `ProfitCardModal` already handle BTC chain context

