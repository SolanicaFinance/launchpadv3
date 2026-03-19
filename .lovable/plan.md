

## Moderator Dex Listing Page (`/dexlist`)

### What This Does
A password-protected moderator page where mods can enter a Solana token's contract address (CA), the system finds the highest-value pool for it, loads all token metadata (image, socials, description), and lets the mod confirm and set leverage trading parameters (up to 50x) for that token.

### Architecture

**Password**: `mod135@` (separate from admin `saturn135@`, stored in localStorage as `dexlist_mod_auth`)

**Data flow:**
```text
Mod enters CA → DexScreener API lookup → Show token info + pools
                                        → Mod confirms pool or enters manually
                                        → Mod sets max leverage (1-50x)
                                        → Save to `dex_listed_tokens` table
```

### Implementation

#### 1. Database: `dex_listed_tokens` table
```sql
CREATE TABLE dex_listed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address text NOT NULL UNIQUE,
  pool_address text NOT NULL,
  token_name text,
  token_ticker text,
  image_url text,
  description text,
  website_url text,
  twitter_url text,
  telegram_url text,
  discord_url text,
  market_cap numeric,
  liquidity_usd numeric,
  max_leverage integer NOT NULL DEFAULT 1 CHECK (max_leverage >= 1 AND max_leverage <= 50),
  dex_source text DEFAULT 'dexscreener',
  is_active boolean DEFAULT true,
  listed_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE dex_listed_tokens ENABLE ROW LEVEL SECURITY;
-- Service role only (mod auth via password in edge function)
```

#### 2. Edge Function: `dexlist-admin`
- **Actions**:
  - `lookup`: Takes a `mintAddress`, calls DexScreener API (`https://api.dexscreener.com/tokens/v1/solana/{mint}`), returns all pairs sorted by liquidity, token metadata (name, ticker, image, socials), and highlights the highest-value pool
  - `list`: Saves confirmed token + pool + leverage settings to `dex_listed_tokens`
  - `update`: Updates leverage or active status
  - `fetch`: Returns all listed tokens
  - `remove`: Soft-deletes (sets `is_active = false`)
- All actions require `modPassword === "mod135@"`

#### 3. Frontend: `/dexlist` page
- **Route**: Add to `App.tsx` as `/dexlist`
- **Auth gate**: Same pattern as AdminPanelPage — password input with Lock icon, stores `dexlist_mod_auth` in localStorage
- **Layout**: Uses `LaunchpadLayout` (consistent with leverage page)

**UI flow after login:**
1. **Search bar**: Input field for Solana CA with "Lookup" button
2. **Token preview card** (after lookup):
   - Token image, name, ticker
   - Socials (website, Twitter, Telegram, Discord) as icon links
   - Market cap, liquidity, 24h volume
   - Pool selector: shows top pools sorted by liquidity with radio selection, or manual pool address input
   - "Is this the right token?" confirmation
3. **Leverage setting**: Slider or number input (1-50x) with visual indicator
4. **Submit button**: "List Token" — saves to database
5. **Listed tokens table**: Shows all active listed tokens with inline edit for leverage and toggle for active/inactive

#### 4. Files to create/modify
- **New**: `src/pages/DexListPage.tsx` — main page with auth gate + listing UI
- **New**: `src/components/dexlist/TokenLookupCard.tsx` — token preview after CA lookup
- **New**: `src/components/dexlist/ListedTokensTable.tsx` — manage existing listings
- **New**: `supabase/functions/dexlist-admin/index.ts` — edge function for lookup + CRUD
- **Modify**: `src/App.tsx` — add `/dexlist` route
- **DB migration**: Create `dex_listed_tokens` table

