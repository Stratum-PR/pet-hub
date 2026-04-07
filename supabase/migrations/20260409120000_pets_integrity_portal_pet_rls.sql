-- 1) Re-link pets that still point at merged-away client rows
UPDATE public.pets p
SET client_id = c.merged_into_client_id
FROM public.clients c
WHERE p.client_id = c.id
  AND c.merged_into_client_id IS NOT NULL;

-- 2) Remove pets with no client row (orphans only)
DELETE FROM public.pets p
WHERE p.client_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p.client_id);

-- 3) NOT NULL on client_id (after cleanup)
ALTER TABLE public.pets
  ALTER COLUMN client_id SET NOT NULL;

-- 4) Replace FK with ON DELETE CASCADE
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'pets'
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND c.contype = 'f'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = t.oid
          AND a.attnum = ANY (c.conkey)
          AND a.attname = 'client_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES public.clients(id)
  ON DELETE CASCADE;

-- 5) Portal: allow global client (business_id NULL) to insert/update pets scoped to a linked business
DROP POLICY IF EXISTS "Clients can insert own pets" ON public.pets;
CREATE POLICY "Clients can insert own pets"
  ON public.pets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND (
          c.business_id IS NOT DISTINCT FROM pets.business_id
          OR (
            c.business_id IS NULL
            AND pets.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.business_client_links bcl
              WHERE bcl.user_id = auth.uid()
                AND bcl.business_id = pets.business_id
                AND bcl.status = 'approved'
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Clients can update own pets" ON public.pets;
CREATE POLICY "Clients can update own pets"
  ON public.pets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND (
          c.business_id IS NOT DISTINCT FROM pets.business_id
          OR (
            c.business_id IS NULL
            AND pets.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.business_client_links bcl
              WHERE bcl.user_id = auth.uid()
                AND bcl.business_id = pets.business_id
                AND bcl.status = 'approved'
            )
          )
          OR (c.business_id IS NULL AND pets.business_id IS NULL)
        )
    )
  );

-- 6) Appointments: NULL business_id on client matches "all businesses" for same client
DROP POLICY IF EXISTS "Clients can read own appointments" ON public.appointments;
CREATE POLICY "Clients can read own appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = appointments.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND (
          c.business_id IS NOT DISTINCT FROM appointments.business_id
          OR (
            c.business_id IS NULL
            AND appointments.business_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.business_client_links bcl
              WHERE bcl.user_id = auth.uid()
                AND bcl.business_id = appointments.business_id
                AND bcl.status = 'approved'
            )
          )
        )
    )
  );
