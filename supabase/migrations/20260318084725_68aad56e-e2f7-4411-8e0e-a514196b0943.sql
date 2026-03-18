
INSERT INTO storage.buckets (id, name, public)
VALUES ('batch-launch-images', 'batch-launch-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read batch-launch-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'batch-launch-images');

CREATE POLICY "Allow upload batch-launch-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'batch-launch-images');
