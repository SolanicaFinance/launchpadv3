

## Plan: Fix Button Not Switching to "Sell All" After Buy

### Root Cause
The optimistic `setQueryData(["quick-sell-balance", ...], 1)` is immediately followed by `invalidateQueries` on the same key. This triggers an instant refetch that hits the chain before the balance has settled, returning `0` and overwriting the optimistic value. The button never visually flips.

### Fix

**`src/components/launchpad/PulseQuickBuyButton.tsx`** — 3 changes:

1. **Remove the immediate `invalidateQueries`** after the optimistic `setQueryData` in both the `handleTriggerClick` (line 312) and `handleBuy` (line 360) success paths. The optimistic value of `1` will persist until `staleTime` expires.

2. **Delay the refetch** — replace the removed `invalidateQueries` with a `setTimeout` that invalidates after ~8 seconds, giving the chain time to settle:
   ```ts
   queryClient.setQueryData(["quick-sell-balance", walletAddress, mintAddress], 1);
   setTimeout(() => {
     queryClient.invalidateQueries({ queryKey: ["quick-sell-balance", walletAddress, mintAddress] });
   }, 8000);
   ```

3. **Same pattern for sell** (line 411) — keep `setQueryData(..., 0)` but delay the invalidation by 8s.

### Result
After a buy, button instantly flips to "Sell 100%". The real on-chain balance is fetched 8s later to confirm. No other files changed.

