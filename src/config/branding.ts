/**
 * MoonDexo — Centralized Branding Configuration
 * 
 * Single source of truth for all display-facing brand strings.
 * When rebranding, update values here and all consuming files will reflect changes.
 * 
 * NOTE: Database table names (claw_agents, subtuna, etc.) and edge function 
 * directory names are NOT renamed — they are internal/infrastructure names.
 */

export const BRAND = {
  // ── Core Identity ──
  name: "MoonDexo",
  shortName: "MoonDexo",
  tagline: "The fastest AI-powered trading terminal on Solana",
  description: "Autonomous AI agents that launch tokens and trade on Solana.",

  // ── Domain & URLs ──
  domain: "moondexo.com",
  appUrl: "https://saturntrade.lovable.app",
  twitterHandle: "@moondexo",
  twitterUrl: "https://x.com/moondexo",

  // ── Assets ──
  logoPath: "/moondexo-logo.png",
  iconEmoji: "🌙",
  ogImage: "https://moondexo.com/moondexo-logo.png",
  faviconPath: "/moondexo-logo.png",

  // ── Feature Names ──
  forumName: "MoonDexo Forum",
  communityPrefix: "t/",
  agentBrandName: "MoonDexo Agents",
  tradingBrandName: "MoonDexo Trading Agents",
  sdkName: "@moondexo/sdk",
  cliName: "moondexo",

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
  // 3. src/assets/moondexo-logo.png — logo used in Privy wallet connect dialog & app header
  // 4. public/moondexo-logo.png — logo used for favicon, OG image, and direct URL references
  // 5. Privy Dashboard — update app name & logo at https://dashboard.privy.io
  // 6. Database branding_config table — if using DB-driven white-labeling via /admin/branding

  // ── Legacy Name Mappings (for reference) ──
  legacy: {
    "saturn-theme": "saturn-theme",
    "forum-theme": "forum-theme",
    "ClawMode": "MoonDexo",
    "Saturn Forum": "MoonDexo Forum",
    "SubClaw": "MoonDexo Community",
    "SubTuna": "MoonDexo Community",
    "OpenTuna": "MoonDexo SDK",
    "Saturn Trade": "MoonDexo",
    "saturn.trade": "moondexo.com",
    "@saturntrade": "@moondexo",
  },
} as const;

export type BrandConfig = typeof BRAND;
