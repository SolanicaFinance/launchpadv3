

# MEV Analysis Admin Tab

## Overview

Build a new "MEV" tab in the Admin Panel that analyzes sandwich attacks on your transactions using the Helius Enhanced Transactions API. It will parse the two provided MEV bot transactions alongside your victim transaction, extract profit/loss/fee data, and provide a foundation for MEV detection and replication research.

## What Gets Built

### 1. Edge Function: `mev-analyze` 

Accepts one or more transaction signatures and uses the Helius Enhanced Transactions API (`POST https://api.helius.xyz/v0/transactions`) to parse them. For each signature it returns:

- Full enhanced transaction data (token transfers, native transfers, fee payer, accounts involved)
- Computed fields: SOL spent on fees, tokens moved, counterparty wallets, timing (slot/blocktime)
- Sandwich detection logic: given a set of 3 signatures (front-run, victim, back-run), compute:
  - Bot's buy price vs your buy price vs bot's sell price
  - Bot profit (SOL gained minus fees/tips)
  - Your loss (price impact caused by the front-run)
  - Jito tip paid by the bot (if any, from Jito tip program accounts)
  - Slot timing (all 3 in same slot = confirmed sandwich)

### 2. Edge Function: `mev-monitor`

A broader scanner that, given a wallet address, fetches recent transactions and flags any that were sandwiched by checking for the pattern: same-slot transactions from known MEV bot programs (e.g., `vpeNALD...oax38b` / other known bot addresses) that bracket your swaps.

### 3. Admin Page: `MevAdminPage.tsx`

New tab in Admin Panel with sections:

**Transaction Analyzer** — Paste 1-3 transaction signatures, click "Analyze". Displays:
- Transaction timeline (slot, timestamp, block position)
- Token flow diagram: who sent what to whom
- Fee breakdown (base fee, priority fee, Jito tip)
- For sandwich sets: bot profit, your slippage loss, price impact

**Sandwich Breakdown Card** — When 3 related txs are provided:
- Front-run TX: Bot buys token X for Y SOL
- Victim TX (yours): You buy token X at inflated price
- Back-run TX: Bot sells token X for Z SOL
- Net bot profit: Z - Y - fees
- Your excess cost: difference vs fair price

**Wallet MEV History** — Enter a wallet, scan recent transactions for sandwich attacks. Table showing date, token, bot address, your loss, bot profit.

**MEV Replication Research** — Static reference section with:
- How sandwich bots work (mempool monitoring, Jito bundles, priority fees)
- Key infrastructure needed (Geyser plugin / LaserStream for sub-ms tx visibility, dedicated validator, Jito bundle submission)
- Estimated costs (validator node, RPC, Jito tips)
- Links to relevant tools (sandwiched.me, Jito explorer)

### 4. Database Table: `mev_analyses`

Stores analyzed sandwich attacks for reference:
- `id`, `victim_signature`, `frontrun_signature`, `backrun_signature`
- `victim_wallet`, `bot_wallet`, `token_mint`, `token_name`
- `bot_profit_sol`, `victim_loss_sol`, `bot_fees_sol`, `jito_tip_sol`
- `slot`, `block_time`, `created_at`

### 5. Admin Panel Integration

- Add "MEV" tab with `Zap` icon to `TAB_CONFIG` in `AdminPanelPage.tsx`
- Lazy-load `MevAdminPage`

## Technical Details

**Helius API calls** (edge function, using existing `HELIUS_API_KEY`):
```
POST https://api.helius.xyz/v0/transactions?api-key=KEY
Body: { "transactions": ["sig1", "sig2", "sig3"] }
```

Returns enhanced data with `nativeTransfers`, `tokenTransfers`, `fee`, `feePayer`, `timestamp`, `slot`, `type`.

**Sandwich detection algorithm:**
1. Parse all 3 txs
2. Verify same slot (or adjacent slots)
3. Identify the common token mint across all 3
4. Calculate: bot buys at price P1, you buy at P2 > P1, bot sells at P3 > P2
5. Bot profit = (P3 - P1) * token_amount - total_fees
6. Your loss = (P2 - fair_price_estimate) * your_token_amount

**Jito tip detection:** Check if any transfer goes to known Jito tip accounts (8 known addresses).

## Files Created/Modified

| File | Action |
|---|---|
| `supabase/functions/mev-analyze/index.ts` | Create |
| `supabase/functions/mev-monitor/index.ts` | Create |
| `src/pages/MevAdminPage.tsx` | Create |
| `src/pages/AdminPanelPage.tsx` | Modify — add MEV tab |
| DB migration | Create `mev_analyses` table |

## Implementation Order

1. Database migration (`mev_analyses`)
2. `mev-analyze` edge function
3. `mev-monitor` edge function  
4. `MevAdminPage.tsx` with all sections
5. Wire into Admin Panel tabs

