

# Admin Assisted Swaps Page

## What Already Works
The `server-trade` edge function already does exactly what's needed — it accepts a wallet address / profileId / privyUserId, resolves the Privy embedded wallet ID, builds a swap via the Meteora API, signs server-side via Privy, and broadcasts. All required secrets (`PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`, `PRIVY_AUTHORIZATION_KEY_ID`, `HELIUS_RPC_URL`, `METEORA_API_URL`) are already configured.

**No new edge function is needed.** The admin page just calls `server-trade` with the right parameters.

## What Needs to Be Built

### 1. New Admin Tab: "Swaps" in AdminPanelPage
Add a new tab `assisted-swaps` to the existing `TAB_CONFIG` array with a `Repeat` icon. Lazy-load a new `AssistedSwapsAdminPage`.

### 2. New Page: `src/pages/AssistedSwapsAdminPage.tsx`
A simple admin form with:

**Manual Swap Execution Panel:**
- **User Identifier** — input field accepting wallet address, profile ID, or Privy DID (any of the three)
- **Token Mint Address (CA)** — the token to buy/sell
- **Amount** — SOL amount for buy, token amount for sell
- **Buy/Sell toggle** — defaults to Buy
- **Slippage** — defaults to 3000 bps (30%)
- **"Use % of balance"** — quick buttons: 25%, 50%, 75%, 99% that fetch the user's SOL balance via Helius RPC and auto-fill the amount field
- **Execute button** — calls `server-trade` with admin password auth, shows loading state, displays tx signature on success or error message on failure

**Execution Log Panel (below):**
- Shows recent assisted swaps with: timestamp, user wallet, token CA, amount, buy/sell, tx signature (linked to Solscan), status
- Stored in a new `assisted_swaps_log` table for audit trail

### 3. Database: `assisted_swaps_log` table
```sql
create table public.assisted_swaps_log (
  id uuid primary key default gen_random_uuid(),
  user_identifier text not null,
  resolved_wallet text,
  mint_address text not null,
  amount numeric not null,
  is_buy boolean default true,
  slippage_bps int default 3000,
  tx_signature text,
  status text default 'pending',
  error_message text,
  executed_at timestamptz default now(),
  executed_by text default 'admin'
);
alter table public.assisted_swaps_log enable row level security;
-- No public access, service_role only (admin edge function writes)
```

### 4. Wrapper Edge Function: `admin-assisted-swap`
Thin wrapper around `server-trade` logic that:
- Validates admin password from request body
- Optionally fetches user's SOL balance (for % buttons) via Helius RPC
- Calls `server-trade` logic directly (inline, not HTTP)
- Logs result to `assisted_swaps_log`
- Returns result to admin UI

This avoids duplicating the swap logic — it imports the same `privy-server-wallet.ts` helpers and reuses the Meteora swap builder pattern from `server-trade`.

### 5. Balance Lookup: `admin-wallet-balance`  
Small edge function that:
- Accepts `{ walletAddress, adminPassword }`
- Validates admin password
- Calls Helius RPC `getBalance` for SOL
- Returns `{ balanceSol }` for the % buttons

## Flow for Executing a Trade
1. Admin enters wallet address + token CA + amount (or clicks 99%)
2. Clicks "Execute Swap"
3. Frontend calls `admin-assisted-swap` edge function
4. Edge function validates admin password → resolves wallet via DB/Privy → builds tx via Meteora → signs via Privy server wallet → broadcasts
5. Result (signature or error) displayed in UI and logged to `assisted_swaps_log`

## What's Required (Already in Place)
- `PRIVY_APP_ID` — configured
- `PRIVY_APP_SECRET` — configured  
- `PRIVY_AUTHORIZATION_KEY` — configured
- `PRIVY_AUTHORIZATION_KEY_ID` — configured
- `HELIUS_RPC_URL` — configured
- `METEORA_API_URL` — configured
- `privy-server-wallet.ts` shared helper — exists and working

**Nothing additional is needed. All secrets and infrastructure are ready.**

