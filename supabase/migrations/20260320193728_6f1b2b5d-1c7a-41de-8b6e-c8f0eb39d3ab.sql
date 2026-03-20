CREATE TABLE public.mev_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  victim_signature text NOT NULL,
  frontrun_signature text,
  backrun_signature text,
  victim_wallet text,
  bot_wallet text,
  token_mint text,
  token_name text,
  bot_profit_sol numeric,
  victim_loss_sol numeric,
  bot_fees_sol numeric,
  jito_tip_sol numeric,
  slot bigint,
  block_time timestamptz,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mev_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on mev_analyses"
  ON public.mev_analyses FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on mev_analyses"
  ON public.mev_analyses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);