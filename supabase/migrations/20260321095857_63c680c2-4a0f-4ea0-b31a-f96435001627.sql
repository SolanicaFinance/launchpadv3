
DROP VIEW IF EXISTS public.meteorite_tokens_safe;

ALTER TABLE public.meteorite_tokens 
ADD COLUMN IF NOT EXISTS owner_claimed_at timestamptz,
ADD COLUMN IF NOT EXISTS owner_claimed_sol numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS owner_claim_wallet text,
ADD COLUMN IF NOT EXISTS owner_claim_signature text;

ALTER TABLE public.meteorite_reply_claims
ADD COLUMN IF NOT EXISTS claim_wallet_address text,
ADD COLUMN IF NOT EXISTS claim_tx_signature text;

CREATE VIEW public.meteorite_tokens_safe AS
SELECT id, tweet_url, tweet_id, tweet_author, tweet_content,
       token_name, token_ticker, token_description,
       mint_address, pumpfun_url, image_url, status,
       creator_wallet, total_fees_earned, error_message,
       created_at, updated_at, replies_last_refreshed_at,
       eligible_replies_count, owner_claimed_at, owner_claimed_sol
FROM public.meteorite_tokens;

GRANT SELECT ON public.meteorite_tokens_safe TO anon, authenticated;
