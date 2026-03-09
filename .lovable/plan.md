

# Fix Inaccurate Profile Data: On-Chain Token Holdings

## Problem
1. **"Coins Held" is hardcoded to "—"** — never fetches real data
2. **Active Positions only show trades from `alpha_trades` table** — if a wallet holds tokens but those trades weren't tracked in alpha_trades, they won't appear
3. The wallet `9knrFgvz1Q1QcD8LBLYeLJdhJ6FqE21fEeiiokX5pB7B` has 2 token holdings on Solscan but the profile shows none

## Solution
Fetch **actual on-chain token holdings** for any wallet using Helius RPC, replacing the reliance on internal trade records alone.

### 1. New Edge Function: `fetch-wallet-holdings`
Create `supabase/functions/fetch-wallet-holdings/index.ts` that:
- Takes a `walletAddress` parameter
- Calls Helius `getParsedTokenAccountsByOwner` for both SPL Token and Token-2022 programs
- Returns all token accounts with non-zero balance: mint address, token amount, decimals
- Uses the existing `HELIUS_API_KEY` secret (already configured)

### 2. New Hook: `useWalletHoldings`
Create `src/hooks/useWalletHoldings.ts`:
- Invokes the `fetch-wallet-holdings` edge function
- Returns array of `{ mint: string, balance: number, decimals: number }`
- Enabled only when a wallet address is available
- 30s refetch interval for live data

### 3. Update Profile Page (`UserProfilePage.tsx`)
- Import and call `useWalletHoldings(wallet)`
- Replace hardcoded `"—"` for "COINS HELD" with the actual count of tokens held (non-zero balances)
- Pass holdings data to the Positions tab so it can show real on-chain positions even if alpha_trades has no record

### 4. Update Positions Tab (`ProfileTradingTabs.tsx`)
- Accept `onChainHoldings` as an additional prop
- Merge on-chain holdings with alpha_trades positions:
  - If a position exists in alpha_trades AND on-chain, use alpha data for PnL but on-chain for current balance
  - If a token exists on-chain but NOT in alpha_trades, show it as a position with status "HOLDING" and balance from chain (no PnL data available)
- This ensures all tokens the wallet actually holds appear in the positions list

### Technical Flow
```text
Profile Page
  ├── useUserProfile (existing: alpha_trades, DB data)
  ├── useWalletHoldings (NEW: on-chain token accounts)
  │     └── fetch-wallet-holdings edge function → Helius RPC
  └── Merge & Display
        ├── "Coins Held" = walletHoldings.length
        └── Positions = union(alpha positions, on-chain holdings)
```

### Files
1. `supabase/functions/fetch-wallet-holdings/index.ts` — **new** edge function
2. `src/hooks/useWalletHoldings.ts` — **new** hook
3. `src/pages/UserProfilePage.tsx` — wire up holdings count + pass to tabs
4. `src/components/profile/ProfileTradingTabs.tsx` — merge on-chain holdings into positions display

