
CREATE TABLE public.mentioner_proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.mentioner_campaigns(id) ON DELETE SET NULL,
  nsocks_proxy_id TEXT NOT NULL,
  nsocks_history_id TEXT,
  ip_port TEXT NOT NULL,
  socks_auth TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  region TEXT,
  city TEXT,
  isp TEXT,
  ping INTEGER,
  price NUMERIC(6,2),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentioner_proxies ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mentioner_proxies_active ON public.mentioner_proxies(is_active, expires_at);
CREATE INDEX idx_mentioner_proxies_campaign ON public.mentioner_proxies(campaign_id);
