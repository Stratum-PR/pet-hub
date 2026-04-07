-- Global client identity migration:
-- - Merge duplicate clients by profile_id
-- - Enforce one active client row per profile_id
-- - Keep pets global to client identity
-- - Add stronger integrity checks for appointments
-- - Add read policies for business members via appointment linkage

BEGIN;

-- 1) Keep merge history for auditability
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS merged_into_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.merged_into_client_id IS
  'Set when this row is merged into canonical client row.';

-- 2) Merge duplicates where many clients share one auth profile_id
DO $$
DECLARE
  v_profile_id UUID;
  v_keep UUID;
  v_dup UUID;
BEGIN
  FOR v_profile_id IN
    SELECT c.profile_id
    FROM public.clients c
    WHERE c.profile_id IS NOT NULL
      AND c.merged_into_client_id IS NULL
    GROUP BY c.profile_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT c.id
    INTO v_keep
    FROM public.clients c
    WHERE c.profile_id = v_profile_id
      AND c.merged_into_client_id IS NULL
    ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    LIMIT 1;

    FOR v_dup IN
      SELECT c.id
      FROM public.clients c
      WHERE c.profile_id = v_profile_id
        AND c.id <> v_keep
        AND c.merged_into_client_id IS NULL
    LOOP
      UPDATE public.pets SET client_id = v_keep WHERE client_id = v_dup;
      UPDATE public.appointments SET client_id = v_keep WHERE client_id = v_dup;

      UPDATE public.clients
      SET
        profile_id = NULL,
        merged_into_client_id = v_keep,
        updated_at = now()
      WHERE id = v_dup;
    END LOOP;

    -- Canonical row should be global, not business-scoped.
    UPDATE public.clients
    SET business_id = NULL, updated_at = now()
    WHERE id = v_keep
      AND profile_id IS NOT NULL;
  END LOOP;
END $$;

-- 3) Replace business-scoped uniqueness with global profile uniqueness
DROP INDEX IF EXISTS public.clients_business_profile_unique;

CREATE UNIQUE INDEX IF NOT EXISTS clients_profile_id_unique
  ON public.clients (profile_id)
  WHERE profile_id IS NOT NULL AND merged_into_client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_business_client_date
  ON public.appointments (business_id, client_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_business_client_links_user_business_status
  ON public.business_client_links (user_id, business_id, status);

-- 4) Appointment integrity: selected pet must belong to selected client
CREATE OR REPLACE FUNCTION public.appointments_pet_matches_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_client UUID;
BEGIN
  IF NEW.client_id IS NULL OR NEW.pet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.client_id INTO v_client
  FROM public.pets p
  WHERE p.id = NEW.pet_id;

  IF v_client IS NULL THEN
    RAISE EXCEPTION 'appointments.pet_id does not exist';
  END IF;

  IF v_client <> NEW.client_id THEN
    RAISE EXCEPTION 'appointments.pet_id must belong to appointments.client_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_pet_matches_client ON public.appointments;
CREATE TRIGGER trg_appointments_pet_matches_client
  BEFORE INSERT OR UPDATE OF client_id, pet_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_pet_matches_client();

-- 5) Client RLS for global identity (self-service)
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

DROP POLICY IF EXISTS "Clients can insert own client profile" ON public.clients;
CREATE POLICY "Clients can insert own client profile"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND merged_into_client_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'client'
    )
  );

-- 6) Pets RLS for global client identity
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
        AND c.merged_into_client_id IS NULL
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
        AND c.merged_into_client_id IS NULL
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
        AND c.merged_into_client_id IS NULL
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
        AND c.merged_into_client_id IS NULL
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
        AND c.merged_into_client_id IS NULL
        AND p.role = 'client'
    )
  );

-- 7) Client appointments RLS (read own appointments only)
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
        AND c.merged_into_client_id IS NULL
        AND p.role = 'client'
    )
  );

-- 8) Business-side read visibility for global client/pet rows via appointments
DROP POLICY IF EXISTS "Business members can read clients linked by appointments" ON public.clients;
CREATE POLICY "Business members can read clients linked by appointments"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.appointments a
          WHERE a.client_id = clients.id
            AND a.business_id = p.business_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles sp
      WHERE sp.id = auth.uid() AND sp.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Business members can read pets linked by appointments" ON public.pets;
CREATE POLICY "Business members can read pets linked by appointments"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.appointments a
          WHERE a.pet_id = pets.id
            AND a.business_id = p.business_id
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles sp
      WHERE sp.id = auth.uid() AND sp.is_super_admin = true
    )
  );

COMMIT;
