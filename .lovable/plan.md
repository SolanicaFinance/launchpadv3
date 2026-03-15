

## Fix Earnings Tab: Use Wallet-Based Lookup Instead of Twitter/X

### Problem

The Earnings tab shows 0 because:
1. `PanelEarningsTab` calls `launchpad-earnings` → queries `fee_earners` table → **always empty** (never populated)
2. `PanelMyLaunchesTab` works but **requires X/Twitter linked** — it finds tokens via `agent_social_posts.post_author` matching twitter username
3. Tokens launched from the website are stored with `creator_wallet` in `fun_tokens` and `tokens` tables — **no Twitter dependency needed**

The `claw-creator-claim` edge function currently only looks up tokens by twitter username. It needs to also support wallet-based lookup.

### Plan

#### 1. Update `launchpad-earnings` edge function — wallet-based earnings calculation

Rewrite to calculate earnings the same way `claw-creator-claim` does, but using **wallet address** to find tokens (via `creator_wallet` in `fun_tokens` and `tokens` tables):

- Find all tokens where `creator_wallet = walletAddress` from both `fun_tokens` and `tokens`
- For each token, sum `fun_fee_claims.claimed_sol` (system-claimed fees from the pool)
- Apply `creator_fee_bps / trading_fee_bps` ratio to get creator's share
- Subtract already-paid distributions from `claw_distributions` and `fun_distributions`
- Return per-token earnings breakdown + totals + claim history

No Twitter/X account required.

#### 2. Update `PanelEarningsTab` — use embedded wallet, remove X dependency

- Import `useSolanaWalletWithPrivy` to get embedded wallet address
- Use embedded wallet as `activeAddress` (same fix as dashboard)
- The existing `useUserEarnings` hook already passes wallet address — just needs the right one
- Remove any mention of "claw" in the UI

#### 3. Update `claw-creator-claim` edge function — support wallet-based claims

Add `creatorWallet` as an alternative to `twitterUsername`:
- If `creatorWallet` provided, find tokens via `creator_wallet` in `fun_tokens` + `tokens`
- Keep existing twitter-based lookup as fallback
- This allows claiming without X linked

Rename internal logs from "claw" to "saturn".

#### 4. Wire up Claim button in Earnings tab

- `PanelEarningsTab.handleClaim` → call `claw-creator-claim` with `creatorWallet` (embedded wallet) instead of `twitterUsername`
- Payout goes to the same embedded wallet

#### 5. Remove "claw" branding references

- `PanelMyLaunchesTab`: Update hardcoded `clawmode.lovable.app` URL, `@clawmode` twitter references to use `BRAND` constants
- Edge function log prefixes already say "saturn" — just clean up any remaining "claw" user-facing strings

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/launchpad-earnings/index.ts` | Rewrite to query `fun_tokens`/`tokens` by `creator_wallet`, calculate earnings from `fun_fee_claims` with bps ratio |
| `supabase/functions/claw-creator-claim/index.ts` | Add `creatorWallet` param as alternative to `twitterUsername` for token lookup |
| `src/components/panel/PanelEarningsTab.tsx` | Use embedded wallet via `useSolanaWalletWithPrivy`, call claim endpoint with wallet |
| `src/components/panel/PanelMyLaunchesTab.tsx` | Fix hardcoded "claw" URLs/branding to use `BRAND` |

