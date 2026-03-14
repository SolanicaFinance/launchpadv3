

# Fix: Sell PnL Shows 0 SOL on Quick Sell

## Root Cause (Two bugs)

**Bug 1 — Wrong field name in PulseQuickBuyButton:**
Line 478 references `result.outputAmount` but `executeFastSwap` returns `FastSwapResult` which has `solOut`, not `outputAmount`. So it's always `undefined`.

**Bug 2 — Bonding curve swap returns no `solOut`:**
`swapBondingCurve()` (line 221) returns `{ success, signature, graduated }` with no `solOut` field. Even fixing the field name wouldn't help for bonding-curve tokens since the value is never computed.

The ProfitCardModal then receives `amountSol: 0` and shows "RECEIVED: 0.0000 SOL".

## Fix

### 1. Estimate `solOut` in `swapBondingCurve` (`src/hooks/useFastSwap.ts`)
We already fetch pool reserves (`virtualSolReserves`, `virtualTokenReserves`) before the swap. For sells, estimate output using the constant-product formula:

```
solOut = (amountTokens * virtualSolReserves) / (virtualTokenReserves + amountTokens)
```

Return this as `solOut` in the result object (line 221).

### 2. Fix field reference in `PulseQuickBuyButton.tsx`
Change line 478 from `result.outputAmount` to `result.solOut`.

### 3. Fix same in `PortfolioModal.tsx`
Ensure portfolio sell also uses `result.solOut` for the success popup.

### 4. Fix in `useTurboSwap.ts`
The turbo wrapper also feeds `outputAmount` to the popup — verify it correctly passes `result.solOut` for sells. Currently line 73 does `outputAmount: isBuy ? result.tokensOut : result.solOut` which is correct, but the consuming code may reference wrong fields.

### Files to edit
- `src/hooks/useFastSwap.ts` — Add `solOut` estimate to bonding curve sell return
- `src/components/launchpad/PulseQuickBuyButton.tsx` — Fix `result.outputAmount` → `result.solOut`
- `src/components/portfolio/PortfolioModal.tsx` — Same fix

