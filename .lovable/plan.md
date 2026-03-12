

## Fix: Every Swap Instantly Recorded in Alpha Tracker

### Problem

Two blockers prevent trades from appearing in Alpha Tracker:

1. **Edge function blocks graduated tokens** — Line 70-78 of `launchpad-swap/index.ts` returns a 400 error for graduated tokens *before* the `mode: 'record'` block at line 83. So any graduated/Jupiter swap that tries to record gets rejected.

2. **Jupiter swaps skip recording entirely** — In `useFastSwap.ts`, when `executeFastSwap` routes to `swapGraduated()` (line 198), it never calls `launchpad-swap` at all. The recording call only exists inside `swapBondingCurve` (line 133).

### Changes

**1. `supabase/functions/launchpad-swap/index.ts`**
- Move the graduated token check (lines 70-78) to **after** the record mode block ends (after line 276). This way `mode: 'record'` always works regardless of token status — it just records the trade and inserts into `alpha_trades`.
- Add `chain: 'solana'` to both `alpha_trades` inserts (lines 221 and 508) for consistency with the BNB swap function which already sets `chain: 'bnb'`.

**2. `src/hooks/useFastSwap.ts`**
- In `executeFastSwap`, after `swapGraduated()` returns successfully, fire a non-blocking `launchpad-swap` call with `mode: 'record'` — identical pattern to what `swapBondingCurve` already does (lines 133-145). This ensures Jupiter/graduated swaps also get recorded into `alpha_trades`.

```text
Current flow:
  executeFastSwap → swapGraduated → Jupiter → ✅ on-chain done → ❌ no DB record

Fixed flow:
  executeFastSwap → swapGraduated → Jupiter → ✅ on-chain done → ✅ record via launchpad-swap → ✅ alpha_trades insert
```

### Result
Every swap from the platform (bonding curve or graduated/Jupiter) will instantly insert into `alpha_trades`, which the Alpha Tracker reads via Realtime subscription — appearing in the feed within ~1 second.

