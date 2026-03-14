

## Alpha Tracker: New Trades Not Appearing — Root Cause & Fix Plan

### Root Cause

The `alpha_trades` table has **no UPDATE RLS policy**. The client-side `recordAlphaTrade` function uses `.upsert()` with `onConflict: "tx_hash"`. When a database trigger (from `launchpad_transactions` or `wallet_trades`) fires first and inserts the row, the client's upsert hits the conflict and attempts an **UPDATE** — which is **silently denied by RLS** because only INSERT and SELECT policies exist. The edge function's `alpha_only` upsert also fails for the same reason when it runs after the trigger.

Even when triggers don't fire first (e.g., external/unindexed tokens), race conditions between the two recording paths (client + edge function) can cause the second to hit the conflict and fail.

### Fix (2 changes)

**1. Database migration — Add UPDATE policy on `alpha_trades`**

```sql
CREATE POLICY "Anyone can update alpha trades"
  ON public.alpha_trades
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
```

This allows the upsert's UPDATE leg to succeed when there's a tx_hash conflict.

**2. Code change — Make client insert resilient (`src/lib/recordAlphaTrade.ts`)**

Change the client-side from `.upsert()` to `.upsert(..., { onConflict: "tx_hash", ignoreDuplicates: true })`. This way if the row already exists, it simply does nothing instead of attempting an UPDATE, making it fully safe under current RLS even before the migration runs.

These two changes together ensure all three recording paths (triggers, client upsert, edge function upsert) succeed regardless of execution order.

