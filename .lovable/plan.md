
Root cause confirmed from your exact transaction:
- Client sent `amount: 3,270,256.400753317` to backend record mode.
- On-chain swap sold only `3,270.256400753`.
- This is exactly a `/1000` scaling error.
- Token metadata for SHROOMZY shows `decimals = 9`, while swap code still hardcodes `TOKEN_DECIMALS = 6` in bonding/graduated sell paths.

Implementation plan (urgent fix, then consistency pass):

1) Fix sell amount scaling at swap core (critical)
- Update `src/hooks/useFastSwap.ts`:
  - Remove hardcoded sell-decimal assumption.
  - Resolve token decimals dynamically at sell-time (wallet token account decimals first, pool heuristic fallback).
  - Build `amountIn` using resolved decimals (or exact raw if provided).
  - Also use resolved decimals when converting pool reserves (`virtualTokenReserves`) so record mode values are accurate.

2) Add exact raw-amount sell support for 100% actions
- Extend fast swap API to accept optional raw token amount for sell (`rawAmount` as bigint/string).
- If raw amount is provided, pass it directly to Meteora amountIn (no float conversion).

3) Update Pulse “Sell 100%” (/tokens page path)
- In `src/components/launchpad/PulseQuickBuyButton.tsx`:
  - Replace `uiAmount` summing with raw BigInt summing across all token accounts.
  - Capture decimals from parsed token account data.
  - Call fast swap with exact raw amount + decimals.
  - Keep current UX (flip back to Buy when zero).

4) Apply same fix to Portfolio sell flow
- In `src/components/portfolio/PortfolioModal.tsx`:
  - Use exact raw+decimals balance retrieval before sell.
  - Route through same raw sell path so “Sell 100%” truly clears holdings in one tx.

5) Fix parallel legacy path to prevent same bug elsewhere
- Update `src/hooks/useRealSwap.ts` similarly (dynamic decimals for sell, no hardcoded 6).
- Ensure Jupiter sell path receives correct decimals (and raw override where needed).

Technical details
- Evidence points to decimal mismatch, not only floating dust:
  - Current code: sell raw = `Math.floor(amount * 10^6)`.
  - Token is 9-decimal, so this undershoots by `10^3`.
- Existing BigInt balance fix was good for precision, but incomplete because conversion still assumed 6 decimals in swap execution.
- No DB migration required; this is a transaction scaling fix in client swap logic.

Validation checklist after implementation
1. Re-run Sell 100% on the same wallet/token and verify single-tx near/full clear (no repeated micro sells).
2. Confirm tx token delta matches full wallet token balance (not /1000).
3. Verify both:
   - Pulse Quick Sell on `/tokens`
   - Portfolio modal Sell 100% / Sell All
4. Regression check on any 6-decimal token to confirm compatibility.
