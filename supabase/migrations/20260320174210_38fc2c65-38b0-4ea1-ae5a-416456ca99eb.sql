
-- Lab pools for bonding curve testing
CREATE TABLE public.lab_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  image_url TEXT,
  mint_address TEXT,
  pool_address TEXT,
  creator_wallet TEXT NOT NULL,
  virtual_sol_reserves NUMERIC NOT NULL DEFAULT 30,
  virtual_token_reserves NUMERIC NOT NULL DEFAULT 1000000000,
  real_sol_reserves NUMERIC NOT NULL DEFAULT 0,
  real_token_reserves NUMERIC NOT NULL DEFAULT 0,
  graduation_threshold_sol NUMERIC NOT NULL DEFAULT 1,
  bonding_progress NUMERIC NOT NULL DEFAULT 0,
  price_sol NUMERIC NOT NULL DEFAULT 0,
  market_cap_sol NUMERIC NOT NULL DEFAULT 0,
  volume_total_sol NUMERIC NOT NULL DEFAULT 0,
  holder_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  graduated_at TIMESTAMPTZ,
  damm_pool_address TEXT,
  lp_locked BOOLEAN DEFAULT FALSE,
  lp_lock_tx TEXT,
  fee_bps INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lab trades for bonding curve testing
CREATE TABLE public.lab_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.lab_pools(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  is_buy BOOLEAN NOT NULL,
  sol_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  price_at_trade NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.lab_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_trades ENABLE ROW LEVEL SECURITY;

-- Public read for lab data (admin-only writes via edge functions)
CREATE POLICY "Anyone can read lab pools" ON public.lab_pools FOR SELECT USING (true);
CREATE POLICY "Anyone can read lab trades" ON public.lab_trades FOR SELECT USING (true);
