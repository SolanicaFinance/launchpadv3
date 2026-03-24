-- Withdrawal ledger with atomic locking and audit trail
CREATE TABLE public.btc_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount_btc numeric NOT NULL CHECK (amount_btc > 0),
  fee_sats bigint DEFAULT 0,
  txid text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'broadcasting', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Index for rate limiting queries
CREATE INDEX idx_btc_withdrawals_wallet_created ON public.btc_withdrawals(wallet_address, created_at DESC);
CREATE INDEX idx_btc_withdrawals_status ON public.btc_withdrawals(status);

-- Unique partial index: only one pending/broadcasting withdrawal per wallet at a time
CREATE UNIQUE INDEX idx_btc_withdrawals_active_lock ON public.btc_withdrawals(wallet_address)
  WHERE status IN ('pending', 'broadcasting');

-- RLS: service_role only (edge function access)
ALTER TABLE public.btc_withdrawals ENABLE ROW LEVEL SECURITY;

-- Atomic balance deduction function to prevent race conditions
CREATE OR REPLACE FUNCTION public.deduct_btc_balance(
  p_wallet text,
  p_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected int;
BEGIN
  UPDATE btc_trading_balances
  SET balance_btc = balance_btc - p_amount,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at = now()
  WHERE wallet_address = p_wallet
    AND balance_btc >= p_amount
    AND (total_deposited - total_withdrawn) >= p_amount;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;