-- Staff: catalog of services each person can perform (employee-editable via app whitelist).
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS offered_service_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.staff.offered_service_ids IS
  'Service UUIDs this staff member offers. Empty = no restriction in assignment UI (all services).';

-- services: allow business members (including employees) to read catalog; managers only mutate.
DROP POLICY IF EXISTS "Managers can manage services from their business" ON public.services;

CREATE POLICY "Business members can read services from their business"
  ON public.services
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (
        SELECT p.business_id
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.business_id IS NOT NULL
      )
    )
  );

CREATE POLICY "Managers can insert services from their business"
  ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );

CREATE POLICY "Managers can update services from their business"
  ON public.services
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );

CREATE POLICY "Managers can delete services from their business"
  ON public.services
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );
