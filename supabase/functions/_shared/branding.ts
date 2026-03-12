/**
 * MoonDexo — Edge Function Branding Constants
 * 
 * Single source of truth for all display-facing brand strings in edge functions.
 * Mirrors src/config/branding.ts for the frontend.
 */
export const BRAND = {
  name: "MoonDexo",
  shortName: "MoonDexo",
  domain: "moondexo.com",
  appUrl: "https://moondexo.com",
  twitterHandle: "@moondexo",
  twitterUrl: "https://x.com/moondexo",
  logoPath: "/moondexo-logo.png",
  ogImage: "https://moondexo.com/moondexo-logo.png",
  forumName: "MoonDexo Forum",
  communityPrefix: "t/",
  platformTokenTicker: "CLAW",
  platformTokenName: "CLAW",
} as const;
