/**
 * Saturn — Edge Function Branding Constants
 * 
 * Single source of truth for all display-facing brand strings in edge functions.
 * Mirrors src/config/branding.ts for the frontend.
 */
export const BRAND = {
  name: "Saturn",
  shortName: "Saturn",
  domain: "saturn.trade",
  appUrl: "https://saturn.trade",
  twitterHandle: "@saturnterminal",
  twitterUrl: "https://x.com/saturnterminal",
  logoPath: "/saturn-logo.png",
  ogImage: "https://saturn.trade/og-image.png",
  forumName: "Saturn Forum",
  communityPrefix: "t/",
  platformTokenTicker: "CLAW",
  platformTokenName: "CLAW",
} as const;
