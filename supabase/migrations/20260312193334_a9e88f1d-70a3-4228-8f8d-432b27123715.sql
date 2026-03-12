
CREATE TABLE public.social_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  privy_did TEXT NOT NULL,
  twitter_username TEXT NOT NULL,
  twitter_name TEXT,
  twitter_avatar_url TEXT,
  twitter_followers INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_post_id TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(twitter_username)
);

ALTER TABLE public.social_rewards ENABLE ROW LEVEL SECURITY;

-- Anyone can read total counts
CREATE POLICY "Anyone can read social_rewards" ON public.social_rewards FOR SELECT USING (true);

-- Only backend can insert/update (via service role)
CREATE POLICY "Service role can manage social_rewards" ON public.social_rewards FOR ALL USING (true) WITH CHECK (true);

-- Table for individual reward events
CREATE TABLE public.social_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_reward_id UUID REFERENCES public.social_rewards(id) ON DELETE CASCADE NOT NULL,
  post_id TEXT NOT NULL,
  post_url TEXT,
  reward_type TEXT NOT NULL, -- 'moon_mention', 'moondexo_tag'
  points INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(social_reward_id, post_id, reward_type)
);

ALTER TABLE public.social_reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reward events" ON public.social_reward_events FOR SELECT USING (true);
CREATE POLICY "Service role can manage reward events" ON public.social_reward_events FOR ALL USING (true) WITH CHECK (true);
