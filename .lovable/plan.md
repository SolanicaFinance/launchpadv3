

## Fix Sell Toast Content + Reduce Sell Latency

### 1. Enrich the sell success toast

**File: `src/components/launchpad/PulseQuickBuyButton.tsx`**

The `handleSell100` callback has access to both `funToken` and `codexToken` which contain `name`, `ticker`, and `image_url`/`imageUrl`. Update the toast to show:

```
toast.success(`Sold 100% of $TICKER`, {
  description: `${tokenName} · TX: abc123... · 142ms`,
  ...
})
```

Extract token name/ticker/image from whichever source token is available before calling `executeFastSwap`. The sonner toast supports a `description` string — include token name and ticker there alongside the TX signature and latency.

### 2. Reduce sell latency

The 6-second delay comes from multiple sequential bottlenecks:

**A. Dynamic imports in the hot path** (`useSolanaWalletPrivy.ts` lines 68, 74, 96, 105)
- `blockhashCache`, `PublicKey`, `bs58`, `jitoBundle` are all dynamically imported on every transaction
- Move these to static top-level imports — they're already used every time

**B. Jupiter sell flow** (`useJupiterSwap.ts`) does 3 sequential network calls:
1. `GET /quote` — fetch quote
2. `POST /swap` — build transaction  
3. `signAndSendTransaction` — sign + send

These are inherent to Jupiter's API and can't be parallelized. However:
- Use `dynamicSlippage` instead of fixed to avoid quote retries
- Add `asLegacyTransaction: false` to prefer versioned TXs (faster)

**C. Remove `await` on `getCachedBlockhash`** in `useSolanaWalletPrivy.ts` — it's already cached synchronously, the `await` is unnecessary overhead

**D. Serialize before signing** — the Jito parallel submit at line 106 uses the pre-signed `serializedTx` which won't have signatures. This is likely a no-op. Instead, re-serialize after signing or skip.

### Files to modify

1. **`src/hooks/useSolanaWalletPrivy.ts`** — Convert 4 dynamic imports to static top-level imports
2. **`src/components/launchpad/PulseQuickBuyButton.tsx`** — Enrich sell toast with token name, ticker, and latency ms
3. **`src/hooks/useFastSwap.ts`** — Convert dynamic import of DBC SDK to static import at top

### Expected improvement
- Dynamic import elimination: saves ~200-400ms per transaction
- Cached blockhash already working (good)
- Parallel Jito submission already working (good)
- Net improvement: sell should drop from ~6s to ~2-3s (remaining time is Jupiter API + Privy signing which are external)

