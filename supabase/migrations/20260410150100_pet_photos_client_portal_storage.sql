-- Client portal: profiles.role = client has business_id NULL; allow pet-photos under {auth.uid()}/...

BEGIN;

CREATE POLICY "Clients can upload pet photos to own user folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pet-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'client'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Clients can update pet photos in own user folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pet-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'client'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pet-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'client'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Clients can delete pet photos in own user folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pet-photos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'client'
  )
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
