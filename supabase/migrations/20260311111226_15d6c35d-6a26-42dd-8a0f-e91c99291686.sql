
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS virtual_bnb_reserves numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_token_reserves numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS real_bnb_reserves numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS real_token_reserves numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS graduation_threshold_bnb numeric DEFAULT 16,
ADD COLUMN IF NOT EXISTS portal_address text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bonding_curve_type text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.backend_create_bnb_token(
  p_name text,
  p_ticker text,
  p_creator_wallet text,
  p_evm_token_address text,
  p_evm_pool_address text,
  p_evm_factory_tx_hash text,
  p_creator_fee_bps integer DEFAULT 5000,
  p_fair_launch_duration_mins integer DEFAULT 0,
  p_starting_mcap_usd numeric DEFAULT 5000,
  p_description text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_twitter_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.fun_tokens (
    name, ticker, creator_wallet, chain, chain_id,
    evm_token_address, evm_pool_address, evm_factory_tx_hash,
    creator_fee_bps, fair_launch_duration_mins,
    starting_mcap_usd, description, image_url, website_url, twitter_url,
    status, bonding_curve_type, portal_address,
    virtual_bnb_reserves, virtual_token_reserves,
    real_bnb_reserves, real_token_reserves,
    graduation_threshold_bnb
  ) VALUES (
    p_name, p_ticker, p_creator_wallet, 'bnb', 56,
    p_evm_token_address, p_evm_pool_address, p_evm_factory_tx_hash,
    p_creator_fee_bps, p_fair_launch_duration_mins,
    p_starting_mcap_usd, p_description, p_image_url, p_website_url, p_twitter_url,
    'active', 'constant_product', p_evm_pool_address,
    6.14, 107036752,
    0, 800000000,
    16
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;
