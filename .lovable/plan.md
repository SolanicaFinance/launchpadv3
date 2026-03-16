

# CEX Wallet Rotation via SplitNOW — Implementation Plan (No Fee)

## Summary
Detect when a user has already launched a token from their current wallet, show a warning banner on the Launchpad, and offer a 1-click wallet rotation flow that routes funds through a randomized CEX (Binance, KuCoin, Gate.io) via SplitNOW API to a fresh Privy embedded wallet. **No platform fee on splits.**

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/splitnow-proxy/index.ts` | Edge function proxying SplitNOW API (quote/order/status) |
| `src/components/launchpad/DevWalletRotationBanner.tsx` | Warning banner when user has existing launches |
| `src/components/launchpad/DevWalletRotationModal.tsx` | Step-by-step wizard modal with live status |
| `src/hooks/useDevWalletRotation.ts` | Hook orchestrating the full rotation flow |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/LaunchpadPage.tsx` | Add `DevWalletRotationBanner` below `WalletBalanceCard` |
| `src/hooks/useMultiWallet.ts` | Add `hideWallet(address)` method, filter hidden wallets |

## Database Migration
- Add `is_hidden BOOLEAN DEFAULT false` to `user_wallets`

## Edge Function: `splitnow-proxy`
- `verify_jwt = false` in config.toml
- Endpoints: `/quote`, `/order`, `/status`
- Uses `SPLITNOW_API_KEY` secret
- Full balance sent to SplitNOW deposit address — no fee deduction
- SplitNOW API base: `https://splitnow.io/api`

## Wizard Steps (Modal UI)
1. "Found X tokens from this wallet" — detection
2. "Generating fresh wallet..." — Privy `createWallet({ createAdditional: true })`
3. "Randomized CEX: [Binance/KuCoin/Gate.io]" — random pick
4. "Balance: X.XX SOL" — balance check
5. "Getting quote..." — SplitNOW quote
6. "Sending SOL to deposit address..." — sign + send tx
7. "Processing through [CEX]..." — poll status
8. "Complete! New wallet active" — switch wallet, hide old

## Prerequisite
`SPLITNOW_API_KEY` secret must be added before building the edge function. I'll prompt for it during implementation.

## Sequence
1. DB migration (add `is_hidden` column)
2. Add secret (`SPLITNOW_API_KEY`)
3. Create `splitnow-proxy` edge function
4. Create hook + modal + banner components
5. Wire banner into LaunchpadPage
6. Update `useMultiWallet` with hide support

