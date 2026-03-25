
-- Mentioner campaigns table
CREATE TABLE public.mentioner_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source_username TEXT NOT NULL,
  source_url TEXT,
  interval_minutes INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT false,
  socks5_url TEXT,
  total_targets INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  current_index INTEGER NOT NULL DEFAULT 0,
  pitch_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentioner targets (scraped @usernames)
CREATE TABLE public.mentioner_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.mentioner_campaigns(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  reply_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service_role only (admin edge function access)
ALTER TABLE public.mentioner_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentioner_targets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mentioner_targets_campaign ON public.mentioner_targets(campaign_id);
CREATE INDEX idx_mentioner_targets_status ON public.mentioner_targets(status);
