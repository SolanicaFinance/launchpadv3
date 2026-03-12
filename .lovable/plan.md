

## Problem

The `projectId: 'claw-launchpad-base'` in `EvmWalletProviderInner.tsx` is not a valid WalletConnect Cloud project ID. WalletConnect requires a hex project ID obtained from [cloud.walletconnect.com](https://cloud.walletconnect.com). This causes:
- 403 on config fetch (`api.web3modal.org`)
- 400 on analytics (`pulse.walletconnect.org`)
- "WalletConnect Core is already initialized" warning

The "double init" warning is a secondary issue from RainbowKit's internal WalletConnect provider setup.

## Fix

### 1. Get a valid WalletConnect project ID
You need to register at [cloud.walletconnect.com](https://cloud.walletconnect.com), create a project, and get a real project ID (looks like `a1b2c3d4e5f6...`).

### 2. Update `src/providers/EvmWalletProviderInner.tsx`
Replace the placeholder `'claw-launchpad-base'` with the real project ID. Since this is a **publishable** key (not secret), it can be stored directly in code or as a `VITE_` env variable.

### 3. The "double init" warning
This is a known RainbowKit issue and is cosmetic -- it does not affect functionality. No code change needed.

## Summary
Single file change: replace the fake project ID with a real WalletConnect Cloud project ID. I need you to provide this ID (or I can guide you to get one).

