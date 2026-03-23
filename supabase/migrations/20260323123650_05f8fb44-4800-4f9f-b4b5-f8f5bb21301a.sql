
-- BTC Meme Token System: Internal Pools with Bonding Curve
-- Mirrors Solana fun_tokens architecture but denominated in BTC (satoshis)

-- 1. BTC Meme Tokens (the token registry)
CREATE TABLE public.btc_meme_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  website_url TEXT,
  twitter_url TEXT,
  creator_wallet TEXT NOT NULL,
  
  total_supply NUMERIC NOT NULL DEFAULT 1000000000,
  virtual_btc_reserves NUMERIC NOT NULL DEFAULT 0.0005,
  virtual_token_reserves NUMERIC NOT NULL DEFAULT 1000000000,
  real_btc_reserves NUMERIC NOT NULL DEFAULT 0,
  real_token_reserves NUMERIC NOT NULL DEFAULT 800000000,
  
  price_btc NUMERIC NOT NULL DEFAULT 0.0000000005,
  market_cap_btc NUMERIC NOT NULL DEFAULT 0.0005,
  price_usd NUMERIC DEFAULT 0,
  market_cap_usd NUMERIC DEFAULT 0,
  
  graduation_threshold_btc NUMERIC NOT NULL DEFAULT 0.015,
  bonding_progress NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  graduated_at TIMESTAMPTZ,
  
  platform_fee_bps INTEGER NOT NULL DEFAULT 100,
  creator_fee_bps INTEGER NOT NULL DEFAULT 100,
  
  holder_count INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  volume_btc NUMERIC NOT NULL DEFAULT 0,
  
  genesis_txid TEXT,
  last_anchor_txid TEXT,
  last_anchor_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. BTC Meme Balances
CREATE TABLE public.btc_meme_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.btc_meme_tokens(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  avg_buy_price_btc NUMERIC DEFAULT 0,
  total_bought NUMERIC DEFAULT 0,
  total_sold NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_id, wallet_address)
);

-- 3. BTC Meme Trades
CREATE TABLE public.btc_meme_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.btc_meme_tokens(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  btc_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  price_btc NUMERIC NOT NULL,
  price_usd NUMERIC DEFAULT 0,
  fee_btc NUMERIC NOT NULL DEFAULT 0,
  pool_virtual_btc NUMERIC,
  pool_virtual_tokens NUMERIC,
  pool_real_btc NUMERIC,
  bonding_progress NUMERIC,
  market_cap_btc NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. BTC Trading Balances
CREATE TABLE public.btc_trading_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  balance_btc NUMERIC NOT NULL DEFAULT 0,
  total_deposited NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_btc_meme_tokens_status ON public.btc_meme_tokens(status);
CREATE INDEX idx_btc_meme_tokens_created ON public.btc_meme_tokens(created_at DESC);
CREATE INDEX idx_btc_meme_tokens_mcap ON public.btc_meme_tokens(market_cap_btc DESC);
CREATE INDEX idx_btc_meme_balances_wallet ON public.btc_meme_balances(wallet_address);
CREATE INDEX idx_btc_meme_balances_token ON public.btc_meme_balances(token_id);
CREATE INDEX idx_btc_meme_trades_token ON public.btc_meme_trades(token_id, created_at DESC);
CREATE INDEX idx_btc_meme_trades_wallet ON public.btc_meme_trades(wallet_address);

-- Enable RLS
ALTER TABLE public.btc_meme_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btc_meme_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btc_meme_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.btc_trading_balances ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read btc meme tokens" ON public.btc_meme_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can read btc meme trades" ON public.btc_meme_trades FOR SELECT USING (true);
CREATE POLICY "Anyone can read btc meme balances" ON public.btc_meme_balances FOR SELECT USING (true);
CREATE POLICY "Anyone can read btc trading balances" ON public.btc_trading_balances FOR SELECT USING (true);

-- Enable realtime for trades and tokens
ALTER PUBLICATION supabase_realtime ADD TABLE public.btc_meme_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.btc_meme_tokens;
