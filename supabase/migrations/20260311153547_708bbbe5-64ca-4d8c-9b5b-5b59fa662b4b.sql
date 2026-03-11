
-- Add cached_avatar_url column to kol_accounts
ALTER TABLE public.kol_accounts ADD COLUMN IF NOT EXISTS cached_avatar_url text;

-- Create storage bucket for KOL avatars (public, tiny images)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kol-avatars', 'kol-avatars', true, 102400)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to kol-avatars bucket
CREATE POLICY "Public read access for kol avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'kol-avatars');

-- Allow service role to insert/update kol avatars
CREATE POLICY "Service role can manage kol avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kol-avatars');

CREATE POLICY "Service role can update kol avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'kol-avatars');
