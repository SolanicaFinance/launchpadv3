
CREATE TABLE public.btc_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rune_name TEXT NOT NULL,
  rune_symbol TEXT NOT NULL,
  supply BIGINT NOT NULL,
  divisibility INT DEFAULT 0,
  premine_pct NUMERIC DEFAULT 0,
  creator_wallet TEXT NOT NULL,
  etch_tx_hash TEXT,
  rune_id TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  avatar_url TEXT,
  lock_days INT DEFAULT 0,
  rugshield_score NUMERIC,
  platform_fee_bps INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.btc_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  btc_token_id UUID REFERENCES public.btc_tokens(id),
  trader_wallet TEXT NOT NULL,
  side TEXT NOT NULL,
  amount BIGINT NOT NULL,
  btc_amount NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.btc_token_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  btc_token_id UUID REFERENCES public.btc_tokens(id),
  wallet_address TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.btc_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btc_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btc_token_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read btc_tokens" ON public.btc_tokens FOR SELECT USING (true);
CREATE POLICY "Public read btc_trades" ON public.btc_trades FOR SELECT USING (true);
CREATE POLICY "Public read btc_token_comments" ON public.btc_token_comments FOR SELECT USING (true);
CREATE POLICY "Public insert btc_token_comments" ON public.btc_token_comments FOR INSERT WITH CHECK (true);
