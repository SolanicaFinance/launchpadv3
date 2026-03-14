

## Fix Portfolio & Launches to Use Real Data

### Problems Identified

1. **Portfolio shows 0**: Uses `useUserHoldings` which queries the `token_holdings` DB table (only populated by internal swap handler). Most users have no rows there. Meanwhile, the Wallet section already uses `useWalletHoldings` (real on-chain RPC data) — that works correctly.

2. **Launches missing tokens**: `useUserTokens` queries the `tokens` table, but tokens like Madtopus are created in the `fun_tokens` table. The two tables are separate systems. Launches section never queries `fun_tokens`.

### Changes

**1. `src/hooks/useLaunchpad.ts` — Fix `useUserTokens` to include `fun_tokens`**

Update `useUserTokens` to query BOTH `tokens` AND `fun_tokens` tables by `creator_wallet`, merge results, and return a unified list. This ensures all launched tokens (regardless of launchpad type) appear in the Launches section.

```typescript
const useUserTokens = (walletAddress) => {
  return useQuery({
    queryFn: async () => {
      // Query both tables
      const [tokensResult, funTokensResult] = await Promise.all([
        supabase.from('tokens').select('*').eq('creator_wallet', walletAddress),
        supabase.from('fun_tokens').select('*').eq('creator_wallet', walletAddress)
      ]);
      // Normalize fun_tokens to Token shape and merge
      const funMapped = (funTokensResult.data || []).map(ft => ({
        ...ft, market_cap_sol: ft.market_cap_sol || 0,
        bonding_curve_progress: ft.bonding_progress || 0,
      }));
      return [...(tokensResult.data || []), ...funMapped];
    }
  });
};
```

**2. `src/components/panel/PanelUnifiedDashboard.tsx` — Make Portfolio use real on-chain data**

Replace `useUserHoldings` (DB-based) with `useWalletHoldings` (on-chain RPC) for the Portfolio section. Cross-reference the returned mints with `fun_tokens` to get name/ticker/image/price metadata for the pie chart and holdings list.

- Import `useWalletHoldings` and `useTokenMetadata`
- Use on-chain holdings for balance data
- Look up token metadata (name, ticker, image, price) from `fun_tokens` by mint address
- Build pie chart from real on-chain values × cached prices
- Create a new hook or inline query: fetch `fun_tokens` rows where `mint_address IN (holding mints)` to get prices and metadata

**3. New query helper for portfolio metadata**

Add a query inside `PanelUnifiedDashboard` (or a small hook) that fetches `fun_tokens` metadata for all held mints:

```typescript
const { data: tokenMeta } = useQuery({
  queryKey: ['portfolio-meta', holdingMints],
  queryFn: async () => {
    const { data } = await supabase
      .from('fun_tokens')
      .select('mint_address, name, ticker, image_url, price_sol, market_cap_sol')
      .in('mint_address', holdingMints);
    return new Map(data?.map(t => [t.mint_address, t]) || []);
  },
  enabled: holdingMints.length > 0,
});
```

This gives real portfolio values: on-chain balance × cached price from `fun_tokens`.

### Files to Edit
- `src/hooks/useLaunchpad.ts` — merge `fun_tokens` into `useUserTokens`
- `src/components/panel/PanelUnifiedDashboard.tsx` — replace DB holdings with on-chain holdings + fun_tokens metadata for Portfolio section

