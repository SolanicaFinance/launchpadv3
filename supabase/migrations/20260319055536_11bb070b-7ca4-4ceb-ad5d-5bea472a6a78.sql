
CREATE TABLE public.dex_listed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address text NOT NULL UNIQUE,
  pool_address text NOT NULL,
  token_name text,
  token_ticker text,
  image_url text,
  description text,
  website_url text,
  twitter_url text,
  telegram_url text,
  discord_url text,
  market_cap numeric,
  liquidity_usd numeric,
  max_leverage integer NOT NULL DEFAULT 1,
  dex_source text DEFAULT 'dexscreener',
  is_active boolean DEFAULT true,
  listed_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dex_listed_tokens ENABLE ROW LEVEL SECURITY;

-- Validation trigger for max_leverage instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_dex_listed_token_leverage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.max_leverage < 1 OR NEW.max_leverage > 50 THEN
    RAISE EXCEPTION 'max_leverage must be between 1 and 50';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_dex_leverage
  BEFORE INSERT OR UPDATE ON public.dex_listed_tokens
  FOR EACH ROW EXECUTE FUNCTION public.validate_dex_listed_token_leverage();
