
-- Table to cache eligible replies from tweets (refreshed every 5 min on click)
CREATE TABLE public.meteorite_eligible_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meteorite_token_id UUID NOT NULL REFERENCES public.meteorite_tokens(id) ON DELETE CASCADE,
  twitter_username TEXT NOT NULL,
  twitter_display_name TEXT,
  twitter_avatar_url TEXT,
  verified_type TEXT NOT NULL DEFAULT 'blue', -- blue or gold
  is_shadowbanned BOOLEAN NOT NULL DEFAULT false,
  reply_text TEXT,
  reply_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meteorite_token_id, twitter_username)
);

-- Table to track $1 claims per verified replier per token
CREATE TABLE public.meteorite_reply_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meteorite_token_id UUID NOT NULL REFERENCES public.meteorite_tokens(id) ON DELETE CASCADE,
  twitter_username TEXT NOT NULL,
  claim_amount_sol NUMERIC NOT NULL DEFAULT 0,
  claim_wallet TEXT,
  claim_signature TEXT,
  status TEXT NOT NULL DEFAULT 'unclaimed', -- unclaimed, claimed, failed
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meteorite_token_id, twitter_username)
);

-- Track when replies were last refreshed per token
ALTER TABLE public.meteorite_tokens ADD COLUMN IF NOT EXISTS replies_last_refreshed_at TIMESTAMPTZ;
ALTER TABLE public.meteorite_tokens ADD COLUMN IF NOT EXISTS eligible_replies_count INTEGER DEFAULT 0;

-- RLS
ALTER TABLE public.meteorite_eligible_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meteorite_reply_claims ENABLE ROW LEVEL SECURITY;

-- Public read access for eligible replies (no secrets)
CREATE POLICY "Anyone can read eligible replies" ON public.meteorite_eligible_replies FOR SELECT USING (true);
CREATE POLICY "Anyone can read claims" ON public.meteorite_reply_claims FOR SELECT USING (true);

-- Service role only for writes (edge functions)
CREATE POLICY "Service role inserts replies" ON public.meteorite_eligible_replies FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role updates replies" ON public.meteorite_eligible_replies FOR UPDATE USING (false);
CREATE POLICY "Service role deletes replies" ON public.meteorite_eligible_replies FOR DELETE USING (false);
CREATE POLICY "Service role inserts claims" ON public.meteorite_reply_claims FOR INSERT WITH CHECK (false);
CREATE POLICY "Service role updates claims" ON public.meteorite_reply_claims FOR UPDATE USING (false);
