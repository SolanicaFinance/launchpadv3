

## Add "Sell 100%" Quick Button to Token Cards

### What changes
**`src/components/launchpad/PulseQuickBuyButton.tsx`**
- Import `useAuth` (already imported) and `supabase` to query `token_holdings` for the user's balance of this specific token
- Add a lightweight `useEffect` or inline query: when authenticated, fetch `token_holdings` where `wallet_address = userWallet` and `token_id = token.id`, get the `balance` field
- Render a red-themed "Sell 100%" button next to the existing buy button (only visible when balance > 0)
- On click: call `executeFastSwap(token, fullBalance, false, 500)` to sell entire position instantly
- Show loading spinner while selling, same pattern as buy

**`src/components/launchpad/TokenCard.tsx`**
- No changes needed — the sell button renders inside `PulseQuickBuyButton` which is already in the actions row

### Button style
- Red/destructive theme: `bg-red-500/15 text-red-400 hover:bg-red-500/25`
- Label: "Sell 100%" with a small icon
- Same size as the buy button for visual consistency

### Balance fetching
- Use `useQuery` with key `["quick-sell-balance", walletAddress, mintAddress]` 
- Query `token_holdings` table filtered by `wallet_address` and `token_id` (from funToken.id)
- Stale time ~10s so it doesn't spam requests across many cards
- Only enabled when `isAuthenticated && (funToken || codexToken)` exists

