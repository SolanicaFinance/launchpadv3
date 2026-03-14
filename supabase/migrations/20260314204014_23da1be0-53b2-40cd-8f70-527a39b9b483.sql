
-- Create creator_fee_ledger table (append-only audit trail)
CREATE TABLE public.creator_fee_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID NOT NULL,
  fee_claim_id UUID,
  fee_claim_table TEXT NOT NULL DEFAULT 'fun_fee_claims',
  total_claimed_sol NUMERIC NOT NULL,
  creator_share_sol NUMERIC NOT NULL,
  platform_share_sol NUMERIC NOT NULL,
  creator_fee_bps INTEGER NOT NULL,
  trading_fee_bps INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  distribution_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT creator_fee_ledger_shares_sum CHECK (
    ABS(creator_share_sol + platform_share_sol - total_claimed_sol) < 0.000000002
  )
);

-- RLS: service-role only (no public access)
ALTER TABLE public.creator_fee_ledger ENABLE ROW LEVEL SECURITY;

-- Indexes for lookups
CREATE INDEX idx_creator_fee_ledger_token ON public.creator_fee_ledger(fun_token_id);
CREATE INDEX idx_creator_fee_ledger_status ON public.creator_fee_ledger(status);
CREATE INDEX idx_creator_fee_ledger_claim ON public.creator_fee_ledger(fee_claim_id, fee_claim_table);

-- Deterministic creator share calculation function
CREATE OR REPLACE FUNCTION public.calculate_creator_share(
  p_claimed_sol NUMERIC,
  p_creator_fee_bps INTEGER,
  p_trading_fee_bps INTEGER
) RETURNS TABLE(creator_sol NUMERIC, platform_sol NUMERIC)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_creator_ratio NUMERIC;
BEGIN
  IF p_trading_fee_bps IS NULL OR p_trading_fee_bps <= 0 THEN
    creator_sol := 0;
    platform_sol := p_claimed_sol;
  ELSE
    v_creator_ratio := COALESCE(p_creator_fee_bps, 0)::NUMERIC / p_trading_fee_bps::NUMERIC;
    creator_sol := FLOOR(p_claimed_sol * v_creator_ratio * 1e9) / 1e9;
    platform_sol := p_claimed_sol - creator_sol;
  END IF;
  RETURN NEXT;
END;
$$;

-- Backfill from fun_fee_claims
INSERT INTO public.creator_fee_ledger (fun_token_id, fee_claim_id, fee_claim_table, total_claimed_sol, creator_share_sol, platform_share_sol, creator_fee_bps, trading_fee_bps, status, created_at)
SELECT 
  fc.fun_token_id,
  fc.id,
  'fun_fee_claims',
  fc.claimed_sol,
  (SELECT cs.creator_sol FROM public.calculate_creator_share(fc.claimed_sol, COALESCE(ft.creator_fee_bps, 100), COALESCE(ft.trading_fee_bps, 200)) cs),
  (SELECT cs.platform_sol FROM public.calculate_creator_share(fc.claimed_sol, COALESCE(ft.creator_fee_bps, 100), COALESCE(ft.trading_fee_bps, 200)) cs),
  COALESCE(ft.creator_fee_bps, 100),
  COALESCE(ft.trading_fee_bps, 200),
  CASE WHEN fc.creator_distributed = true THEN 'distributed' ELSE 'pending' END,
  COALESCE(fc.claimed_at, fc.created_at, now())
FROM public.fun_fee_claims fc
JOIN public.fun_tokens ft ON fc.fun_token_id = ft.id
WHERE fc.claimed_sol > 0;

-- Backfill from claw_fee_claims
INSERT INTO public.creator_fee_ledger (fun_token_id, fee_claim_id, fee_claim_table, total_claimed_sol, creator_share_sol, platform_share_sol, creator_fee_bps, trading_fee_bps, status, created_at)
SELECT 
  cfc.fun_token_id,
  cfc.id,
  'claw_fee_claims',
  cfc.claimed_sol,
  (SELECT cs.creator_sol FROM public.calculate_creator_share(cfc.claimed_sol, COALESCE(ct.creator_fee_bps, 100), COALESCE(ct.trading_fee_bps, 200)) cs),
  (SELECT cs.platform_sol FROM public.calculate_creator_share(cfc.claimed_sol, COALESCE(ct.creator_fee_bps, 100), COALESCE(ct.trading_fee_bps, 200)) cs),
  COALESCE(ct.creator_fee_bps, 100),
  COALESCE(ct.trading_fee_bps, 200),
  CASE WHEN cfc.creator_distributed = true THEN 'distributed' ELSE 'pending' END,
  COALESCE(cfc.claimed_at, cfc.created_at, now())
FROM public.claw_fee_claims cfc
JOIN public.claw_tokens ct ON cfc.fun_token_id = ct.id
WHERE cfc.claimed_sol > 0;
