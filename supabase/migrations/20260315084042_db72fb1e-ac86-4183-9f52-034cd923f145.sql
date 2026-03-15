
CREATE TABLE IF NOT EXISTS public.creator_claim_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.creator_claim_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acquire_creator_claim_lock_by_wallet(
  p_wallet_address TEXT,
  p_duration_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM creator_claim_locks WHERE expires_at < now();
  
  INSERT INTO creator_claim_locks (wallet_address, locked_at, expires_at)
  VALUES (p_wallet_address, now(), now() + (p_duration_seconds || ' seconds')::interval)
  ON CONFLICT (wallet_address) DO NOTHING;
  
  RETURN EXISTS (
    SELECT 1 FROM creator_claim_locks 
    WHERE wallet_address = p_wallet_address 
    AND expires_at > now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_creator_claim_lock_by_wallet(
  p_wallet_address TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM creator_claim_locks WHERE wallet_address = p_wallet_address;
END;
$$;
