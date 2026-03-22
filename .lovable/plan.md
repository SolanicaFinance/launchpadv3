

# Bitcoin Mode: Separate Auth System (No Privy)

## The Problem

The current plan routes Bitcoin Mode pages through the same Privy-gated auth flow used for Solana/BNB. But Bitcoin Mode uses a completely different wallet system — **UniSat/Xverse browser extensions** — and should never trigger Privy login.

## The Fix

Bitcoin Mode pages (`/btc`, `/btc/launch`, `/btc/token/:id`) will use their own auth context based on the `useBtcWallet` hook, completely independent of Privy.

### Architecture

```text
Solana / BNB Mode          Bitcoin Mode
─────────────────          ────────────────
Privy login flow           UniSat/Xverse connect
useAuth() hook             useBtcWallet() hook
NotLoggedInModal           BtcConnectWalletModal
Privy embedded wallet      Browser extension wallet
profiles table (UUID)      btc_tokens.creator_wallet
```

### Key Changes to the Plan

1. **`useBtcWallet.ts` hook becomes the auth gate for BTC pages** — exposes `isConnected`, `address`, `connect()`, `disconnect()` via `window.unisat`
2. **Bitcoin pages never import `useAuth()`** — they use `useBtcWallet()` instead for wallet state and gating
3. **New `BtcConnectWalletModal`** — replaces `NotLoggedInModal` on BTC pages; prompts UniSat/Xverse install or connection
4. **`PanelPage.tsx` unchanged** — Panel remains Privy-only (Solana/BNB portfolio). Bitcoin activity is accessed via `/btc` routes
5. **`btc_token_comments` table** uses `creator_wallet TEXT` instead of `user_id UUID` — no dependency on Privy profiles
6. **Chain context `isEvmChain` updated** — add `isBtcChain` boolean so components can conditionally render the correct wallet UI
7. **Sidebar** — BTC nav links go to `/btc` routes directly, no auth gate needed (wallet connect happens on the page itself)

### BTC Page Auth Pattern

Every Bitcoin page follows this pattern instead of the Privy pattern:

```typescript
// Bitcoin pages use this — NOT useAuth()
const { isConnected, address, connect } = useBtcWallet();

if (!isConnected) {
  return <BtcConnectWalletModal onConnect={connect} />;
}
```

### Files Affected

| File | Change |
|------|--------|
| `src/hooks/useBtcWallet.ts` | Create — UniSat wallet hook with connect/sign/balance |
| `src/components/bitcoin/BtcConnectWalletModal.tsx` | Create — UniSat/Xverse connect prompt (replaces NotLoggedInModal for BTC) |
| `src/contexts/ChainContext.tsx` | Add `bitcoin` chain + `isBtcChain` helper |
| `src/pages/BitcoinModePage.tsx` | Create — uses `useBtcWallet`, never touches Privy |
| `src/pages/BitcoinLaunchPage.tsx` | Create — uses `useBtcWallet` for PSBT signing |
| `src/pages/BitcoinTokenDetailPage.tsx` | Create — uses `useBtcWallet` for trading |
| `src/App.tsx` | Add `/btc` routes (outside any Privy auth gate) |
| DB migration | `btc_token_comments` uses `wallet_address TEXT` not `user_id UUID` |

### What Does NOT Change

- `useAuth()`, `PanelPage`, `NotLoggedInModal` — untouched, remain Privy-only
- Solana/BNB flows — completely unaffected
- `PrivyProviderWrapper` still wraps everything (it's fine — BTC pages just don't call any Privy hooks)

