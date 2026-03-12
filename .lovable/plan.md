

## Plan: Replace All Logos, Favicon, Default Avatar with MoonDexo Wolf Logo

The uploaded wolf/moon image will become the single logo, favicon, default avatar, and OG image across the entire platform. X link stays as `https://x.com/moondexo`, no Telegram, description unchanged.

### Step 1 — Copy uploaded image into project
- `user-uploads://moondexo.png` → `public/moondexo-logo.png` (favicon, OG, public refs)
- `user-uploads://moondexo.png` → `src/assets/moondexo-logo.png` (ES6 imports in components)

### Step 2 — Update `index.html`
- Favicon: `/moondexo-logo.png`
- All OG/Twitter image meta tags: `/moondexo-logo.png`

### Step 3 — Update branding configs
**`src/config/branding.ts`**: `logoPath` → `/moondexo-logo.png`, `faviconPath` → `/moondexo-logo.png`, `ogImage` updated

**`supabase/functions/_shared/branding.ts`**: same logo/OG path updates

**`src/contexts/BrandingContext.tsx`**: update `DEFAULT_CONFIG` logo/favicon/OG defaults

### Step 4 — Replace all logo imports (16 files)
Every file currently importing `saturn-logo.png`, `claw-logo.png`, `tuna-logo.png`, or `saturn-merch-logo.png` will switch to `moondexo-logo.png`:

- `AppHeader.tsx`, `Sidebar.tsx`, `PanelPage.tsx`, `HomePage.tsx`, `BagsAgentsPage.tsx`, `PrivyProviderWrapper.tsx`, `ProfitCardModal.tsx` — currently `saturn-logo.png`
- `ConsoleDrawer.tsx`, `AgentIdeaGenerator.tsx`, `ConsolePage.tsx`, `CreateTradingAgentModal.tsx`, `PortfolioPage.tsx` — currently `claw-logo.png`
- `LaunchpadBadge.tsx` — currently `tuna-logo.png`
- `MerchHeader.tsx`, `ProductCard.tsx` — currently `saturn-merch-logo.png`
- `AgentPlatformToken.tsx` — hardcoded `/claw-logo.png` public path → `/moondexo-logo.png`

### Step 5 — Replace default avatar (3 files)
Files importing `default-avatar.png` will switch to `moondexo-logo.png`:
- `HeaderWalletBalance.tsx`
- `EditProfileModal.tsx`
- `UserProfilePage.tsx`

### Step 6 — System agent avatar
Update `src/lib/agentAvatars.ts`: change `SYSTEM_CLAW_AVATAR` from `/images/system-tuna-avatar.png` to `/moondexo-logo.png`

### Summary of touches
~22 file edits + 2 file copies. No database changes needed. No Telegram link added per user preference.

