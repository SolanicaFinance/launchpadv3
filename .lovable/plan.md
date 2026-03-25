

## Issues Found

**1. Critical syntax bug in `_shared/telegram-notify.ts`**
The `sendTelegramNotification` function is missing its closing `}` before `postToCaptcha` is defined. This means `postToCaptcha` is nested inside `sendTelegramNotification` and invisible to the exported functions (`notifySolLaunch`, `notifyBnbLaunch`) that call it directly. This causes SOL/BNB notifications to fail with a ReferenceError.

**2. BTC market cap is wrong in notifications**
The market cap displayed (e.g., "MCap: 0.2811 BTC") is calculated as `price * 1B total supply`, where price comes from `virtual_btc_reserves / virtual_token_reserves`. With 0.3 BTC virtual reserves, this always shows ~0.28 BTC even for brand new tokens with tiny real reserves. The notification should show the **real BTC reserves** as a more meaningful market indicator, or label it differently.

**3. Too many notifications / missing info**
Every single trade fires a notification. For rapid trading (4 buys in 2 minutes from the same wallet), this spams the channel. Notifications also lack the token name and chain label.

---

## Plan

### Step 1: Fix syntax bug in `_shared/telegram-notify.ts`
- Add the missing closing `}` for `sendTelegramNotification` (after line 41)
- Move `postToCaptcha` to module scope so it's callable from all exported functions

### Step 2: Fix BTC market cap in notifications
- Change the BTC notification to show **real BTC reserves** (the actual deposited BTC backing the token) instead of the virtual-reserves-based market cap
- Label it "Pool: X sats" or "Real MCap" to be accurate
- The `execute_btc_swap` function already returns the correct data; we just need to pass `real_btc_reserves` from the pool state

### Step 3: Improve notification content
- Add chain labels to all notifications (🟠 BTC, 🟣 SOL, 🟡 BNB)
- Add token name alongside ticker
- Include the specific token page link for BTC notifications (not just `/btc/meme`)

### Step 4: Add notification throttling for BTC trades
- Add a simple deduplication check: before sending a BTC trade notification, query the most recent notification timestamp for that token. If a notification was sent within the last 30 seconds, skip it or batch into a summary
- Implement via a lightweight in-memory check or a quick DB query on `btc_meme_trades` to see recent trade density

### Files to modify
- `supabase/functions/_shared/telegram-notify.ts` — fix syntax, add chain labels
- `supabase/functions/btc-meme-swap/index.ts` — fix market cap data, add throttling, improve notification format
- `supabase/functions/server-trade/index.ts` — minor: ensure notification has full info
- `supabase/functions/bnb-swap/index.ts` — minor: ensure notification has full info

