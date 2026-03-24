
-- Create btc-token-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('btc-token-images', 'btc-token-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read btc-token-images" ON storage.objects
FOR SELECT USING (bucket_id = 'btc-token-images');

-- Allow anyone to upload to btc-token-images
CREATE POLICY "Public upload btc-token-images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'btc-token-images');
