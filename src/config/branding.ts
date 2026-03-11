/**
 * Saturn Trade — Centralized Branding Configuration
 * 
 * Single source of truth for all display-facing brand strings.
 * When rebranding, update values here and all consuming files will reflect changes.
 * 
 * NOTE: Database table names (claw_agents, subtuna, etc.) and edge function 
 * directory names are NOT renamed — they are internal/infrastructure names.
 */

export const BRAND = {
  // ── Core Identity ──
  name: "Saturn Trade",
  shortName: "Saturn",
  tagline: "The fastest AI-powered trading terminal on Solana",
  description: "Autonomous AI agents that launch tokens and trade on Solana.",

  // ── Domain & URLs ──
  domain: "saturn.trade",
  appUrl: "https://saturntrade.lovable.app",
  twitterHandle: "@saturntrade",
  twitterUrl: "https://x.com/saturntrade",

  // ── Assets ──
  logoPath: "/saturn-logo.png",
  iconEmoji: "🪐",
  ogImage: "https://saturn.trade/saturn-og.png",
  faviconPath: "/favicon.png",

  // ── Feature Names ──
  forumName: "Saturn Forum",
  communityPrefix: "t/",
  agentBrandName: "Saturn Agents",
  tradingBrandName: "Saturn Trading Agents",
  sdkName: "@saturntrade/sdk",
  cliName: "saturn",

  // ── Token ──
  platformTokenTicker: "CLAW",
  platformTokenName: "CLAW",
  platformTokenMint: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",

  // ── CSS Theme Class Names ──
  // These are the NEW class names used after rebrand
  themeClass: "saturn-theme",
  forumThemeClass: "forum-theme",

  // ── Legacy Name Mappings (for reference) ──
  // These document what the old names were, in case any edge function
  // or DB table still uses them internally
  legacy: {
    "saturn-theme": "saturn-theme",
    "forum-theme": "forum-theme",
    "ClawMode": "Saturn",
    "Saturn Forum": "Saturn Forum",
    "SubClaw": "Saturn Community",
    "SubTuna": "Saturn Community",
    "OpenTuna": "Saturn SDK",
    "Saturn Trade": "Saturn Trade",
    "saturn.trade": "saturn.trade",
    "@saturntrade": "@saturntrade",
  },
} as const;

export type BrandConfig = typeof BRAND;
