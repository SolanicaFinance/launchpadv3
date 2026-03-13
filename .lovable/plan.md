
## Problem

The BNB swap fails because **Privy's server-side wallet API expects `gas_limit` not `gas`** in the transaction object. The logs confirm:

```
Four.meme reverted, falling back to PancakeSwap: Privy eth_sendTransaction failed (400): 
{"error":"[Input error] `params.transaction`: Unrecognized k..."}
```

The "Unrecognized key" is `gas`. Privy API docs explicitly list `gas_limit` as the accepted field name. Every `evmSendTransaction` call using `gas: numberToHex(...)` is rejected by Privy before even reaching the chain.

The route resolver **correctly identifies** Four.meme tokens. The Four.meme contract call is correct. It just never executes because of this field name mismatch.

## Fix

**File: `supabase/functions/_shared/privy-server-wallet.ts`**

In the `evmSendTransaction` function (line ~284), rename the `gas` field in `txParams` to `gas_limit` before sending to Privy:

- Change the interface from `gas?: string` to `gas_limit?: string`

**File: `supabase/functions/bnb-swap/index.ts`**

Replace all `gas: numberToHex(...)` with `gas_limit: numberToHex(...)` in:
- `executePancakeSwapBuy` (line 221) 
- `executePancakeSwapSell` (line 293)
- `executeFourMemeBuy` (line 315)

This is the only change needed. The routing logic, Four.meme contract ABIs, and fallback chains are all correct — they just never execute because Privy rejects the malformed transaction.
