-- Update reserve function to match exact suffix (case-sensitive)
CREATE OR REPLACE FUNCTION public.backend_reserve_vanity_address(p_suffix text)
 RETURNS TABLE(id uuid, public_key text, secret_key_encrypted text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT vk.id, vk.public_key, vk.secret_key_encrypted INTO v_record
  FROM public.vanity_keypairs vk
  WHERE vk.suffix = p_suffix AND vk.status = 'available'
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_record IS NULL THEN
    RETURN;
  END IF;
  
  UPDATE public.vanity_keypairs SET status = 'reserved' WHERE vanity_keypairs.id = v_record.id;
  
  RETURN QUERY SELECT v_record.id, v_record.public_key, v_record.secret_key_encrypted;
END;
$$;

-- Update insert function to store suffix as-is (not lowered)
CREATE OR REPLACE FUNCTION public.backend_insert_vanity_keypair(p_suffix text, p_public_key text, p_secret_key_encrypted text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.vanity_keypairs (suffix, public_key, secret_key_encrypted, status)
  VALUES (p_suffix, p_public_key, p_secret_key_encrypted, 'available')
  RETURNING id INTO v_id;
  
  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NULL;
END;
$$;

-- Update stats function to match exact suffix
CREATE OR REPLACE FUNCTION public.backend_get_vanity_stats(p_suffix text DEFAULT NULL::text)
 RETURNS TABLE(total bigint, available bigint, reserved bigint, used bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'available')::BIGINT as available,
    COUNT(*) FILTER (WHERE status = 'reserved')::BIGINT as reserved,
    COUNT(*) FILTER (WHERE status = 'used')::BIGINT as used
  FROM public.vanity_keypairs
  WHERE (p_suffix IS NULL OR suffix = p_suffix);
END;
$$;