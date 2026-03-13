/**
 * Saturn — Edge Function Branding Constants
 * 
 * Single source of truth for all display-facing brand strings in edge functions.
 * Mirrors src/config/branding.ts for the frontend.
 */
export const BRAND = {
  name: "Saturn",
  shortName: "Saturn",
  domain: "saturntrade.com",
  appUrl: "https://saturntrade.lovable.app",
  twitterHandle: "@saturntrade",
  twitterUrl: "https://x.com/saturntrade",
  logoPath: "/saturn-logo.png",
  ogImage: "https://saturntrade.com/saturn-logo.png",
  forumName: "Saturn Forum",
  communityPrefix: "t/",
  platformTokenTicker: "CLAW",
  platformTokenName: "CLAW",
} as const;
