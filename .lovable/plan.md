
## Root Cause

The SplitNow API **rejects our quote and order payloads** because the body schema is completely wrong. I read the official TypeScript SDK source (`src/sdk.ts`) and confirmed the actual format.

### What we send (WRONG):
```json
{
  "fromAssetId": "sol",
  "fromNetworkId": "solana",
  "toAssetId": "sol",
  "toNetworkId": "solana",
  "fromAmount": 0.69,
  "type": "fixed_rate"
}
```

### What the API actually expects (from SDK source):
```json
{
  "type": "floating_rate",
  "quoteInput": {
    "fromAmount": 0.69,
    "fromAssetId": "sol",
    "fromNetworkId": "solana"
  },
  "quoteOutputs": [
    {
      "toPctBips": 10000,
      "toAssetId": "sol",
      "toNetworkId": "solana"
    }
  ]
}
```

Same issue with orders -- we send flat fields but the API expects nested `orderInput` / `orderOutputs` with `toPctBips` (not `percentage`), `toAddress` (not `address`), and `toExchangerId`.

### The SDK also reveals:
1. After creating a quote via POST, you must **wait ~1s then GET the quote** to retrieve rates
2. The order body uses `orderInput` / `orderOutputs` nesting, `toPctBips` (basis points, 10000 = 100%), and `toExchangerId` for CEX routing
3. The exchanger IDs are lowercase: `binance`, `kucoin`, `gate`, `bybit` (not display names)

---

## Plan

### 1. Rewrite `splitnow-proxy` edge function quote + order actions

**Quote action** -- restructure body to match SDK:
```typescript
body = {
  type: "floating_rate",
  quoteInput: { fromAmount, fromAssetId, fromNetworkId },
  quoteOutputs: [{ toPctBips: 10000, toAssetId, toNetworkId }]
}
```

Then POST to `/quotes/`, wait 1s, GET `/quotes/{id}` to fetch rates, return combined data.

**Order action** -- restructure body to match SDK:
```typescript
body = {
  type: "floating_rate",
  quoteId,
  orderInput: { fromAmount, fromAssetId, fromNetworkId },
  orderOutputs: walletDistributions  // already formatted by client
}
```

Then POST to `/orders/`, wait 1s, GET `/orders/{shortId}` to get deposit details.

### 2. Update `useDevWalletRotation.ts` hook

- Fix CEX IDs from display names to API IDs: `["binance", "kucoin", "gate", "bybit"]`
- Format `walletDistributions` to match SDK: use `toAddress`, `toPctBips: 10000`, `toExchangerId`
- Pass the selected exchanger ID through to the order call
- Remove the `type: "fixed_rate"` override (SDK uses `floating_rate`)
- Parse response fields correctly: `quoteId` from POST response, `depositWalletAddress` and `orderInput.fromAmount` from GET order response

### 3. Keep the direct-transfer fallback

The existing try/catch fallback for when SplitNow rejects a route stays in place as a safety net.

---

### Technical Details

**Files to change:**
- `supabase/functions/splitnow-proxy/index.ts` -- quote and order body restructuring + 2-step create-then-fetch pattern
- `src/hooks/useDevWalletRotation.ts` -- CEX IDs, wallet distribution format, response field mapping
