

# Fix Bogus change24h Values for BNB Tokens

## Problem

The Codex API returns wildly inflated `change24h` values for certain BSC tokens — values like **+2,650,644,394%** and **+10,019,497,926%**. These are clearly overflow/sentinel values from the API (similar to the existing `marketCap > 1e15` issue). No real token gains 10 billion percent in 24 hours. These bogus numbers appear prominently on the homepage hero section.

Additionally, the homepage `PulseTokenRow` component uses raw `change.toFixed(1)` instead of the centralized `formatChange24h` formatter.

## Changes

### 1. Edge function: Cap/clamp absurd change24h values (`supabase/functions/codex-filter-tokens/index.ts`)

In the existing filter block (line 191-195), add a sanitization step to clamp `change24h` values that exceed a reasonable threshold. Any `change24h` with an absolute value greater than **100,000%** (1000x) will be clamped to 0, treating it as unreliable data. This mirrors the existing `marketCap > 1e15` sentinel filter.

```typescript
.filter((t: any) => {
  if (t.marketCap > 1e15) return false;
  // Clamp absurd change24h values (overflow/sentinel from Codex)
  if (Math.abs(t.change24h) > 100000) t.change24h = 0;
  return true;
});
```

### 2. Homepage: Use `formatChange24h` instead of raw `.toFixed(1)` (`src/pages/HomePage.tsx`)

Line 69 currently displays `{change.toFixed(1)}%` — replace with `formatChange24h(change)` from `@/lib/formatters` for consistency and to handle any edge cases that slip through.

### Files Modified
- `supabase/functions/codex-filter-tokens/index.ts` — sanitize absurd change24h at the data layer
- `src/pages/HomePage.tsx` — use `formatChange24h` formatter

