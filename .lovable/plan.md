

## The Real Problem: Why Your Swaps Are Slow

**Axiom does NOT have a public API.** It's a closed trading terminal. The "axiomtradeapi" Python package and GitHub repos are unofficial community tools — they don't give you Axiom's speed.

### What makes Axiom fast (and why you're slow)

Axiom's speed comes from **infrastructure**, not an API:

| Factor | Axiom | Saturn (Current) |
|---|---|---|
| **Wallet signing** | Controls keys directly (~0ms) | Privy API round-trip (~500-2000ms) |
| **RPC** | Custom validator connections | Helius shared RPC (~200-400ms) |
| **Tx building** | Pre-built, server-side | Client builds → sends to Privy → Privy sends to chain |
| **Submission** | Direct to top validators | Jito endpoints (good, but after slow signing) |

**Your #1 bottleneck is Privy embedded wallet signing.** Every trade goes:

```text
Current flow (slow):
User clicks Buy → Client builds tx → Client sends to Privy API → Privy signs → Privy sends to RPC → Done
                   ~200ms              ~800-2000ms                ~200ms        ~400ms
                   Total: 1600-3000ms

Axiom flow (fast):
User clicks Buy → Server builds tx → Server signs (local key) → Blast to validators
                   ~50ms              ~1ms                        ~200ms
                   Total: ~250ms
```

### The Fix: Full Server-Side Execution Pipeline

You already have `server-trade` edge function + `privy-server-wallet.ts` that can sign server-side. But the current `useFastSwap` hook **doesn't use it** — it signs client-side via Privy's React SDK, which is the slow path.

---

## Plan: Turbo Trade Mode (Server-Side Execution)

### Phase 1: Server-Side Fast Trade Edge Function

Create a new `turbo-trade` edge function that does everything in one server round-trip:

1. Receives: `{ mintAddress, amount, isBuy, privyUserId, slippageBps }`
2. Resolves wallet from cached profile (skip Privy lookup if `privy_wallet_id` is cached)
3. Builds swap transaction server-side:
   - Bonding curve tokens: Use Meteora DBC SDK (install in edge function)
   - Graduated tokens: Fetch Jupiter quote + swap tx
4. Signs via Privy server wallet API (`signTransaction` — sign only, don't let Privy send)
5. Broadcasts signed tx in parallel to: all 5 Jito endpoints + Helius RPC
6. Returns signature immediately (optimistic)
7. Records trade in DB (non-blocking)

**Key difference from current `server-trade`**: Current one calls an external Meteora API to build the tx, then Privy `signAndSendTransaction` (Privy sends to their own RPC). New one builds tx directly + signs only + we control broadcast to fastest endpoints.

### Phase 2: Client-Side `useTurboSwap` Hook

New hook that replaces `useFastSwap` for maximum speed:

1. Single `supabase.functions.invoke('turbo-trade', ...)` call
2. No client-side tx building, no client-side signing
3. Optimistic UI — show success toast immediately on response
4. Background query invalidation after 500ms

### Phase 3: Parallel Jito Broadcast from Edge Function

The edge function broadcasts the signed tx to all endpoints simultaneously:
- 5 Jito block engine regions
- Helius RPC (with `skipPreflight: true`)
- All fire-and-forget, return first signature

### Phase 4: Cached Wallet Resolution

Store `privy_wallet_id` in profiles table (already exists). On first trade, fetch from Privy API and cache. Subsequent trades skip the Privy user lookup entirely (~200ms saved).

---

## Expected Latency Improvement

```text
Current:  Client build (~200ms) + Privy sign (~1000ms) + Privy send (~400ms) = ~1600ms
Turbo:    Edge function invoke (~100ms) + Build tx (~50ms) + Privy sign-only (~300ms) + Parallel broadcast (~100ms) = ~550ms
```

~3x faster. Still not Axiom-level (they have ~250ms because they hold keys locally), but significantly faster than current.

---

## Files to Create/Modify

1. **Create** `supabase/functions/turbo-trade/index.ts` — all-in-one server-side trade function
2. **Create** `src/hooks/useTurboSwap.ts` — minimal client hook calling turbo-trade
3. **Modify** trade panel components to use `useTurboSwap` instead of `useFastSwap`
4. **Database**: No schema changes needed (profiles already has `privy_wallet_id`)

## Technical Notes

- The Meteora DBC SDK needs to run in the edge function (Deno). Will use `npm:@meteora-ag/dynamic-bonding-curve-sdk` import.
- Jupiter swap API is HTTP-based, works perfectly from edge functions.
- Privy `signTransaction` (sign-only) is faster than `signAndSendTransaction` because we skip Privy's RPC submission and control broadcast ourselves.
- Jito tip instruction should be added server-side for priority inclusion.

