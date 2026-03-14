
ALTER TABLE public.kol_accounts 
ADD COLUMN IF NOT EXISTS follower_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'curated',
ADD COLUMN IF NOT EXISTS added_at timestamptz DEFAULT now();
