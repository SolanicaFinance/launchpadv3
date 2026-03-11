

## Fix: Wallet Tracker — Missing Trade Notifications

### Root Cause

The **webhook receiver edge function is missing**. Here's the current flow:

```text
Tracked wallet makes a trade on-chain
        │
        ▼
Helius webhook fires (configured via wallet-tracker-manage)
        │
        ▼
POST → ??? (NO ENDPOINT EXISTS)     ← Problem is here
        │
        ▼
wallet_trades table (EMPTY — never gets populated)
        │
        ▼
Supabase Realtime → WalletTrackerPanel listens for INSERTs
        │
        ▼
Toast + Sound (never fires because no data arrives)
```

The `wallet-tracker-manage` function correctly syncs addresses to the Helius webhook, and the frontend correctly subscribes to `wallet_trades` INSERTs via Realtime. But there is no edge function to receive the Helius webhook POST and insert rows into `wallet_trades`.

### Fix: Create `wallet-trade-webhook` Edge Function

**1. Create `supabase/functions/wallet-trade-webhook/index.ts`**

- Receives POST from Helius enhanced webhook (array of enriched transactions)
- Validates the webhook using `HELIUS_WEBHOOK_SECRET` (Authorization header)
- For each transaction, parses swap data:
  - Extracts `token_mint`, `token_name`, `sol_amount`, `token_amount`, `trade_type` (buy/sell) from Helius enhanced transaction format (nativeTransfers, tokenTransfers, swap events)
  - Looks up `tracked_wallet_id` from `tracked_wallets` table by matching wallet address
- Inserts parsed trade into `wallet_trades` table
- Returns 200 so Helius doesn't retry

**2. Register in `supabase/config.toml`**

Add `verify_jwt = false` since Helius calls this externally (not via Supabase client). Authentication uses the webhook secret instead.

**3. Configure Helius Webhook URL**

The Helius webhook needs to point to: `https://<project-id>.supabase.co/functions/v1/wallet-trade-webhook`

This may need a one-time update — either manually via Helius dashboard or by updating the `syncHeliusWebhook` function to also set the `webhookURL` field when creating/updating the webhook.

### Files Changed
- `supabase/functions/wallet-trade-webhook/index.ts` — New file (webhook receiver)
- `supabase/config.toml` — Add `verify_jwt = false` for the new function

