

# Professional Web-Based Wallet Section

## Overview
Build a full-featured wallet page/tab within the Panel that rivals Phantom's functionality — send SOL, send any SPL token, receive (QR + address), view token holdings with metadata (name, image, price), transaction history, and multi-wallet management. All powered by the existing Privy embedded wallet infrastructure.

## Architecture

```text
PanelPage (/panel?tab=wallet)
  └── PanelWalletTab.tsx (new — replaces basic WalletManagerPanel)
       ├── WalletHeader        — active wallet, total USD value, SOL balance
       ├── ActionBar            — Send / Receive / Swap / Export buttons
       ├── TokenHoldingsList    — all SPL tokens with metadata, USD values
       ├── SendModal            — send SOL or any token to any address
       ├── ReceiveModal         — QR code + address copy (existing)
       ├── SwapModal            — quick Jupiter swap inline
       ├── TransactionHistory   — recent tx list from Solscan/Helius
       └── WalletSwitcher       — multi-wallet selector + create new
```

## Key Components to Create

### 1. `src/components/wallet/PanelWalletTab.tsx`
Main wallet dashboard with:
- Hero section: large SOL balance + USD equivalent, wallet address pill
- 4 action buttons in a row: Send, Receive, Swap, Export Key
- Token holdings list below with search/filter
- Transaction history section

### 2. `src/components/wallet/SendTokenModal.tsx`
Full send flow:
- Recipient address input with address book (recent addresses from localStorage)
- Token selector dropdown (SOL + all held SPL tokens from `useWalletHoldings`)
- Amount input with MAX button and USD conversion
- Fee estimate display
- Confirmation step with summary before signing
- Uses `@solana/web3.js` `SystemProgram.transfer` for SOL, `createTransferInstruction` from `@solana/spl-token` for SPL tokens
- Signs via `useSolanaWalletWithPrivy().signAndSendTransaction`

### 3. `src/components/wallet/TokenHoldingsList.tsx`
- Fetches holdings via existing `useWalletHoldings` hook
- Enriches with metadata (name, symbol, image) via a new edge function `fetch-token-metadata` that calls Helius DAS API `getAssetsBatch`
- Shows token icon, name, balance, USD value
- Click to expand: copy mint, view on Solscan, quick send, quick swap

### 4. `src/components/wallet/WalletTransactionHistory.tsx`
- Fetches recent transactions via new edge function `fetch-wallet-transactions` using Helius `getSignaturesForAddress` + `parseTransaction`
- Shows: type (send/receive/swap), amount, counterparty, time, signature link
- Auto-refresh every 30s

### 5. `src/components/wallet/SwapModal.tsx`
- Inline Jupiter swap: select input token, output token, amount
- Uses existing `useJupiterSwap` hook
- Quote preview with price impact
- One-click execute via Privy

## Edge Functions to Create

### `supabase/functions/fetch-token-metadata/index.ts`
- Accepts array of mint addresses
- Calls Helius DAS API `getAssetsBatch` using existing `HELIUS_RPC_URL`
- Returns name, symbol, image URL, decimals for each
- Caches results in memory (tokens don't change metadata)

### `supabase/functions/fetch-wallet-transactions/index.ts`
- Accepts wallet address + optional limit
- Calls Helius enhanced transactions API
- Returns parsed transaction list with type, amounts, counterparties

## Database Changes
None required — all data comes from on-chain queries.

## Hook to Create

### `src/hooks/useTokenMetadata.ts`
- React Query hook that batches mint addresses from holdings
- Calls `fetch-token-metadata` edge function
- Client-side cache with long staleTime (metadata rarely changes)

### `src/hooks/useWalletTransactions.ts`
- React Query hook for transaction history
- Calls `fetch-wallet-transactions` edge function

## Panel Integration
- Replace the `wallets` tab content in `PanelPage.tsx` with the new `PanelWalletTab`
- Rename tab label from "Wallets" to "Wallet" with a proper wallet icon

## Design Language
- Follows existing terminal dark aesthetic (#0d0d0f background, #c8ff00 accents, IBM Plex Mono)
- Large balance display with animated number transitions
- Glass-morphism cards for token holdings
- Smooth sheet/dialog animations for Send/Receive/Swap modals
- Token icons with fallback gradient avatars
- Micro-interactions: hover glow on action buttons, skeleton loading states

## Files to Create/Modify
1. **`src/components/wallet/PanelWalletTab.tsx`** — Main wallet dashboard
2. **`src/components/wallet/SendTokenModal.tsx`** — Send SOL/SPL tokens
3. **`src/components/wallet/TokenHoldingsList.tsx`** — Token list with metadata
4. **`src/components/wallet/SwapModal.tsx`** — Inline Jupiter swap
5. **`src/components/wallet/WalletTransactionHistory.tsx`** — Tx history
6. **`src/hooks/useTokenMetadata.ts`** — Token metadata fetching
7. **`src/hooks/useWalletTransactions.ts`** — Transaction history hook
8. **`supabase/functions/fetch-token-metadata/index.ts`** — Helius DAS metadata
9. **`supabase/functions/fetch-wallet-transactions/index.ts`** — Helius tx parsing
10. **`src/pages/PanelPage.tsx`** — Update tab to use new wallet component

