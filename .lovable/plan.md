

## Plan: Multi-Chain Profile + Deposit System + Post-Login Navigation

Three issues to solve:

### Problem 1: Profile page is Solana-only
When BNB chain is selected and you click the profile from the dropdown, it navigates using the Solana embedded address. The profile page then fetches SOL balance, Solana trades, and shows Solscan links. None of this is relevant when on BNB.

### Problem 2: No Deposit button in the wallet dropdown
The BnbWalletBar in the Panel has a deposit dialog, but the main header wallet dropdown (where most users interact) has no deposit option at all.

### Problem 3: No clear post-login landing for profile/wallet management
After login, there's no redirect to the Panel or profile. Users have to manually find their way.

---

### Implementation

#### 1. Database: Add `evm_wallet_address` to profiles table
- Migration: `ALTER TABLE profiles ADD COLUMN evm_wallet_address text;`
- Store the Privy EVM address alongside `solana_wallet_address` during user sync

#### 2. Update `HeaderWalletBalance.tsx` -- Profile navigation + Deposit button
- **Profile click**: When BNB chain is active, navigate using EVM address or username (not Solana address)
- **Profile fetch**: Also query by `evm_wallet_address` when on BNB chain
- **Add Deposit menu item**: New menu item with `ArrowDownToLine` icon that opens a deposit dialog
- The deposit dialog is chain-aware: shows the correct address (BNB or SOL), correct currency label, QR code, and instant deposit detection via polling

#### 3. Create `DepositDialog` component (`src/components/wallet/DepositDialog.tsx`)
- Shared component used by both HeaderWalletBalance dropdown and PanelWalletBar
- Props: `address`, `chain` (bnb | solana), `open`, `onOpenChange`
- Features:
  - QR code of the deposit address
  - Copy button
  - Chain-specific labels (BNB Chain / Solana)
  - **Instant deposit detection**: polls balance every 3 seconds while open, compares to opening balance, shows success animation when increase detected
  - For SOL: uses `getBalance` from Privy hook
  - For BNB: uses BSC RPC `eth_getBalance`

#### 4. Update `UserProfilePage.tsx` -- Multi-chain awareness
- Add `useChain` hook to determine active chain
- When BNB is active:
  - Detect EVM addresses (`0x` prefix) in the identifier
  - Query profiles by `evm_wallet_address` for `0x` addresses
  - Fetch BNB balance via BSC RPC instead of SOL balance
  - Show "BNB Balance" instead of "SOL Balance"
  - Link trades to BscScan instead of Solscan
  - Filter alpha_trades by `chain = 'bnb'` 
  - Show BNB-denominated stats
- `isWalletAddress` function updated to also detect `0x` EVM addresses

#### 5. Update `useUserProfile.ts` -- Support EVM lookups
- `isWalletAddress`: also match `0x` prefixed addresses (42 chars)
- New `isEvmAddress` helper
- When identifier is an EVM address, query `profiles.evm_wallet_address` instead of `solana_wallet_address`
- Alpha trades query: filter by `chain` column when on BNB

#### 6. Update `sync-privy-user` edge function
- Store the EVM wallet address in `profiles.evm_wallet_address` during user creation/sync

#### 7. Add "Deposit" to wallet dropdown menu
- Between "Portfolio" and "Pulse" in the dropdown, add a Deposit item
- Opens the new `DepositDialog` with chain-aware address

#### 8. Post-login redirect
- In `HeaderWalletBalance` or the login callback, after successful authentication, navigate to `/panel` if the user hasn't navigated elsewhere
- This gives users immediate access to their wallet, portfolio, deposit, export, and profile editing

### Files to create/edit:
- **Create**: `src/components/wallet/DepositDialog.tsx`
- **Edit**: `src/components/layout/HeaderWalletBalance.tsx`
- **Edit**: `src/pages/UserProfilePage.tsx`
- **Edit**: `src/hooks/useUserProfile.ts`
- **Migration**: Add `evm_wallet_address` column to profiles
- **Edit**: `supabase/functions/sync-privy-user/index.ts` (store EVM address)

