
Goal: Fix Alpha Tracker so buys/sells reliably appear, and restore all missing historical trades (you chose full backfill).

What I confirmed from the backend:
- `alpha_trades` has only 1 row total (0 buys, 1 sell).
- `launchpad_transactions` has 42 rows (41 buys, 1 sell).
- 41 trades exist in `launchpad_transactions` but are missing from `alpha_trades`.
- This means the tracker UI is mostly empty because source data is missing, not because the table rendering is broken.

Implementation plan

1) Immediate data recovery (full backfill)
- Backfill `alpha_trades` from existing `launchpad_transactions` + `tokens` (+ `profiles` when available) for all missing signatures.
- Use `tx_hash/signature` as the dedupe key so reruns are safe.
- Populate:
  - `trade_type` from `transaction_type`
  - `amount_sol`, `amount_tokens`, `price_sol`
  - `token_mint`, `token_name`, `token_ticker`
  - `wallet_address`, `trader_display_name`, `trader_avatar_url`
  - `chain = 'solana'`

2) Make future recording impossible to miss
- Add a DB trigger on `launchpad_transactions` INSERT that upserts into `alpha_trades`.
- This removes dependence on client-side “fire-and-forget” calls for Alpha Tracker feed integrity.
- Keep current edge-function writes as secondary path, but DB-trigger becomes the guaranteed source of truth for Solana trades.

3) Harden edge-function recording paths
- Update `launchpad-swap` and `bnb-swap` logging/error handling so alpha-trade write failures are never silently swallowed.
- Standardize to consistent `upsert(..., { onConflict: "tx_hash" })` behavior and explicit error logs.
- Ensure BNB trades keep writing directly to `alpha_trades` (since they don’t flow through `launchpad_transactions`).

4) Frontend resilience + observability
- Improve `useAlphaTrades` to handle query errors explicitly (instead of silently showing empty state).
- Add a lightweight diagnostic signal in Alpha Tracker UI when feed is empty but backend has recent transaction activity (prevents “looks broken with no clue” state).

5) Validation (end-to-end)
- Verify backfill count matches missing signatures before/after.
- Execute one buy + one sell on Solana and confirm:
  - rows appear in `launchpad_transactions`
  - mirrored rows appear in `alpha_trades` within seconds
  - `/alpha-tracker` updates in realtime and shows correct BUY/SELL badge + amounts.
- Execute one BNB buy/sell and confirm direct alpha feed insertion also appears.

Technical details (what I will build)
- Schema change (migration):
  - `public.sync_alpha_trade_from_launchpad_tx()` trigger function
  - trigger on `public.launchpad_transactions` AFTER INSERT
- Data operation (non-migration SQL execution):
  - one-time full backfill `INSERT ... SELECT ... ON CONFLICT (tx_hash) DO UPDATE`
- Code changes:
  - `src/hooks/useAlphaTrades.ts` (error visibility)
  - `supabase/functions/launchpad-swap/index.ts` (recording hardening)
  - `supabase/functions/bnb-swap/index.ts` (recording hardening)

Why this fixes the root issue
- Right now Alpha Tracker depends on optional/silent write paths that have already left 41 trades behind.
- With DB-level mirroring + full backfill, historical and future buys/sells are both covered, and tracker visibility no longer depends on fragile client timing.