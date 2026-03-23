
Goal: fix Four.meme bonding swaps properly, not just reshuffle the same fallback error, and make BNB buy/sell/history behave like the more advanced trade systems.

What I found from the current code and logs:
- The wallet resolution is working. The logs show the correct embedded wallet is being found.
- Route detection is partly working. The function detects the token as a Four.meme bonding token:
  - `Route: Four.meme (bonding curve, manager: 0x5c9520...)`
- The actual failure is here:
  - `Executing via Four.meme: buy`
  - `Four.meme reverted, falling back to PancakeSwap: Four.meme quote failed: no buy output available`
  - then PancakeSwap quote reverts too, which is expected if the token is still bonding and not migrated yet.
- So the real bug is not “there is no liquidity”; it is that the current Four.meme quote/execution path is wrong or outdated for the token state/contract flow we are hitting.

Plan

1. Replace the brittle Four.meme quote logic with the current verified on-chain flow
- Re-audit `bnb-swap` against current Four.meme contract behavior instead of relying on the current `tryBuy(..., 0n, bnbAmount)` assumption.
- Verify the exact helper/manager function signatures and how `fundRequirement`, `fundAsParameter`, and `minAmount` are supposed to be derived for live bonding tokens.
- Update both buy and sell execution paths to use the actual contract pattern Four.meme expects now.

2. Stop masking the real failure as “NO_LIQUIDITY”
- Add explicit classification for:
  - bonding token quote failure
  - migrated token on PancakeSwap
  - unsupported token / invalid token manager
  - contract revert / tax / min-out failure
- If Four.meme is detected but quote/build fails, return the raw categorized reason instead of the generic no-liquidity message.
- Keep PancakeSwap fallback only for genuinely migrated tokens or verified DEX pairs.

3. Add preflight simulation before sending the Privy transaction
- For Four.meme buys/sells, run an `eth_call`/contract simulation with the exact calldata/value first.
- If simulation fails, surface the revert reason and do not attempt the Privy send.
- This prevents the current loop where the app “tries Four.meme”, silently fails, then throws the same fallback message.

4. Make route resolution more reliable
- Separate:
  - “token exists on Four.meme bonding”
  - “token migrated from Four.meme to PancakeSwap”
  - “token only tradable on PancakeSwap”
- Do not depend on one reverting `liquidityAdded` check to decide everything.
- Add a secondary migration/pair existence check so we only route to PancakeSwap when a real pair exists.

5. Bring BNB trade recording/history up to the advanced standard
- Ensure every successful BNB buy/sell saves:
  - BNB tx hash
  - route used (`fourmeme` / `pancakeswap` / `portal`)
  - token amount / native amount
  - wallet
  - explorer URL
  - execution status / timestamps
- Extend the client trade history UI so the user sees these references immediately after success and later in history.
- Keep the data model flexible so extra proof/reference hashes can be shown the same way as the BTC/SOL flows where applicable.

6. Improve debugging visibility
- Add structured logs around:
  - detected route
  - quote result
  - generated calldata target/function
  - simulation result
  - Privy send result
- This makes future failures debuggable in minutes instead of repeating the same generic 400.

7. Verification after implementation
- Test a known Four.meme bonding token buy.
- Test a known migrated token buy on PancakeSwap.
- Test Four.meme sell on a bonded token.
- Verify the success payload reaches the client and history shows the saved transaction data.
- Verify the user no longer sees the fake “No liquidity” message when the real problem is contract-path failure.

Technical details
- Files most likely involved:
  - `supabase/functions/bnb-swap/index.ts`
  - `supabase/functions/_shared/privy-server-wallet.ts` (only if send payload needs adjustment, but current evidence says wallet signing is not the main blocker)
  - BNB history/success UI components around the trade panel and trade-history display
- Current root cause from logs:
  - Four.meme token detected correctly
  - current Four.meme quote method returns zero / invalid output
  - PancakeSwap fallback then correctly fails because pair is not live yet
- In short: the integration is failing because the app is not using the correct current Four.meme trade path, not because Privy embedded wallets fundamentally cannot trade it.

Expected result after implementation
- Bonding tokens trade through Four.meme correctly.
- Migrated tokens trade through PancakeSwap correctly.
- Errors become specific and actionable instead of the same misleading 400.
- Successful BNB trades are saved and shown in trade history with the same “advanced system” level of visibility you asked for.
