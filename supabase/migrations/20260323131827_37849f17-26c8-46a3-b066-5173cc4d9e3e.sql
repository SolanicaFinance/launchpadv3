
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('btc-token-images', 'btc-token-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view btc token images" ON storage.objects FOR SELECT USING (bucket_id = 'btc-token-images');
CREATE POLICY "Anyone can upload btc token images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'btc-token-images');
