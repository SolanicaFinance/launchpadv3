CREATE TABLE public.dex_listing_x_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_cookie_encrypted text DEFAULT '',
  socks5_urls text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dex_listing_x_config ENABLE ROW LEVEL SECURITY;