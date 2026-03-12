
Goal: make BNB quick-buy work for early launchpad tokens in “New Pairs” (not only DEX-listed tokens), so users can buy bonding-stage tokens instead of always failing on OpenOcean.

1) Root-cause confirmed
- `bnb-swap` currently treats most non-local tokens as “graduated” and routes to OpenOcean.
- Early bonding tokens from `Four.meme` / `Moonit` in New Pairs are often not on DEX yet, so OpenOcean returns `No avail liquidity for the pair`.
- `BNB_PORTAL_ADDRESS` is not present in secrets, so local portal fallback is effectively bypassed and defaults to OpenOcean.
- Error handling still leaks into 500 in some paths instead of consistently returning actionable 4xx.

2) Implementation design (backend-first, minimal UI breakage)
- Refactor `supabase/functions/bnb-swap/index.ts` into explicit route resolver:
  - Route A: SaturnPortal (local bonding tokens)
  - Route B: Four.meme bonding route (pre-migration)
  - Route C: Moonit bonding route (pre-migration)
  - Route D: OpenOcean (migrated / DEX-routable)
- Add a `resolveBnbTokenRoute(tokenAddress)` helper:
  - Query token launchpad/migration state (Codex metadata + onchain checks).
  - Use deterministic priority:
    1) If token belongs to Saturn portal and `graduated=false` → SaturnPortal
    2) If launchpad is Four.meme and not migrated → Four.meme contract
    3) If launchpad is Moonit and not migrated → Moonit trade path
    4) Else → OpenOcean
- Add fallback portal address constant (same canonical address used in BNB create-token flow) when `BNB_PORTAL_ADDRESS` secret is missing, so local bonding buys don’t silently downgrade to OpenOcean.

3) Launchpad adapters to add
- Four.meme adapter in `bnb-swap`:
  - Use TokenManager contract (`buyTokenAMAP`, `sellToken`) for pre-migration trading.
  - Use Privy EVM server signing (`evmSendTransaction`) so flow stays 1-click/non-custodial.
  - Keep current approval logic for sells where required.
- Moonit adapter in `bnb-swap`:
  - Build/simulate tx via Moonit EVM SDK or direct contract call path.
  - Submit tx through Privy EVM RPC just like other routes.
- Keep OpenOcean route for migrated tokens and external DEX liquidity.

4) Reliability + UX hardening
- Normalize “no liquidity” detection in one helper (`isNoLiquidityError`) that checks:
  - HTTP status + body text + JSON error fields (case-insensitive).
- Return structured 400 responses with clear reason + route attempted:
  - `route: "openocean" | "fourmeme" | "moonit" | "portal"`
  - `reason: "NO_DEX_LIQUIDITY" | "UNSUPPORTED_LAUNCHPAD" | ...`
- Update UI toast copy in:
  - `src/hooks/useBnbSwap.ts`
  - `src/components/launchpad/PulseQuickBuyButton.tsx`
  - `src/components/launchpad/BnbTradePanel.tsx`
  so users see route-specific failures and retry guidance (instead of generic 500-style errors).

5) Validation plan (end-to-end)
- Case 1: Four.meme early token (not migrated): buy succeeds via Four.meme route.
- Case 2: Moonit early token (not migrated): buy succeeds via Moonit route.
- Case 3: Migrated token: buy succeeds via OpenOcean.
- Case 4: Local Saturn bonding token: buy succeeds via portal even without secret set.
- Case 5: Truly untradable token: returns clean 400 + informative message (no crash/500).
- Confirm alpha trade recording still works and route label is saved in logs for debugging.

Technical notes
- Files to update:
  - `supabase/functions/bnb-swap/index.ts` (main routing + adapters + error normalization)
  - optionally shared helper in `supabase/functions/_shared/` for launchpad route resolution
  - `src/hooks/useBnbSwap.ts` and BNB trade UI components for improved error handling/messages
- No database migration required for this fix.
- Existing auth model remains unchanged (Privy user wallet execution).
