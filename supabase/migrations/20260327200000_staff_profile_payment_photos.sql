-- Staff profile photos (same bucket settings as pet-photos), compensation type, and payment / bank fields.

BEGIN;

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS compensation_type text;
UPDATE public.staff SET compensation_type = 'hourly' WHERE compensation_type IS NULL;
ALTER TABLE public.staff ALTER COLUMN compensation_type SET DEFAULT 'hourly';
ALTER TABLE public.staff ALTER COLUMN compensation_type SET NOT NULL;
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_compensation_type_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_compensation_type_check
  CHECK (compensation_type IN ('hourly', 'commission'));

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS commission_rate numeric;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bank_routing_number text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS payment_notes text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-photos',
  'staff-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view staff photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload staff photos to own business folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update staff photos in own business folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete staff photos in own business folder" ON storage.objects;

CREATE POLICY "Public can view staff photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'staff-photos');

CREATE POLICY "Authenticated users can upload staff photos to own business folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'staff-photos'
  AND (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can update staff photos in own business folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
    OR (name NOT LIKE '%/%' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
  )
)
WITH CHECK (
  bucket_id = 'staff-photos'
  AND (
    (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
    OR (name NOT LIKE '%/%' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
  )
);

CREATE POLICY "Authenticated users can delete staff photos in own business folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'staff-photos'
  AND (
    (storage.foldername(name))[1] = (SELECT business_id::text FROM public.profiles WHERE id = auth.uid())
    OR (name NOT LIKE '%/%' AND (owner_id = auth.uid()::text OR owner_id IS NULL))
  )
);

COMMIT;
