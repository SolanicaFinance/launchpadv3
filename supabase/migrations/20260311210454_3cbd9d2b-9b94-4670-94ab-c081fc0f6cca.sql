
CREATE TABLE public.branding_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core identity
  brand_name TEXT NOT NULL DEFAULT 'Saturn Trade',
  brand_short_name TEXT NOT NULL DEFAULT 'Saturn',
  tagline TEXT DEFAULT 'The fastest AI-powered trading terminal on Solana',
  description TEXT DEFAULT 'Autonomous AI agents that launch tokens and trade on Solana.',
  
  -- Domain & URLs
  domain TEXT DEFAULT 'saturn.trade',
  app_url TEXT DEFAULT 'https://saturntrade.lovable.app',
  
  -- Social links
  twitter_handle TEXT DEFAULT '@saturntrade',
  twitter_url TEXT DEFAULT 'https://x.com/saturntrade',
  discord_url TEXT,
  telegram_url TEXT,
  
  -- Assets (URLs/paths)
  logo_url TEXT DEFAULT '/saturn-logo.png',
  favicon_url TEXT DEFAULT '/favicon.png',
  og_image_url TEXT DEFAULT 'https://saturn.trade/saturn-og.png',
  icon_emoji TEXT DEFAULT '🪐',
  
  -- Feature names
  forum_name TEXT DEFAULT 'Saturn Forum',
  community_prefix TEXT DEFAULT 't/',
  agent_brand_name TEXT DEFAULT 'Saturn Agents',
  sdk_name TEXT DEFAULT '@saturntrade/sdk',
  
  -- Token
  platform_token_ticker TEXT DEFAULT 'CLAW',
  platform_token_name TEXT DEFAULT 'CLAW',
  platform_token_mint TEXT DEFAULT 'GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump',
  
  -- Theme/Colors (HSL values)
  color_primary TEXT DEFAULT '72 100% 50%',
  color_accent TEXT DEFAULT '45 100% 50%',
  color_background TEXT DEFAULT '228 20% 6%',
  color_foreground TEXT DEFAULT '0 0% 95%',
  color_muted TEXT DEFAULT '220 10% 40%',
  font_family TEXT DEFAULT 'IBM Plex Sans',
  
  -- Feature toggles
  feature_forum_enabled BOOLEAN DEFAULT true,
  feature_merch_enabled BOOLEAN DEFAULT true,
  feature_agents_enabled BOOLEAN DEFAULT true,
  feature_leverage_enabled BOOLEAN DEFAULT true,
  feature_alpha_tracker_enabled BOOLEAN DEFAULT true,
  feature_x_tracker_enabled BOOLEAN DEFAULT true,
  feature_governance_enabled BOOLEAN DEFAULT true,
  
  -- Page content
  page_title TEXT DEFAULT 'Saturn Trading Terminal - Solana and EVM',
  meta_description TEXT DEFAULT 'Saturn Trade — Your one step trading Terminal and Launchpad on Solana and EVM.',
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow public read (branding is public-facing)
ALTER TABLE public.branding_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branding" ON public.branding_config
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage branding" ON public.branding_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Insert default config
INSERT INTO public.branding_config (id) VALUES (gen_random_uuid());
