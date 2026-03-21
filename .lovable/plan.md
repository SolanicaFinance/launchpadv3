

# Meteorite Mode — Full Implementation Plan

## Current State
- **MeteoritePage.tsx**: Landing page with mock data, non-functional "Tokenize Tweet" button
- **MeteoriteAdminTab.tsx**: Admin tab with mock data, no real backend
- **No database tables**: No `meteorite_tokens` table exists
- **No edge functions**: No meteorite-specific backend functions exist
- **Existing patterns**: PumpPortal API for token creation (pump-batch-launch), AI image generation (fun-generate), Keypair generation for wallets

## What Needs to Be Built

### 1. Database: `meteorite_tokens` table
Store each tokenized tweet with its associated dev wallet (private key included for permanent access).

```
meteorite_tokens:
  id, tweet_url, tweet_author, tweet_content, tweet_id,
  token_name, token_ticker, token_description,
  mint_address, pumpfun_url,
  dev_wallet_address, dev_wallet_private_key (encrypted/plain),
  image_url, status (pending_payment | generating_image | launching | live | failed),
  creator_wallet (who submitted), payment_tx_signature,
  total_fees_earned, created_at
```

RLS: Public SELECT (no private key column exposed), writes via service role only. Create a `meteorite_tokens_safe` view excluding `dev_wallet_private_key`.

### 2. Edge Function: `meteorite-init`
When user submits a tweet URL to tokenize:
1. Generate a fresh Solana Keypair (dev wallet for this token)
2. Save the private key to `meteorite_tokens` table (status: `pending_payment`)
3. Return the dev wallet address and 0.1 SOL payment requirement
4. Parse tweet ID from URL for later use

### 3. Edge Function: `meteorite-confirm`
Polls or is called after user sends 0.1 SOL:
1. Check the dev wallet balance on-chain (via Solana RPC)
2. Once 0.1 SOL confirmed, update status to `generating_image`
3. Trigger image generation (next step)

### 4. Edge Function: `meteorite-launch`
After payment confirmation:
1. **Fetch tweet content** from the tweet URL (extract text context)
2. **AI generates meme image**: Use Lovable AI gateway (same pattern as `fun-generate`) — the character/meme is based on the tweet's context/content, background uses random meme metrics
3. **AI generates token name/ticker**: Based on tweet context
4. **Upload image to pump.fun IPFS** (same pattern as `pump-batch-launch`)
5. **Set X (Twitter) link** to the original monetized tweet URL in token metadata
6. **Create token via PumpPortal API** using the dev wallet's private key as the deployer, with the 0.1 SOL as the initial dev buy
7. **Save mint address, pumpfun URL** to `meteorite_tokens`, set status to `live`
8. Return success with token details

### 5. Frontend: MeteoritePage.tsx — Tokenization Flow
Replace mock "Tokenize Tweet" button with a real multi-step flow:
1. **URL Input** → Validate tweet URL format
2. **Payment Prompt** → Show generated dev wallet address, "Send 0.1 SOL to launch" with copy button and QR-like display
3. **Waiting for Payment** → Poll `meteorite-confirm` until 0.1 SOL arrives
4. **Generating Meme** → Show spinner/animation while AI creates the image based on tweet context
5. **Launching** → Show progress while token deploys to pump.fun
6. **Success Screen** → Show mint address, pump.fun link, copy CA button

### 6. Frontend: Live Data Section
Replace `MOCK_TOKENIZED_TWEETS` with real data from `meteorite_tokens` table:
- Query `meteorite_tokens_safe` view (excludes private keys)
- Show real token names, CAs, tweet links, status
- Stats bar pulls aggregated data from the table

### 7. Admin Tab: Real Data
Update `MeteoriteAdminTab.tsx` to query `meteorite_tokens` table instead of mock data. Admin can see all tokens, statuses, and dev wallet addresses.

## Technical Details

- **Dev wallet security**: Private keys stored in `meteorite_tokens` with service-role-only access. Frontend never sees them. A `_safe` view is used for public queries.
- **PumpPortal integration**: Reuses the proven pattern from `pump-batch-launch` — IPFS upload → mint keypair → PumpPortal create with dev wallet as deployer.
- **AI image generation**: Reuses `fun-generate` pattern with Lovable AI gateway, but prompt is contextualized to the tweet content.
- **Tweet X link**: The monetized tweet URL is passed as the `twitter` field in pump.fun metadata, so it shows on the token's pump.fun page.
- **No admin password needed for dev wallets**: Keys are stored permanently in the database, accessible via service role edge functions.

## File Changes Summary
| Action | File |
|--------|------|
| Create | `supabase/migrations/meteorite_tokens.sql` (table + view + RLS) |
| Create | `supabase/functions/meteorite-init/index.ts` |
| Create | `supabase/functions/meteorite-confirm/index.ts` |
| Create | `supabase/functions/meteorite-launch/index.ts` |
| Rewrite | `src/pages/MeteoritePage.tsx` (real flow + live data) |
| Rewrite | `src/components/admin/MeteoriteAdminTab.tsx` (real data) |

