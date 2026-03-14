

# Plan: Fix "Sell 100%" Leaving Dust Behind

## Root Cause

The sell flow converts between floating-point and raw integers, causing precision loss:

1. **Balance fetch** reads `uiAmount` (float, e.g. `15234.123456`)
2. **Swap execution** converts back: `Math.floor(15234.123456 * 1_000_000)` 
3. Floating-point math can produce `15234123455` instead of `15234123456` → **1 raw unit left behind**

This is why "Sell 100%" sells *almost* everything but leaves dust.

## Fix

Two changes needed:

### 1. `PulseQuickBuyButton.tsx` — Fetch raw balance alongside UI balance
In `handleSell100`, change the balance fetch to also sum the **raw** `tokenAmount.amount` (string, no float loss). Pass a new flag or raw amount to the swap function so it can use the exact on-chain value.

Simplest approach: sum the raw amounts as integers, then pass `rawAmount / 10^decimals` using integer division to avoid float errors. OR pass the raw lamport amount separately.

### 2. `useFastSwap.ts` — Accept optional raw amount for exact sells
In `swapBondingCurve`, when selling, if a raw amount (in smallest units) is provided, use it directly as `amountIn` instead of doing `Math.floor(amount * 10^TOKEN_DECIMALS)`.

Alternatively (simpler, less invasive): In `PulseQuickBuyButton.handleSell100`, compute the raw sum from `tokenAmount.amount` strings, and pass `rawSum / 10^6` as the amount — but use a BigInt-safe division to avoid float. Since the pipeline only accepts a `number`, we can just do:

```typescript
// Sum raw amounts (integers, no precision loss)
const rawTotal = resp.value.reduce((sum, acc) => {
  const raw = acc.account?.data?.parsed?.info?.tokenAmount?.amount;
  return sum + BigInt(raw || '0');
}, BigInt(0));
const decimals = resp.value[0]?.account?.data?.parsed?.info?.tokenAmount?.decimals ?? 6;
// Convert back to number with no precision loss for amounts < 2^53
freshBalance = Number(rawTotal) / (10 ** decimals);
```

This ensures the raw integer is preserved and `Math.floor(freshBalance * 10^6)` reconstructs the exact original value.

### Files to edit
- `src/components/launchpad/PulseQuickBuyButton.tsx` — Fix balance computation in `handleSell100` (lines 436-446)
- `src/components/portfolio/PortfolioModal.tsx` — Same fix for portfolio sell
- `src/hooks/useSolanaWalletPrivy.ts` — Fix `getTokenBalance` to use raw amounts (fixes all consumers)

