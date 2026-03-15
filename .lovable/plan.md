

# Hyperliquid Leverage Trading: Full Integration Plan

## Current State

**Already built (Hyperliquid):**
- `src/lib/hyperliquid.ts` — Full API client with EIP-712 signing types, order/cancel/withdraw builders, bridge addresses
- `useHyperliquidAccount.ts` — Account state, positions, open orders, trade history via user's EVM wallet address
- `useHyperliquidMarkets.ts` — All perp markets with prices, funding, OI
- `useHyperliquidKlines.ts` — Candlestick chart data
- `useHyperliquidOrderbook.ts` — Real-time L2 orderbook
- `usePrivyEvmWallet.ts` — Privy embedded EVM wallet (auto-creates on auth)
- `LeverageTerminal.tsx` — Full terminal UI (chart, orderbook, trade panel, positions)
- `LeverageTradePanel.tsx` — Long/Short, Market/Limit, leverage slider, size input

**What's broken / incomplete:**
1. **EIP-712 signing not wired** — `placeOrder` and `cancelOrder` in `useHyperliquidAccount` return `{ action, nonce }` but never actually sign via the wallet or call `hlExchange()`. Orders cannot execute.
2. **No deposit flow** — Users need to deposit USDC on Arbitrum to Hyperliquid's bridge contract before trading. No UI for this.
3. **No withdraw flow** — `buildWithdrawAction` exists but isn't exposed in UI.
4. **Leverage change not implemented** — `changeLeverage` is a no-op stub.
5. **Quick size % buttons don't work** — They have no `onClick` handlers.

**Aster (to remove):**
- `src/hooks/useAsterAccount.ts`, `useAsterKlines.ts`, `useAsterMarkets.ts`, `useAsterOrderbook.ts`
- `src/components/leverage/AsterApiKeyModal.tsx`
- `supabase/functions/aster-trade/` (edge function)

---

## Plan

### 1. Remove all Aster code
- Delete `useAsterAccount.ts`, `useAsterKlines.ts`, `useAsterMarkets.ts`, `useAsterOrderbook.ts`
- Delete `AsterApiKeyModal.tsx`
- Delete `supabase/functions/aster-trade/index.ts`
- Remove any remaining imports referencing Aster

### 2. Wire EIP-712 signing for orders and cancels
Update `useHyperliquidAccount.ts` to actually sign and submit:
- Use Privy's `wallet.getEthereumProvider()` to get the EIP-712 signer
- Sign the order action with `eth_signTypedData_v4` using HL_DOMAIN and the appropriate types
- Call `hlExchange(action, nonce, signature)` to submit
- Same for cancel orders
- Implement `updateLeverage` action (Hyperliquid supports this as an exchange action)

### 3. Add USDC deposit flow (Arbitrum → Hyperliquid)
- Create a `LeverageDepositPanel.tsx` component with:
  - Input for USDC amount
  - "Deposit" button that sends USDC to HL bridge contract (`0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7`) on Arbitrum
  - Uses ERC-20 `approve` + `transfer` pattern via the Privy EVM wallet
  - Shows current Arbitrum USDC balance
- Add a deposit/withdraw tab to the trade panel or as a modal accessible from the positions area

### 4. Add USDC withdraw flow (Hyperliquid → Arbitrum)
- Build withdraw UI in the same deposit panel
- Sign the `withdraw3` action via EIP-712 using existing `buildWithdrawAction` and `WITHDRAW_TYPES`
- Submit to `hlExchange`

### 5. Fix trade panel completeness
- Wire the quick size % buttons to calculate from available balance
- Auto-refresh account after order placement/cancellation
- Show proper error toasts on failed orders
- Display wallet balance in the trade panel header

### 6. Wallet requirements
- **EVM wallet (Arbitrum)**: Already handled by `usePrivyEvmWallet` — Privy auto-creates an embedded EVM wallet on signup
- **No external wallet needed**: The Privy embedded wallet works on Arbitrum for both deposits and EIP-712 signing
- Wagmi config already includes Arbitrum chain with RPC

---

## Technical Details

**EIP-712 Signing Flow (orders):**
```text
User clicks "Long BTC" 
  → buildOrderAction(wireOrders) 
  → eth_signTypedData_v4(HL_DOMAIN, ORDER_TYPES, action) via Privy wallet
  → hlExchange(action, nonce, { r, s, v })
  → Refresh account + orders
```

**Deposit Flow:**
```text
User enters USDC amount
  → approve(HL_BRIDGE_ADDRESS, amount) on ARBITRUM_USDC contract
  → transfer USDC to bridge (or call bridge deposit function)
  → Poll hlUserState until balance reflects
```

**Files to create:**
- `src/components/leverage/LeverageDepositModal.tsx`

**Files to modify:**
- `src/hooks/useHyperliquidAccount.ts` (wire signing + leverage + withdraw)
- `src/components/leverage/LeverageTradePanel.tsx` (% buttons, balance display, deposit access)
- `src/components/leverage/LeveragePositions.tsx` (withdraw button)
- `src/components/leverage/LeverageTerminal.tsx` (deposit modal integration)

**Files to delete:**
- `src/hooks/useAsterAccount.ts`
- `src/hooks/useAsterKlines.ts`
- `src/hooks/useAsterMarkets.ts`
- `src/hooks/useAsterOrderbook.ts`
- `src/components/leverage/AsterApiKeyModal.tsx`
- `supabase/functions/aster-trade/index.ts`

