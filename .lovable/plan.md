

## Problem

When clicking "Sell 100%", the system sells based on the **database balance** (`token_holdings.balance`), which is often stale — especially right after a buy. The on-chain token account has the real amount, but the DB hasn't caught up yet. This is why you're selling "pennies" instead of the full position.

## Root Cause

```
userBalance = userHoldings?.find(h => h.token_id === token?.id)?.balance || 0
// ↑ This is the DB value, NOT the on-chain balance
```

The `getTokenBalance()` function in both wallet hooks literally returns `0` — it was never implemented:
```ts
const getTokenBalance = async (_mintAddress: string): Promise<number> => {
  // Token balances tracked in database for bonding curve tokens
  return 0;
};
```

## Fix

### 1. Implement real on-chain `getTokenBalance` in `useSolanaWalletPrivy.ts`

Use `connection.getTokenAccountsByOwner()` with the mint address to fetch the actual SPL token balance from chain. This is a single RPC call.

```ts
const getTokenBalance = async (mintAddress: string): Promise<number> => {
  const connection = getConnection();
  const owner = new PublicKey(walletAddress);
  const mint = new PublicKey(mintAddress);
  const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
  if (accounts.value.length === 0) return 0;
  // Parse the SPL token account data to get the balance
  const balance = /* decode account data */;
  return balance / 10 ** TOKEN_DECIMALS;
};
```

### 2. Update `QuickTradeButtons` sell flow to use on-chain balance

Before executing a sell, fetch the real on-chain token balance for the mint address. For 100% sells, use this on-chain amount instead of the stale `userBalance` prop.

Changes:
- Import and call `getTokenBalance(token.mint_address)` from the wallet hook before selling
- Use the on-chain balance for the sell amount calculation, falling back to `userBalance` if the RPC call fails
- Log both values for debugging: `[QuickSell] DB balance: X, On-chain balance: Y`

### 3. Also fix `useFastSwap.ts` sell amount (same issue)

The fast swap path also receives the DB-sourced amount. The fix at the QuickTradeButtons level ensures the correct amount is passed downstream.

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useSolanaWalletPrivy.ts` | Implement real `getTokenBalance()` using SPL token account query |
| `src/components/launchpad/QuickTradeButtons.tsx` | Fetch on-chain balance before sell, use it for amount calculation |

