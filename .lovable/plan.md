

## Plan: Bypass Turbo-Trade, Use Direct Client-Side Jupiter Swaps

### Problem
The `turbo-trade` edge function uses Privy server-side wallet signing which is broken (persistent 401 authorization error). Every swap attempt hits the server first, wastes ~700ms on a failing call, then falls back to client-side. The user wants to eliminate turbo entirely and use the working Jupiter client-side path directly.

### Changes

**1. `src/hooks/useTurboSwap.ts`** — Remove the `turbo-trade` edge function call entirely. The `executeTurboSwap` function will directly delegate to `executeFastSwap` (which uses client-side Jupiter via `useJupiterSwap` + Privy embedded wallet signing). This eliminates the ~700ms wasted roundtrip to the failing server.

**2. Speed improvement** — Since `executeFastSwap` in `useFastSwap.ts` already has all the optimizations (cached blockhash, parallel Jito broadcast, optimistic UI, cached DBC client), swaps will execute at full speed without the server detour.

### What stays the same
- All 4 callers (`PulseQuickBuyButton`, `PortfolioPage`, `PortfolioModal`, `UniversalTradePanel`) use `useTurboSwap` — they don't need changes since the hook interface stays identical.
- `useFastSwap.ts`, `useJupiterSwap.ts`, `useSolanaWalletPrivy.ts` — unchanged, these are the working client-side swap path.
- The `turbo-trade` edge function remains deployed but unused (can be cleaned up later).

### Result
- Zero wasted server calls
- Direct client-side execution: Jupiter quote → Jupiter swap tx → Privy embedded wallet sign → broadcast
- Same speed as before turbo was introduced (~1-2s vs 3s+ with failing turbo)

