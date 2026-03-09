

## Problem

The `codex-filter-tokens` edge function requests `imageSmallUrl`, `imageThumbUrl`, `imageLargeUrl` from the Codex `filterTokens` query. For very new pump.fun tokens, these fields often return `null` even though the image exists. The detail page works because `codex-token-info` uses a different Codex query (`getTokenInfo`) that returns the image URL successfully.

## Root Cause

Line 156 of `codex-filter-tokens/index.ts`:
```typescript
let imageUrl = r.token?.info?.imageSmallUrl || r.token?.info?.imageThumbUrl || r.token?.info?.imageLargeUrl || null;
```
When all three are null (common for tokens < 5min old), no fallback exists for Solana tokens. BSC already has a Trust Wallet CDN fallback (line 159-162), but Solana has none.

## Plan

### 1. Add Solana image fallback in `codex-filter-tokens/index.ts`

After line 162, add a Solana fallback using DexScreener's token image CDN which reliably serves pump.fun images:

```typescript
if (!imageUrl && address && safeNetworkId === SOLANA_NETWORK_ID) {
  imageUrl = `https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png`;
}
```

### 2. Add fallback cascade in `OptimizedTokenImage.tsx`

Add a `fallbackSrc` prop so when the primary image errors, it tries the fallback URL before showing the text placeholder:

- On first `onError`: try `fallbackSrc` if provided
- On second `onError`: show text fallback

### 3. Pass fallback in `AxiomTokenRow.tsx` and `CodexPairRow.tsx`

When rendering `OptimizedTokenImage`, pass a DexScreener fallback URL constructed from the token address.

### Files to modify
- `supabase/functions/codex-filter-tokens/index.ts` — add Solana image fallback
- `src/components/ui/OptimizedTokenImage.tsx` — add `fallbackSrc` prop with error cascade
- `src/components/launchpad/AxiomTokenRow.tsx` — pass `fallbackSrc`
- `src/components/launchpad/CodexPairRow.tsx` — pass `fallbackSrc`

