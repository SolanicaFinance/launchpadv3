

## Plan: Implement 1% Base Platform Fee on Phantom Launches

### Current State
- User selects a trading fee (e.g., 3%) which becomes the **total** on-chain Meteora fee.
- Fee distribution in `fun-distribute` splits this total among creator/buyback/system.
- The `fun_tokens` table has `trading_fee_bps` and `creator_fee_bps` columns, but `fun-phantom-create` Phase 2 doesn't store either.

### Desired Behavior
- **1% base platform fee** is always charged (100 bps, non-negotiable).
- User-selected fee (slider) is the **creator's fee** on top of the 1%.
- Total on-chain fee = 1% + user-selected %. E.g., user picks 3% → total = 4% (400 bps on-chain).
- 1% always goes to treasury (`B85zVUNh...Wvc`).
- Creator's % goes to their Phantom wallet.

### Changes

#### 1. Frontend: Update fee slider label & logic
**File:** `src/pages/ClaudeLauncherPage.tsx`
- Rename slider label from "Fee" to "Creator Fee" and show total (creator + 1% base).
- Change `phantomTradingFee` default from 200 (2%) to 100 (1%) for the creator portion.
- When sending to edge function, calculate `tradingFeeBps = phantomTradingFee + 100` (creator + base).
- Also pass `creatorFeeBps: phantomTradingFee` separately so the DB records who gets what.

**File:** `src/components/launchpad/TokenLauncher.tsx`
- Same adjustment: pass both `tradingFeeBps` (total) and `creatorFeeBps` (creator portion) to `fun-phantom-create`.

#### 2. Edge function: Store fee breakdown in DB
**File:** `supabase/functions/fun-phantom-create/index.ts`
- Accept new `creatorFeeBps` parameter.
- In Phase 1: pass `tradingFeeBps` (total including base) to Meteora pool creation — this is the on-chain fee.
- In Phase 2 (DB insert): store `trading_fee_bps` (total) and `creator_fee_bps` (creator portion) on the `fun_tokens` record.

#### 3. Vercel endpoint: Ensure total fee passed through
**File:** `api/pool/create-phantom.ts`
- No logic changes needed — it already passes `tradingFeeBps` through to `createMeteoraPool`. The frontend will now send the correct total.

#### 4. Fee distribution: Use stored split
**File:** `supabase/functions/fun-distribute/index.ts`
- For `launchpad_type = 'phantom'` tokens: read `creator_fee_bps` and `trading_fee_bps` from the token record.
- Calculate creator share = `creator_fee_bps / trading_fee_bps` (e.g., 300/400 = 75%).
- System/platform share = remainder (e.g., 100/400 = 25%).
- This replaces the hardcoded 50/30/20 split for Phantom tokens.

#### 5. UI display: Show fee breakdown on token page
**File:** `src/components/launchpad/UniversalTradePanel.tsx` (and mobile variant)
- Show "Fee: X% (Y% creator + 1% platform)" in the trade panel info area.

### Summary of Fee Flow
```text
User picks 3% creator fee
  → Total on-chain fee = 4% (400 bps)
  → Meteora DBC pool charges 4% per trade
  → When fees are claimed via fun-distribute:
      Creator wallet receives 3/4 = 75% of claimed fees
      Treasury receives 1/4 = 25% of claimed fees
```

