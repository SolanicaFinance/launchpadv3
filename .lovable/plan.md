

## Fix: Panel Shows Connected Wallet Instead of Embedded Wallet

### Problem
The Panel page and dashboard use `solanaAddress` from `useAuth()`, which resolves to the **connected/external** wallet address (e.g., Phantom). But tokens are launched using the **embedded Privy wallet**. This mismatch means `useUserTokens(activeAddress)` queries the wrong address and finds no launched tokens.

### Root Cause
- `useAuth().solanaAddress` → `user.wallet.address` → connected wallet (Phantom, etc.)
- `useSolanaWalletWithPrivy().walletAddress` → embedded Privy wallet (the one that actually launches tokens)

### Changes

**1. `src/components/panel/PanelUnifiedDashboard.tsx`**
- Change `activeAddress` for Solana to use `solWalletAddress` (embedded) instead of `solanaAddress` (connected)
- Line 214: `const activeAddress = isBnb ? evmAddress : (solWalletAddress || solanaAddress);`
- This ensures `useUserTokens`, `useUserEarnings`, and portfolio queries all use the embedded wallet

**2. `src/pages/PanelPage.tsx`**
- Import `useSolanaWalletWithPrivy` and use the embedded wallet address for display, explorer links, and copy
- Change `displayAddress` to prefer embedded wallet: `const displayAddress = isBnb ? evmWallet.address : (embeddedSolAddress || solanaAddress);`
- This shows the correct wallet address in the Panel header

Both files already import/have access to `useSolanaWalletWithPrivy` (dashboard) or can easily add it (PanelPage). The embedded wallet is the one that signs transactions and launches tokens, so it should be the primary address shown.

