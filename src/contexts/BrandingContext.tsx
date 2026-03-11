import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/config/branding";

export interface BrandingConfig {
  id: string;
  // Core identity
  brandName: string;
  brandShortName: string;
  tagline: string;
  description: string;
  // Domain & URLs
  domain: string;
  appUrl: string;
  // Social links
  twitterHandle: string;
  twitterUrl: string;
  discordUrl: string | null;
  telegramUrl: string | null;
  // Assets
  logoUrl: string;
  faviconUrl: string;
  ogImageUrl: string;
  iconEmoji: string;
  // Feature names
  forumName: string;
  communityPrefix: string;
  agentBrandName: string;
  sdkName: string;
  // Token
  platformTokenTicker: string;
  platformTokenName: string;
  platformTokenMint: string;
  // Theme
  colorPrimary: string;
  colorAccent: string;
  colorBackground: string;
  colorForeground: string;
  colorMuted: string;
  fontFamily: string;
  // Feature toggles
  featureForumEnabled: boolean;
  featureMerchEnabled: boolean;
  featureAgentsEnabled: boolean;
  featureLeverageEnabled: boolean;
  featureAlphaTrackerEnabled: boolean;
  featureXTrackerEnabled: boolean;
  featureGovernanceEnabled: boolean;
  // Page meta
  pageTitle: string;
  metaDescription: string;
}

// Convert DB row to BrandingConfig
function rowToConfig(row: any): BrandingConfig {
  return {
    id: row.id,
    brandName: row.brand_name,
    brandShortName: row.brand_short_name,
    tagline: row.tagline,
    description: row.description,
    domain: row.domain,
    appUrl: row.app_url,
    twitterHandle: row.twitter_handle,
    twitterUrl: row.twitter_url,
    discordUrl: row.discord_url,
    telegramUrl: row.telegram_url,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    ogImageUrl: row.og_image_url,
    iconEmoji: row.icon_emoji,
    forumName: row.forum_name,
    communityPrefix: row.community_prefix,
    agentBrandName: row.agent_brand_name,
    sdkName: row.sdk_name,
    platformTokenTicker: row.platform_token_ticker,
    platformTokenName: row.platform_token_name,
    platformTokenMint: row.platform_token_mint,
    colorPrimary: row.color_primary,
    colorAccent: row.color_accent,
    colorBackground: row.color_background,
    colorForeground: row.color_foreground,
    colorMuted: row.color_muted,
    fontFamily: row.font_family,
    featureForumEnabled: row.feature_forum_enabled,
    featureMerchEnabled: row.feature_merch_enabled,
    featureAgentsEnabled: row.feature_agents_enabled,
    featureLeverageEnabled: row.feature_leverage_enabled,
    featureAlphaTrackerEnabled: row.feature_alpha_tracker_enabled,
    featureXTrackerEnabled: row.feature_x_tracker_enabled,
    featureGovernanceEnabled: row.feature_governance_enabled,
    pageTitle: row.page_title,
    metaDescription: row.meta_description,
  };
}

// Default config from the static BRAND file
const DEFAULT_CONFIG: BrandingConfig = {
  id: "",
  brandName: BRAND.name,
  brandShortName: BRAND.shortName,
  tagline: BRAND.tagline,
  description: BRAND.description,
  domain: BRAND.domain,
  appUrl: BRAND.appUrl,
  twitterHandle: BRAND.twitterHandle,
  twitterUrl: BRAND.twitterUrl,
  discordUrl: null,
  telegramUrl: null,
  logoUrl: BRAND.logoPath,
  faviconUrl: BRAND.faviconPath,
  ogImageUrl: BRAND.ogImage,
  iconEmoji: BRAND.iconEmoji,
  forumName: BRAND.forumName,
  communityPrefix: BRAND.communityPrefix,
  agentBrandName: BRAND.agentBrandName,
  sdkName: BRAND.sdkName,
  platformTokenTicker: BRAND.platformTokenTicker,
  platformTokenName: BRAND.platformTokenName,
  platformTokenMint: BRAND.platformTokenMint,
  colorPrimary: "72 100% 50%",
  colorAccent: "45 100% 50%",
  colorBackground: "228 20% 6%",
  colorForeground: "0 0% 95%",
  colorMuted: "220 10% 40%",
  fontFamily: "IBM Plex Sans",
  featureForumEnabled: true,
  featureMerchEnabled: true,
  featureAgentsEnabled: true,
  featureLeverageEnabled: true,
  featureAlphaTrackerEnabled: true,
  featureXTrackerEnabled: true,
  featureGovernanceEnabled: true,
  pageTitle: "Saturn Trading Terminal - Solana and EVM",
  metaDescription: "Saturn Trade — Your one step trading Terminal and Launchpad on Solana and EVM.",
};

interface BrandingContextValue {
  config: BrandingConfig;
  isLoading: boolean;
  updateBranding: (updates: Partial<BrandingConfig>) => Promise<void>;
  isUpdating: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  config: DEFAULT_CONFIG,
  isLoading: false,
  updateBranding: async () => {},
  isUpdating: false,
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["branding-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branding_config" as any)
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();
      if (error || !data) return DEFAULT_CONFIG;
      return rowToConfig(data);
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<BrandingConfig>) => {
      // Convert camelCase to snake_case for DB
      const dbUpdates: Record<string, any> = {};
      const mapping: Record<string, string> = {
        brandName: "brand_name",
        brandShortName: "brand_short_name",
        tagline: "tagline",
        description: "description",
        domain: "domain",
        appUrl: "app_url",
        twitterHandle: "twitter_handle",
        twitterUrl: "twitter_url",
        discordUrl: "discord_url",
        telegramUrl: "telegram_url",
        logoUrl: "logo_url",
        faviconUrl: "favicon_url",
        ogImageUrl: "og_image_url",
        iconEmoji: "icon_emoji",
        forumName: "forum_name",
        communityPrefix: "community_prefix",
        agentBrandName: "agent_brand_name",
        sdkName: "sdk_name",
        platformTokenTicker: "platform_token_ticker",
        platformTokenName: "platform_token_name",
        platformTokenMint: "platform_token_mint",
        colorPrimary: "color_primary",
        colorAccent: "color_accent",
        colorBackground: "color_background",
        colorForeground: "color_foreground",
        colorMuted: "color_muted",
        fontFamily: "font_family",
        featureForumEnabled: "feature_forum_enabled",
        featureMerchEnabled: "feature_merch_enabled",
        featureAgentsEnabled: "feature_agents_enabled",
        featureLeverageEnabled: "feature_leverage_enabled",
        featureAlphaTrackerEnabled: "feature_alpha_tracker_enabled",
        featureXTrackerEnabled: "feature_x_tracker_enabled",
        featureGovernanceEnabled: "feature_governance_enabled",
        pageTitle: "page_title",
        metaDescription: "meta_description",
      };
      for (const [key, val] of Object.entries(updates)) {
        if (mapping[key]) dbUpdates[mapping[key]] = val;
      }
      dbUpdates.updated_at = new Date().toISOString();

      const currentId = config?.id || (await supabase
        .from("branding_config" as any)
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single()
        .then(r => (r.data as any)?.id));

      const { error } = await (supabase
        .from("branding_config" as any) as any)
        .update(dbUpdates)
        .eq("id", currentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branding-config"] });
    },
  });

  return (
    <BrandingContext.Provider
      value={{
        config: config || DEFAULT_CONFIG,
        isLoading,
        updateBranding: mutation.mutateAsync,
        isUpdating: mutation.isPending,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
