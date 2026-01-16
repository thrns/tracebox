-- Create storage buckets (run this if buckets don't exist yet)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('recordings', 'recordings', true, 524288000, ARRAY['video/webm', 'video/mp4', 'audio/webm']),
  ('instructions', 'instructions', false, 10485760, ARRAY['text/markdown', 'text/plain', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: instructions bucket
-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload instructions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'instructions'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can read own instructions"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'instructions'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete own instructions"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'instructions'
    AND auth.uid() IS NOT NULL
  );

-- Storage RLS: recordings bucket (public read, authenticated write)
CREATE POLICY "Anyone can view recordings"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recordings');

CREATE POLICY "Service role can upload recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recordings');

CREATE POLICY "Service role can update recordings"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recordings');
