

## Fix: PnL Data Missing for Most Holders

### Root Cause

Two bugs causing PnL to show for only a few "random" holders:

1. **Only 50 trades fetched** — `useCodexTokenEvents` fetches a single page of 50 trades. A token with 548 holders has thousands of trades. Most holders simply don't appear in the latest 50. This is the primary cause.

2. **Case-sensitive address corruption** — `buildHolderStatsMap` uses `.toLowerCase()` on Solana base58 addresses. Base58 is case-sensitive (`A` ≠ `a`), so lowercasing corrupts the addresses and causes random match/miss depending on whether the address happens to be all-lowercase already.

### Plan

#### 1. New hook: `src/hooks/useAllTokenTrades.ts`
- Create a dedicated hook that **paginates through ALL Codex trade events** (not just 50)
- Loop: fetch page → collect events → use cursor → repeat until cursor is null or max 2000 events
- Only enabled when holders tab is active (to avoid unnecessary API calls)
- `staleTime: 30_000`, no auto-refetch polling (heavy query)

#### 2. Update edge function `codex-token-events` 
- No changes needed — it already supports `cursor` param and up to `limit: 100`

#### 3. Fix `src/components/launchpad/HoldersTable.tsx`
- **Remove all `.toLowerCase()` calls** from `buildHolderStatsMap` and the lookup comparisons — Solana addresses must be compared as-is (base58 is case-sensitive)

#### 4. Update `src/components/launchpad/TokenDataTabs.tsx`
- When holders tab is active, use the new `useAllTokenTrades` hook instead of the regular 50-event `data?.events`
- Pass the full paginated trade list to `HoldersTable`
- Show a loading indicator while paginating through all trades

