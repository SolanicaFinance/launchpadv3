CREATE TABLE public.meteorite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_url TEXT NOT NULL,
  tweet_id TEXT,
  tweet_author TEXT,
  tweet_content TEXT,
  token_name TEXT,
  token_ticker TEXT,
  token_description TEXT,
  mint_address TEXT,
  pumpfun_url TEXT,
  dev_wallet_address TEXT NOT NULL,
  dev_wallet_private_key TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  creator_wallet TEXT,
  payment_tx_signature TEXT,
  total_fees_earned NUMERIC DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE VIEW public.meteorite_tokens_safe AS
SELECT 
  id, tweet_url, tweet_id, tweet_author, tweet_content,
  token_name, token_ticker, token_description,
  mint_address, pumpfun_url, dev_wallet_address,
  image_url, status, creator_wallet, payment_tx_signature,
  total_fees_earned, error_message, created_at, updated_at
FROM public.meteorite_tokens;

ALTER TABLE public.meteorite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read meteorite tokens"
  ON public.meteorite_tokens FOR SELECT
  USING (true);