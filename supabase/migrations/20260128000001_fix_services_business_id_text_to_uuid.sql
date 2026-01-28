-- Fix services.business_id type mismatch (TEXT -> UUID)
-- Context: all other tables use UUID business_id, but services.business_id is TEXT in this project.
-- This breaks RLS comparisons and app queries.

BEGIN;

-- 1) Ensure extension for gen_random_uuid exists (usually already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END $$;

-- 1.5) Drop policies that depend on services.business_id (TEXT) before we drop the column
-- This avoids: cannot drop column ... because other objects depend on it
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;
DROP POLICY IF EXISTS "Allow all operations on services" ON public.services;

-- 2) Add a temporary UUID column
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS business_id_uuid UUID;

-- 3) Backfill from the existing TEXT column where possible
-- Only cast values that look like UUIDs to avoid runtime cast errors.
UPDATE public.services
SET business_id_uuid = business_id::uuid
WHERE business_id_uuid IS NULL
  AND business_id IS NOT NULL
  AND business_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 4) If any rows are still NULL, assign them to Demo business as a safe fallback.
-- (You can change this behavior if you'd rather fail hard.)
UPDATE public.services
SET business_id_uuid = '00000000-0000-0000-0000-000000000001'::uuid
WHERE business_id_uuid IS NULL;

-- 5) Swap columns: drop old TEXT business_id and rename UUID column
-- Drop dependent indexes first (if any)
DO $$
BEGIN
  -- Some projects may have an index on services.business_id
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND indexname = 'idx_services_business_id'
  ) THEN
    EXECUTE 'DROP INDEX public.idx_services_business_id';
  END IF;
END $$;

ALTER TABLE public.services
DROP COLUMN IF EXISTS business_id;

ALTER TABLE public.services
RENAME COLUMN business_id_uuid TO business_id;

-- 6) Add FK + not null + index (now that it's UUID)
ALTER TABLE public.services
ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE public.services
ADD CONSTRAINT services_business_id_fkey
FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);

-- 7) Recreate RLS policies on services to use UUID comparisons (no casts)
-- (These names match our earlier migration naming; adjust if yours differ.)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access services from their business"
  ON public.services FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage services from their business"
  ON public.services FOR ALL
  USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;

