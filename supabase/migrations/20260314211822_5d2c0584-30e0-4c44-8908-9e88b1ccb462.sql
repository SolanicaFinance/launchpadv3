CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_profile_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM referral_codes WHERE profile_id = p_profile_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  
  LOOP
    v_code := substr(md5(random()::text), 1, 6);
    BEGIN
      INSERT INTO referral_codes (profile_id, code) VALUES (p_profile_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$$;