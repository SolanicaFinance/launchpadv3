
-- Create a deposit ledger to track verified on-chain deposits with idempotency
CREATE TABLE public.btc_deposit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount_btc numeric NOT NULL,
  txid text NOT NULL,
  vout integer NOT NULL DEFAULT 0,
  confirmed boolean NOT NULL DEFAULT false,
  block_height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(txid, vout)
);

ALTER TABLE public.btc_deposit_ledger ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read deposit ledger
CREATE POLICY "Service role only on deposit ledger"
  ON public.btc_deposit_ledger FOR ALL
  USING (false);
