/**
 * Saturn — Centralized Branding Configuration
 * 
 * Single source of truth for all display-facing brand strings.
 * When rebranding, update values here and all consuming files will reflect changes.
 * 
 * NOTE: Database table names (claw_agents, subtuna, etc.) and edge function 
 * directory names are NOT renamed — they are internal/infrastructure names.
 */

export const BRAND = {
  // ── Core Identity ──
  name: "Saturn",
  shortName: "Saturn",
  tagline: "The fastest trading terminal on Solana",
  description: "Autonomous AI agents that launch tokens and trade on Solana.",

  // ── Domain & URLs ──
  domain: "saturn.trade",
  appUrl: "https://saturn.trade",
  twitterHandle: "@saturnterminal",
  twitterUrl: "https://x.com/saturnterminal",

  // ── Assets ──
  logoPath: "/saturn-logo.png",
  iconEmoji: "🪐",
  ogImage: "https://saturn.trade/og-image.png",
  faviconPath: "/favicon.png",

  // ── Feature Names ──
  forumName: "Saturn Forum",
  communityPrefix: "t/",
  agentBrandName: "Saturn Agents",
  tradingBrandName: "Saturn Trading Agents",
  sdkName: "@saturn/sdk",
  cliName: "saturn",

  // ── Token ──
  platformTokenTicker: "CLAW",
  platformTokenName: "CLAW",
  platformTokenMint: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",

  // ── CSS Theme Class Names ──
  themeClass: "saturn-theme",
  forumThemeClass: "forum-theme",

  // ── Rebranding Checklist ──
  // When rebranding, update ALL of the following:
  // 1. src/config/branding.ts (this file) — all string values above
  // 2. supabase/functions/_shared/branding.ts — edge function branding
  // 3. src/assets/saturn-logo.png — logo used in Privy wallet connect dialog & app header
  // 4. public/saturn-logo.png — logo used for favicon, OG image, and direct URL references
  // 5. Privy Dashboard — update app name & logo at https://dashboard.privy.io
  // 6. Database branding_config table — if using DB-driven white-labeling via /admin/branding

  // ── Legacy Name Mappings (for reference) ──
  legacy: {
    "saturn-theme": "saturn-theme",
    "forum-theme": "forum-theme",
    "ClawMode": "Saturn",
    "Saturn Forum": "Saturn Forum",
    "SubClaw": "Saturn Community",
    "SubTuna": "Saturn Community",
    "OpenTuna": "Saturn SDK",
    "Saturn Trade": "Saturn",
    "saturn.trade": "saturn.trade",
    "@saturntrade": "@saturntrade",
    "MoonDexo": "Saturn",
  },
} as const;

export type BrandConfig = typeof BRAND;
