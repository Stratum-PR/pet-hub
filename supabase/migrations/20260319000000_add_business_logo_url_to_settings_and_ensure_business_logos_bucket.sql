-- Add `business_logo_url` to our single-row-per-business settings table.
-- Also ensure the storage bucket used by the logo upload exists.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_logo_url TEXT;

-- Ensure the business logos storage bucket exists (some environments may be missing it).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for logo URLs (invoices, receipts)
DROP POLICY IF EXISTS "Public can view business logos" ON storage.objects;
CREATE POLICY "Public can view business logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-logos');

-- INSERT: authenticated users can upload only under their business_id folder
DROP POLICY IF EXISTS "Authenticated users can upload business logo" ON storage.objects;
CREATE POLICY "Authenticated users can upload business logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
);

-- UPDATE/DELETE: only within own business folder
DROP POLICY IF EXISTS "Authenticated users can update business logo" ON storage.objects;
CREATE POLICY "Authenticated users can update business logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can delete business logo" ON storage.objects;
CREATE POLICY "Authenticated users can delete business logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
);

