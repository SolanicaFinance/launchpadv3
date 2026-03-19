
-- Campaign configuration and stats
CREATE TABLE public.dust_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Brand Awareness',
  wallet_address text NOT NULL,
  wallet_private_key_encrypted text NOT NULL,
  is_active boolean DEFAULT false,
  batch_size integer DEFAULT 10,
  lamports_per_recipient integer DEFAULT 1,
  total_sent bigint DEFAULT 0,
  total_unique_wallets bigint DEFAULT 0,
  total_sol_spent numeric DEFAULT 0,
  total_txs bigint DEFAULT 0,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dust_campaigns ENABLE ROW LEVEL SECURITY;

-- Track which wallets we've already dusted (dedup)
CREATE TABLE public.dust_sent_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.dust_campaigns(id) ON DELETE CASCADE NOT NULL,
  wallet_address text NOT NULL,
  tx_signature text,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.dust_sent_addresses ENABLE ROW LEVEL SECURITY;

-- Index for fast dedup lookups
CREATE UNIQUE INDEX idx_dust_sent_campaign_wallet ON public.dust_sent_addresses(campaign_id, wallet_address);

-- Run stats per execution (for monitoring)
CREATE TABLE public.dust_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.dust_campaigns(id) ON DELETE CASCADE NOT NULL,
  wallets_targeted integer DEFAULT 0,
  wallets_sent integer DEFAULT 0,
  txs_sent integer DEFAULT 0,
  sol_spent numeric DEFAULT 0,
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dust_run_log ENABLE ROW LEVEL SECURITY;
