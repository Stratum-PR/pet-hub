BEGIN;

-- Backfill profile links for legacy rows where clients.id was set to auth user id.
UPDATE public.clients c
SET profile_id = c.id
WHERE c.profile_id IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.id);

-- Clients can belong to multiple businesses, so stop coupling profiles.business_id for role=client.
UPDATE public.profiles
SET business_id = NULL
WHERE role = 'client';

-- Keep one row per client profile per business.
CREATE UNIQUE INDEX IF NOT EXISTS clients_business_profile_unique
  ON public.clients (business_id, profile_id)
  WHERE profile_id IS NOT NULL;

DROP POLICY IF EXISTS "Clients can read own client row" ON public.clients;
CREATE POLICY "Clients can read own client row"
  ON public.clients FOR SELECT
  USING (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'client'
    )
  );

DROP POLICY IF EXISTS "Clients can update own client row" ON public.clients;
CREATE POLICY "Clients can update own client row"
  ON public.clients FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'client'
    )
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'client'
    )
  );

DROP POLICY IF EXISTS "Clients can read own pets" ON public.pets;
CREATE POLICY "Clients can read own pets"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
    )
  );

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
        AND c.business_id = pets.business_id
        AND p.role = 'client'
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
        AND c.business_id = pets.business_id
        AND p.role = 'client'
    )
  );

DROP POLICY IF EXISTS "Clients can delete own pets" ON public.pets;
CREATE POLICY "Clients can delete own pets"
  ON public.pets FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
    )
  );

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
        AND c.business_id = appointments.business_id
        AND p.role = 'client'
    )
  );

COMMIT;
