

## Problem

After a CEX rotation, the user's funds arrived at the new wallet `ECQtuCBe5XU85wgf48uTdNgFW1q1c7bytcHEkMaXC6Qk`, but the page crashed before the "Done" button was clicked. The completion step (switchWallet + hideOldWallet) never ran, so the UI still shows the old wallet as active. The new wallet also isn't registered in the `user_wallets` DB table.

## Plan

### 1. Add auto-recovery on app startup in `useMultiWallet`

When the hook initializes and detects a persisted rotation order in localStorage (`claw_rotation_order`), it should:
- Check if the `newWalletAddress` from the persisted order exists in the Privy embedded wallets list
- If found: automatically call `switchWallet(newWalletAddress)`, register it in `user_wallets` table, and clear the persisted order
- This ensures crash recovery happens silently without needing the modal

### 2. Register new wallet in DB during recovery

The `createNewWallet` function registers wallets in `user_wallets`, but if the page crashed before completion, the new wallet may not be in the DB. The recovery logic will upsert it.

### 3. Immediate fix for this specific user

Since the wallet `ECQtuCBe5XU85wgf48uTdNgFW1q1c7bytcHEkMaXC6Qk` already exists in Privy's embedded wallets for this user, the recovery code will detect it on next page load and auto-switch.

### Technical Changes

**`src/hooks/useMultiWallet.ts`** — Add a `useEffect` that runs after `embeddedWallets` are loaded:
- Import `getPersistedOrder` and `clearPersistedOrder` (need to export `clearPersistedOrder` from the rotation hook)
- If persisted order exists and `newWalletAddress` is found in `embeddedWallets`, auto-switch to it, upsert into `user_wallets`, and clear the persisted order
- This runs once on mount, ensuring seamless crash recovery

**`src/hooks/useDevWalletRotation.ts`** — Export `clearPersistedOrder` so the multi-wallet hook can use it.

