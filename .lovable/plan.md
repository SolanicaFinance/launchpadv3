

## Root Cause

Two issues are causing the banner to disappear:

1. **Wrong table**: The banner queries the `tokens` table, which is **empty** (confirmed via DB query and network logs returning `[]`). Your launches are stored in the **`fun_tokens`** table.

2. **Checking all wallets instead of active only**: Per your preference, the banner should only check the currently active embedded wallet, not all managed wallets.

## Plan

**Edit `src/components/launchpad/DevWalletRotationBanner.tsx`:**

- Change the query from `tokens` to `fun_tokens`
- Instead of collecting all `managedWallets` addresses, use only the `activeWallet?.address` from `useMultiWallet()`
- Simplify the effect to run when `activeWallet.address` changes (with a ref guard to prevent re-fetches for the same address)
- Keep the existing `checked` / `launchCount` state and rendering logic

