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
  logoPath: "/saturn-logo.png",
  iconEmoji: "🌙",
  ogImage: "https://moondexo.com/saturn-og.png",
  faviconPath: "/favicon.png",

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
