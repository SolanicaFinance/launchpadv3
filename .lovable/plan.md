

# X Tracker — KOL Tweet Contract Address Monitor

## Overview
Create a new "X Tracker" page that monitors ~110 KOLs from the provided PDF for tweets containing contract addresses (Solana or EVM). When a KOL tweets a CA, the system captures the tweet and fetches live token data, displaying it as a card grid.

## Architecture

```text
Cron (5 min) → scan-kol-tweets edge function
                  ├── For each KOL: fetch last tweets via twitterapi.io
                  ├── Regex detect CAs (Solana base58 / EVM 0x...)
                  ├── Store in kol_contract_tweets table
                  └── Track last_scanned_tweet_id per KOL

Frontend: /x-tracker → XTrackerPage
                  ├── Fetch kol_contract_tweets from DB
                  ├── For each CA: show token data (name, price, mcap)
                  └── Display as card grid with KOL avatar, tweet text, token info
```

## Database

### New table: `kol_accounts`
Stores the tracked KOL usernames and their scan state.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| username | text | unique, not null |
| display_name | text | nullable |
| profile_image_url | text | nullable |
| last_scanned_tweet_id | text | last tweet ID processed |
| last_scanned_at | timestamptz | timestamp of last scan |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### New table: `kol_contract_tweets`
Stores detected CA tweets.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| kol_account_id | uuid | FK → kol_accounts |
| tweet_id | text | unique, not null |
| tweet_text | text | |
| tweet_url | text | |
| contract_address | text | the detected CA |
| chain | text | 'solana' or 'evm' |
| kol_username | text | denormalized |
| kol_profile_image | text | denormalized |
| token_name | text | nullable, fetched later |
| token_symbol | text | nullable |
| token_image_url | text | nullable |
| token_price_usd | numeric | nullable |
| token_market_cap | numeric | nullable |
| tweeted_at | timestamptz | tweet creation time |
| created_at | timestamptz | default now() |

RLS: Public read (SELECT) for all, no insert/update/delete from client. Edge function uses service role.

### Seed data
Insert all ~110 KOL usernames from the PDF into `kol_accounts`.

## Edge Function: `scan-kol-tweets`

1. Fetch all active KOLs from `kol_accounts`
2. For each KOL, call `https://api.twitterapi.io/twitter/user/last_tweets?userName={username}` using `TWITTERAPI_IO_KEY`
3. Filter tweets newer than `last_scanned_tweet_id` (compare tweet IDs, which are chronological)
4. Regex scan each tweet for:
   - Solana: `[1-9A-HJ-NP-Za-km-z]{32,44}` (base58, 32-44 chars)
   - EVM: `0x[a-fA-F0-9]{40}`
5. For detected CAs, try to fetch token metadata (use existing `token-metadata` or DexScreener API)
6. Insert into `kol_contract_tweets`
7. Update `last_scanned_tweet_id` and `last_scanned_at` on `kol_accounts`
8. Rate limit: batch KOLs in groups, ~20 per invocation to avoid API limits

## Frontend

### New page: `XTrackerPage.tsx` at `/x-tracker`
- Grid of cards, each showing:
  - KOL avatar + username (top left)
  - Tweet text (truncated)
  - Detected token info: name, symbol, chain badge (SOL/EVM), price, market cap
  - Link to tweet + link to token on trade page or explorer
  - Time ago badge
- Filters: chain (all/solana/evm), sort by newest
- Auto-refresh every 60s from DB

### Sidebar update
Add "X Tracker" nav item with a Twitter/radar icon between Alpha and Agents.

### Route update in `App.tsx`
Add `/x-tracker` route pointing to `XTrackerPage`.

## Files

1. **DB migration** — Create `kol_accounts` and `kol_contract_tweets` tables + RLS policies + seed KOL usernames
2. `supabase/functions/scan-kol-tweets/index.ts` — New edge function
3. `supabase/config.toml` — Add `[functions.scan-kol-tweets]` entry
4. `src/pages/XTrackerPage.tsx` — New page
5. `src/components/x-tracker/KolTweetCard.tsx` — Tweet card component
6. `src/hooks/useKolTweets.ts` — Hook to fetch from DB
7. `src/components/layout/Sidebar.tsx` — Add nav link
8. `src/App.tsx` — Add route

## Cron Setup
After edge function is deployed, set up pg_cron to invoke `scan-kol-tweets` every 5 minutes using `pg_net.http_post`.

