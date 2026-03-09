
-- KOL Accounts table
CREATE TABLE public.kol_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  display_name text,
  profile_image_url text,
  last_scanned_tweet_id text,
  last_scanned_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kol_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read kol_accounts" ON public.kol_accounts
  FOR SELECT TO anon, authenticated USING (true);

-- KOL Contract Tweets table
CREATE TABLE public.kol_contract_tweets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_account_id uuid REFERENCES public.kol_accounts(id) ON DELETE CASCADE NOT NULL,
  tweet_id text UNIQUE NOT NULL,
  tweet_text text,
  tweet_url text,
  contract_address text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  kol_username text NOT NULL,
  kol_profile_image text,
  token_name text,
  token_symbol text,
  token_image_url text,
  token_price_usd numeric,
  token_market_cap numeric,
  tweeted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kol_contract_tweets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read kol_contract_tweets" ON public.kol_contract_tweets
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_kol_contract_tweets_created ON public.kol_contract_tweets(created_at DESC);
CREATE INDEX idx_kol_contract_tweets_chain ON public.kol_contract_tweets(chain);
