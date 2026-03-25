
-- =============================================
-- SATURN PERPETUALS ENGINE - CORE SCHEMA
-- =============================================

-- Market status enum
CREATE TYPE public.perp_market_status AS ENUM ('pending', 'active', 'paused', 'closed');
CREATE TYPE public.perp_position_side AS ENUM ('long', 'short');
CREATE TYPE public.perp_position_status AS ENUM ('open', 'closed', 'liquidated');
CREATE TYPE public.perp_order_type AS ENUM ('market', 'limit');
CREATE TYPE public.perp_order_status AS ENUM ('pending', 'filled', 'cancelled', 'failed');

-- =============================================
-- 1. PERP MARKETS - Each token gets its own market
-- =============================================
CREATE TABLE public.perp_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Token info
  token_address TEXT NOT NULL UNIQUE,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_image_url TEXT,
  token_decimals INT DEFAULT 18,
  chain TEXT NOT NULL DEFAULT 'bsc',
  -- DEX info
  dex_pair_address TEXT,
  dex_base_token TEXT,
  dex_quote_token TEXT,
  -- Market parameters (auto-computed from vault size)
  max_leverage INT NOT NULL DEFAULT 2,
  max_position_usd NUMERIC NOT NULL DEFAULT 5,
  max_open_interest_usd NUMERIC NOT NULL DEFAULT 500,
  spread_pct NUMERIC NOT NULL DEFAULT 0.50,
  fee_pct NUMERIC NOT NULL DEFAULT 0.30,
  min_fee_usd NUMERIC NOT NULL DEFAULT 1.00,
  min_collateral_usd NUMERIC NOT NULL DEFAULT 1.00,
  insurance_floor_pct NUMERIC NOT NULL DEFAULT 10.00,
  -- Vault state
  vault_balance_usd NUMERIC NOT NULL DEFAULT 0,
  insurance_balance_usd NUMERIC NOT NULL DEFAULT 0,
  -- Creator info
  creator_wallet TEXT NOT NULL,
  creator_fee_share_pct NUMERIC NOT NULL DEFAULT 60.00,
  total_fees_earned_usd NUMERIC NOT NULL DEFAULT 0,
  total_fees_claimed_usd NUMERIC NOT NULL DEFAULT 0,
  -- Lock
  lock_duration_days INT DEFAULT 30,
  lock_expires_at TIMESTAMPTZ,
  -- Stats
  total_volume_usd NUMERIC NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  total_long_oi_usd NUMERIC NOT NULL DEFAULT 0,
  total_short_oi_usd NUMERIC NOT NULL DEFAULT 0,
  -- Oracle
  last_price_usd NUMERIC,
  last_price_updated_at TIMESTAMPTZ,
  -- Market cap eligibility
  market_cap_usd NUMERIC,
  liquidity_usd NUMERIC,
  -- Status
  status perp_market_status NOT NULL DEFAULT 'pending',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. PERP VAULT DEPOSITS - Track vault funding
-- =============================================
CREATE TABLE public.perp_vault_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.perp_markets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  tx_hash TEXT,
  deposit_type TEXT NOT NULL DEFAULT 'initial', -- initial, topup, withdrawal
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. PERP POSITIONS - Open and closed positions
-- =============================================
CREATE TABLE public.perp_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.perp_markets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  side perp_position_side NOT NULL,
  leverage INT NOT NULL DEFAULT 1,
  collateral_usd NUMERIC NOT NULL,
  size_usd NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  liquidation_price NUMERIC,
  take_profit_price NUMERIC,
  stop_loss_price NUMERIC,
  -- PnL
  realized_pnl_usd NUMERIC DEFAULT 0,
  close_price NUMERIC,
  fee_paid_usd NUMERIC NOT NULL DEFAULT 0,
  -- Status
  status perp_position_status NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- =============================================
-- 4. PERP TRADES - Trade history log
-- =============================================
CREATE TABLE public.perp_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES public.perp_positions(id) ON DELETE SET NULL,
  market_id UUID NOT NULL REFERENCES public.perp_markets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  side perp_position_side NOT NULL,
  action TEXT NOT NULL DEFAULT 'open', -- open, close, liquidate
  price NUMERIC NOT NULL,
  size_usd NUMERIC NOT NULL,
  collateral_usd NUMERIC NOT NULL,
  fee_usd NUMERIC NOT NULL DEFAULT 0,
  pnl_usd NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. PERP PRICE CACHE - Oracle prices
-- =============================================
CREATE TABLE public.perp_price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'bsc',
  price_usd NUMERIC NOT NULL,
  price_change_24h NUMERIC,
  volume_24h NUMERIC,
  market_cap NUMERIC,
  liquidity NUMERIC,
  source TEXT NOT NULL DEFAULT 'dexscreener',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token_address, chain)
);

-- =============================================
-- 6. PERP FEE CLAIMS - Creator fee withdrawals
-- =============================================
CREATE TABLE public.perp_fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.perp_markets(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  tx_hash TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 7. PERP TRADER BALANCES - USDT balances for trading
-- =============================================
CREATE TABLE public.perp_trader_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  balance_usd NUMERIC NOT NULL DEFAULT 0,
  total_deposited_usd NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn_usd NUMERIC NOT NULL DEFAULT 0,
  total_pnl_usd NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_perp_markets_status ON public.perp_markets(status);
CREATE INDEX idx_perp_markets_chain ON public.perp_markets(chain);
CREATE INDEX idx_perp_markets_creator ON public.perp_markets(creator_wallet);
CREATE INDEX idx_perp_positions_market ON public.perp_positions(market_id);
CREATE INDEX idx_perp_positions_wallet ON public.perp_positions(wallet_address);
CREATE INDEX idx_perp_positions_status ON public.perp_positions(status);
CREATE INDEX idx_perp_trades_market ON public.perp_trades(market_id);
CREATE INDEX idx_perp_trades_wallet ON public.perp_trades(wallet_address);
CREATE INDEX idx_perp_price_cache_token ON public.perp_price_cache(token_address);
CREATE INDEX idx_perp_trader_balances_wallet ON public.perp_trader_balances(wallet_address);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.perp_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perp_vault_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perp_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perp_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perp_price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perp_fee_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perp_trader_balances ENABLE ROW LEVEL SECURITY;

-- Markets are publicly readable
CREATE POLICY "Anyone can view active markets" ON public.perp_markets FOR SELECT USING (true);

-- Price cache is publicly readable
CREATE POLICY "Anyone can view prices" ON public.perp_price_cache FOR SELECT USING (true);

-- Vault deposits are publicly readable (transparency)
CREATE POLICY "Anyone can view vault deposits" ON public.perp_vault_deposits FOR SELECT USING (true);

-- Trades are publicly readable (transparency)
CREATE POLICY "Anyone can view trades" ON public.perp_trades FOR SELECT USING (true);

-- Positions are publicly readable
CREATE POLICY "Anyone can view positions" ON public.perp_positions FOR SELECT USING (true);

-- Fee claims publicly readable
CREATE POLICY "Anyone can view fee claims" ON public.perp_fee_claims FOR SELECT USING (true);

-- Trader balances publicly readable
CREATE POLICY "Anyone can view trader balances" ON public.perp_trader_balances FOR SELECT USING (true);

-- Enable realtime for positions and markets
ALTER PUBLICATION supabase_realtime ADD TABLE public.perp_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perp_markets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perp_price_cache;
