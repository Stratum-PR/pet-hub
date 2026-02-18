-- Path-based Storage RLS for pet-photos (SECURITY-THREAT-ASSESSMENT Option A)
-- Upload path is now {business_id}/{filename}. Only the business that owns the path
-- can INSERT/UPDATE/DELETE. SELECT stays public so photo URLs work.
-- Legacy flat paths (no folder): only the object owner can UPDATE/DELETE.

BEGIN;

-- Drop existing broad storage policies for pet-photos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view pet photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload pet photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update pet photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete pet photos" ON storage.objects;
END $$;

-- Public read: anyone can view pet photos (needed for public image URLs)
CREATE POLICY "Public can view pet photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-photos');

-- INSERT: authenticated users can upload only under their business_id folder
-- Path must be {business_id}/... (first path segment = profile.business_id)
CREATE POLICY "Authenticated users can upload pet photos to own business folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pet-photos'
  AND (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
);

-- UPDATE: only within own business folder, or legacy flat file owned by self
CREATE POLICY "Authenticated users can update pet photos in own business folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pet-photos'
  AND (
    (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
    OR (name NOT LIKE '%/%' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
  )
)
WITH CHECK (
  bucket_id = 'pet-photos'
  AND (
    (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
    OR (name NOT LIKE '%/%' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
  )
);

-- DELETE: only within own business folder, or legacy flat file owned by self
CREATE POLICY "Authenticated users can delete pet photos in own business folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pet-photos'
  AND (
    (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
    OR (name NOT LIKE '%/%' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
  )
);

COMMIT;
