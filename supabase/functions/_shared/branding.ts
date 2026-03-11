/**
 * Saturn Trade — Edge Function Branding Constants
 * 
 * Single source of truth for all display-facing brand strings in edge functions.
 * Mirrors src/config/branding.ts for the frontend.
 */
export const BRAND = {
  name: "Saturn Trade",
  shortName: "Saturn",
  domain: "saturn.trade",
  appUrl: "https://saturn.trade",
  twitterHandle: "@saturntrade",
  twitterUrl: "https://x.com/saturntrade",
  logoPath: "/saturn-logo.png",
  ogImage: "https://saturn.trade/saturn-og.png",
  forumName: "Saturn Forum",
  communityPrefix: "t/",
  platformTokenTicker: "CLAW",
  platformTokenName: "CLAW",
} as const;
