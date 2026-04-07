-- Client portal identity mapping + self-service RLS.
-- Keeps manager/staff behavior intact while enabling client-owned access.

BEGIN;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_business_profile_unique
  ON public.clients (business_id, profile_id)
  WHERE profile_id IS NOT NULL;

COMMENT ON COLUMN public.clients.profile_id IS
  'Auth profile linked to this client record for portal self-service access.';

-- Ensure role enum/check supports client in environments that missed prior migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_role_check;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('super_admin', 'manager', 'employee', 'client'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- clients: client can read/update their own row within scoped business context
-- ---------------------------------------------------------------------------
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
        AND p.business_id = clients.business_id
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
        AND p.business_id = clients.business_id
    )
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'client'
        AND p.business_id = clients.business_id
    )
  );

-- ---------------------------------------------------------------------------
-- pets: clients can manage pets attached to their own client record
-- ---------------------------------------------------------------------------
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
        AND p.business_id = c.business_id
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
        AND p.role = 'client'
        AND p.business_id = c.business_id
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
        AND p.business_id = c.business_id
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
        AND p.business_id = c.business_id
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
        AND p.business_id = c.business_id
    )
  );

-- ---------------------------------------------------------------------------
-- appointments: clients can only read their linked appointments
-- ---------------------------------------------------------------------------
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
        AND p.business_id = c.business_id
        AND appointments.business_id = c.business_id
    )
  );

COMMIT;
