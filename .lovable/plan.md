

## Plan: Dex Listing X Account Config in Admin + Auto-Generate Image on Lookup

### What Changes

**1. Admin Panel — New "Dex Listing" tab**
Add a new tab in the Admin Panel (`/admin?tab=dex-listing`) for managing the X account used for dex listing announcements. Same pattern as X Bot accounts — fields for full cookie string and SOCKS5 proxies. Stored in a new `dex_listing_x_config` table (single row, service_role-only RLS).

**2. DexListPage — Auto-show listing image on CA lookup**
When a CA is entered and looked up, immediately auto-generate and display the listing announcement image (using the existing `ListingImageGenerator` canvas logic) right in the `TokenLookupCard`, before the moderator confirms. The moderator sees the preview image as part of the lookup result.

**3. Post-to-X flow on confirm**
After the moderator clicks confirm (list token), the system:
- Uploads the generated image to temporary storage
- Posts the formatted tweet using `twitterapi.io` with cookies/socks5 from the `dex_listing_x_config` table
- Shows the tweet link or error with retry button

### Database

New table `dex_listing_x_config`:
- `id` (uuid, PK)
- `full_cookie_encrypted` (text) — full X cookie string
- `socks5_urls` (text[]) — SOCKS5 proxy list
- `updated_at` (timestamptz)
- RLS: deny all public access (service_role only)

### New/Modified Files

| File | Action |
|------|--------|
| `src/pages/DexListingAdminTab.tsx` | **Create** — Admin tab with cookie + SOCKS5 form, same UI pattern as XBotAccountForm |
| `src/pages/AdminPanelPage.tsx` | **Edit** — Add "Dex List" tab to TAB_CONFIG and TabsContent |
| `src/components/dexlist/TokenLookupCard.tsx` | **Edit** — Embed `ListingImageGenerator` inline, auto-generate on mount |
| `src/components/dexlist/ListingImageGenerator.tsx` | **Edit** — Add auto-generate on mount option, add "Post to X" button with status feedback |
| `supabase/functions/dexlist-admin/index.ts` | **Edit** — Add actions: `get-x-config`, `save-x-config`, `post-to-x` (upload image via twitterapi.io, post tweet with formatted text) |

### Tweet Template
```
🪐 Saturn New Leverage Trading Listing $TICKER

📊 Leverage Up to {maxLeverage}x

✅ Deposit open Now
✅ Full trading enabled

Start Trading 👉 https://saturn.trade/trade/{mintAddress}

#Solana #Binance #okx #trading $sol
```

### Flow Summary
```text
Admin Panel → Dex Listing tab → Enter X cookies + SOCKS5 → Save to DB

DexListPage → Enter CA → Lookup → Image auto-generated + shown
  → Moderator selects pool, leverage → Clicks "List Token"
  → Token saved to DB + tweet posted automatically
  → Tweet link shown (or error + retry)
```

### Zero AI Credits
All image generation remains client-side Canvas compositing. The tweet posting uses `twitterapi.io` REST API only.

