

# Fix: Support Any Solana Wallet on Profile Page

## Problem
When visiting `/profile/{wallet_address}` for a wallet not registered in our system, it throws "Profile not found" because `useUserProfile` requires a match in the `profiles` table.

## Solution
Make the profile page work for **any** Solana wallet address by creating a fallback "global" profile when no registered profile exists.

### 1. Update `useUserProfile.ts` — Return a synthetic profile for unregistered wallets
- When `isWalletAddress(identifier)` is true and no profile is found in the DB, instead of throwing an error, return a **synthetic UserProfile** object with the wallet address and sensible defaults (no username, no bio, "Global User" display, etc.)
- Add a `isRegistered: boolean` flag to the return value so the UI can distinguish
- The `wallet` variable should fall back to `identifier` when it's a wallet address but no profile exists — this allows alpha trades, tokens, etc. to still load

### 2. Update `UserProfilePage.tsx` — Show "Global" badge for unregistered wallets
- Remove the "Profile not found" error for wallet addresses — instead render the profile page with available on-chain data
- Show a visual indicator like "Global Wallet" or "Unregistered" badge
- Hide "Edit profile" and "Verify Account" buttons for non-registered profiles
- The alpha trades, positions, tokens created, and trading stats will all still work since they query by wallet address

### Key Changes in `useUserProfile.ts`:
```typescript
// Instead of throwing when no profile found for a wallet:
if (!data && isWalletAddress(identifier)) {
  return {
    id: identifier, // use wallet as pseudo-id
    username: null,
    display_name: null,
    bio: null,
    avatar_url: null,
    cover_url: null,
    website: null,
    verified_type: null,
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    created_at: new Date().toISOString(),
    solana_wallet_address: identifier,
  } as UserProfile;
}
```

- The `wallet` variable derivation changes: use `profileQuery.data?.solana_wallet_address` OR fall back to `identifier` if it's a wallet address
- Alpha trades query already works by wallet, so it will load automatically

### Files to modify:
1. **`src/hooks/useUserProfile.ts`** — fallback synthetic profile + `isRegistered` flag
2. **`src/pages/UserProfilePage.tsx`** — handle unregistered wallets gracefully, show "Global Wallet" indicator

