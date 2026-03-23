

## Problem Analysis

The current BTC meme token launch flow has a fundamental integrity issue:

1. **`btc-meme-create`** inserts the token with `status: "active"` immediately
2. **`btc-genesis-proof`** is fired as fire-and-forget (async, no callback)
3. The user is redirected to the token page and trading begins **before** the OP_RETURN genesis transaction is even broadcast — let alone confirmed by the Bitcoin network
4. The launch page says "No blockchain confirmations needed" which is misleading
5. Token listings (`useBtcMemeTokens`) show ALL tokens with no status filter — pending tokens appear alongside confirmed ones

This means tokens can be "traded" before they have any on-chain existence.

---

## Plan

### 1. Add a `pending_genesis` status to the token lifecycle

- **`btc-meme-create`**: Change `status: "active"` → `status: "pending_genesis"` on insert
- **`btc-genesis-proof`**: After successful broadcast (or simulated pending genesis), update `status` to `"active"`
- This ensures no token appears as tradable until genesis is at least broadcast

### 2. Block trading on non-active tokens

- **`btc-meme-swap`**: Add a check at the top — if `pool.status !== 'active'`, reject the swap with "Token genesis not yet confirmed"

### 3. Update token listing queries

- **`useBtcMemeTokens`**: Add `.eq("status", "active")` filter so pending tokens don't show in the main feed
- Keep the detail page query unfiltered so creators can still see their token's pending state

### 4. Update the token detail page for pending state

- In `BtcMemeDetailPage.tsx`: Show a "Awaiting Bitcoin confirmation..." banner with a spinner when `token.status === 'pending_genesis'`
- Disable the buy/sell form while pending
- Auto-refresh every 5s (already in place) so it flips to active once genesis confirms

### 5. Update the launch page UX

- **`BtcMemeLaunchPage.tsx`**: Replace the misleading "No blockchain confirmations needed" text with accurate messaging: "Your token will go live once the Bitcoin genesis transaction is confirmed"
- After launch, navigate to the detail page where the user sees the pending state
- Update the "How It Works" section in `LaunchTokenPage.tsx` for BTC chain to mention the confirmation step

### 6. Update the launch success flow

- After `btc-meme-create` returns, show a toast like "Token submitted! Awaiting Bitcoin network confirmation..." instead of "launched!"

---

## Technical Details

**Edge function changes:**
- `btc-meme-create/index.ts`: `status: "active"` → `status: "pending_genesis"`
- `btc-genesis-proof/index.ts`: Add `status: "active"` to the update query after broadcast
- `btc-meme-swap/index.ts`: Add guard clause rejecting trades on non-active tokens

**Frontend changes:**
- `src/hooks/useBtcMemeTokens.ts`: Add status filter to list query
- `src/pages/BtcMemeLaunchPage.tsx`: Fix misleading copy, update toast
- `src/pages/BtcMemeDetailPage.tsx`: Add pending banner, disable trading form
- `src/pages/LaunchTokenPage.tsx`: Update BTC "How It Works" step 3 text

