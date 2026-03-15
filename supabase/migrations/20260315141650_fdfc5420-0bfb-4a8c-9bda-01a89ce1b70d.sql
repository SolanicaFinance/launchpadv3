
CREATE OR REPLACE FUNCTION public.record_referral(
  p_referral_code TEXT,
  p_referred_id UUID,
  p_referred_wallet TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT profile_id INTO v_referrer_id
  FROM referral_codes
  WHERE code = p_referral_code;

  IF v_referrer_id IS NULL THEN RETURN FALSE; END IF;
  IF v_referrer_id = p_referred_id THEN RETURN FALSE; END IF;

  INSERT INTO referrals (referrer_id, referred_id, referred_wallet)
  VALUES (v_referrer_id, p_referred_id, p_referred_wallet)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;
