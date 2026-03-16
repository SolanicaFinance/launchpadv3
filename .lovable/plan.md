

## Root Cause (confirmed from SDK source code at unpkg.com/splitnow@1.0.1)

The SplitNow API wraps POST responses in a `{ success: true, data: <value> }` envelope. Our edge function ignores this and reads `createData.quoteId` which is `undefined`, causing the subsequent GET to fail with `Cast to ObjectId failed for value "undefined"`.

The 422 error the user keeps seeing is likely from a stale/cached edge function deployment still sending the old flat format. The current code in the repo IS using the nested format but the response parsing is broken.

### SDK source reveals (lines 130-168):
```text
POST /quotes/  → { success: true, data: "quote-id-string" }
POST /orders/  → { success: true, data: { shortId: "xxx" } }
GET  /quotes/  → { success: true, data: { quoteLegs: [...] } }
GET  /orders/  → { success: true, data: { shortId, depositWalletAddress, orderInput, status, statusText } }
```

Our edge function reads `createData.quoteId` instead of `createData.data` (the unwrapped ID).

---

## Plan

### 1. Rewrite `splitnow-proxy` edge function response handling

Fix the response envelope unwrapping for all POST and GET calls to `/quotes/` and `/orders/`:

- **Quote POST**: Extract `quoteId = createData.data` (it's a string ID)
- **Quote GET**: Extract `getData.data` to get the actual quote object
- **Order POST**: Extract `shortId = createData.data.shortId`
- **Order GET**: Extract `getData.data` to get order details
- **Status GET**: Extract `data.data` with `status`, `statusShort`, `statusText` fields
- Add a `limits` check before order creation matching the SDK's min deposit validation

### 2. Add manual CEX selection to the rotation modal

Per user preference, replace auto-random CEX selection with a picker:

- Fetch available exchangers from the API on modal open
- Show a grid/list of CEX options (Binance, KuCoin, Gate, Bybit) with logos
- User selects one before starting rotation
- Pass selected CEX through to the order step

### 3. Update `useDevWalletRotation.ts` hook

- Accept `selectedCex` as a parameter to `startRotation()` instead of randomizing
- Fix response field mapping to match SDK: `depositWalletAddress`, `orderInput.fromAmount`
- Fix status polling to use `status`, `statusShort`, `statusText` fields
- Add min deposit validation (0.05 SOL for Solana)
- Keep the direct-transfer fallback as safety net

### Files to change:
- `supabase/functions/splitnow-proxy/index.ts` -- response envelope unwrapping
- `src/hooks/useDevWalletRotation.ts` -- accept CEX param, fix field mapping, add min deposit check
- `src/components/launchpad/DevWalletRotationModal.tsx` -- add CEX selection step before starting

