

## Problem

On page refresh at `saturn.trade`, the app crashes with `Cannot read properties of null (reading 'connectors')`. This happens because multiple hooks call Privy's `useWallets()` **outside** the `PrivyProvider` context during the initial render — before Privy has finished loading.

The previous fix only guarded `useAuth` and `usePrivyEvmWallet`, but several other hooks also directly call Privy hooks without guards:

1. **`useSolanaWalletWithPrivy`** — calls `usePrivy()`, `useWallets()`, `useSignAndSendTransaction()`, `useSignTransaction()`
2. **`useDelegatedWallet`** — calls `usePrivy()`, `useWallets()`
3. **`useClaimWallet`** — calls `usePrivy()`, `useWallets()`
4. **`useMultiWallet`** — calls `useWallets()`, `useCreateWallet()`

The crash path: `PulseQuickBuyButton` → `useTurboSwap` → `useSolanaWalletWithPrivy` → `useWallets()` → **boom**.

## Fix

Apply the same guard pattern used for `useAuth` — check `usePrivyAvailable()` first and return a safe fallback when Privy isn't ready. For each affected hook:

### 1. `src/hooks/useSolanaWalletPrivy.ts`
- Wrap the existing `useSolanaWalletWithPrivy` as an inner function
- Export a new `useSolanaWalletWithPrivy` that checks `usePrivyAvailable()` and returns a no-op fallback (null address, empty functions that throw, `isWalletReady: false`) when Privy isn't available

### 2. `src/hooks/useDelegatedWallet.ts`
- Same pattern: guard with `usePrivyAvailable()`, return `{ needsDelegation: false, isDelegating: false, ... }` fallback

### 3. `src/hooks/useClaimWallet.ts`
- Same pattern: guard with `usePrivyAvailable()`, return safe defaults

### 4. `src/hooks/useMultiWallet.ts`
- Same pattern: guard with `usePrivyAvailable()`, return `{ managedWallets: [], activeWallet: null, ... }` fallback

All four hooks follow the identical pattern already established in `useAuth.ts`: conditional early return before any Privy hooks are called.

