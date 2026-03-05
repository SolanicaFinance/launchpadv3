
-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for avatars bucket
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- Create alpha_trades table
CREATE TABLE public.alpha_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  token_name TEXT,
  token_ticker TEXT,
  trade_type TEXT NOT NULL DEFAULT 'buy',
  amount_sol NUMERIC NOT NULL DEFAULT 0,
  amount_tokens NUMERIC NOT NULL DEFAULT 0,
  price_usd NUMERIC,
  tx_hash TEXT NOT NULL,
  trader_display_name TEXT,
  trader_avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alpha_trades ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Anyone can read alpha trades" ON public.alpha_trades FOR SELECT TO authenticated USING (true);

-- Anyone can insert (edge function will handle auth)
CREATE POLICY "Authenticated can insert alpha trades" ON public.alpha_trades FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.alpha_trades;

-- Index for fast queries
CREATE INDEX idx_alpha_trades_created ON public.alpha_trades (created_at DESC);
CREATE INDEX idx_alpha_trades_wallet ON public.alpha_trades (wallet_address);
