-- Dedicated screenshots storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('screenshots', 'screenshots', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Anyone can view screenshots"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'screenshots');

-- Service role write (worker uploads)
CREATE POLICY "Service role can upload screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Service role can update screenshots"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'screenshots');

-- screenshot_urls column on bots table
ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS screenshot_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
