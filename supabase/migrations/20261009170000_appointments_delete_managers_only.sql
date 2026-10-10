-- P2-01 (appointments), decision 9 (REMEDIATION_PLAN §9, 2026-10-09): employees may not delete appointments; they may
-- cancel one (status change), which keeps the record. Managers keep delete.
--
-- Before, two policies allowed DELETE on public.appointments:
--   "Appointments delete"                               FOR DELETE  any member of the business (employees too) or super admin
--   "Users can manage appointments from their business" FOR ALL     super admin, or a business member whose profile role
--                                                                    is manager/super_admin
-- Permissive policies are OR-ed, so "Appointments delete" let every employee delete any appointment of their business.
--
-- After:
--   appointments_delete_business_managers  FOR DELETE TO authenticated  is_business_manager(business_id) OR super admin
--   The FOR ALL policy is split into "Users can read/insert/update appointments from their business" with identical
--   USING / WITH CHECK expressions (copied verbatim from production), so it no longer grants DELETE.
-- is_business_manager (P2-01 staff, 20261009120000) = super admin, profile role manager/super_admin of that business, or
-- staff access_role admin/manager in it. That covers everyone the FOR ALL policy let delete, so no manager loses delete.
-- The super admin clause keeps super admin delete on appointments with no business (business_id is nullable):
-- is_business_manager returns false for a NULL business, and the old "Appointments delete" policy allowed it.
--
-- Not touched: "Appointments select/insert/update", "Clients can read own appointments" (portal), "Demo workspace read
-- appointments" and "Users can access appointments from their business". Employees keep reading, booking, rescheduling
-- and changing the status of their business's appointments, including cancelling (status 'canceled' / 'cancelled'),
-- which is how every frontend cancels. Public booking (submit_booking_request) is SECURITY DEFINER and only inserts.
--
-- Who loses DELETE: a profile with role employee (and no staff access_role admin/manager), or any other non-manager
-- profile linked to the business. Nothing else changes. SECURITY DEFINER functions, the service role and FK actions
-- (appointments.client_id / pet_id are ON DELETE SET NULL) are not affected by RLS.
--
-- Requires 20261009120000_staff_rls_rewrite.sql (is_business_manager). Idempotent.

DO $$
BEGIN
  IF to_regprocedure('public.is_business_manager(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_business_manager(uuid) is missing: apply 20261009120000_staff_rls_rewrite.sql first';
  END IF;
END
$$;

-- ---------- delete: managers only ----------

DROP POLICY IF EXISTS "Appointments delete" ON public.appointments;

DROP POLICY IF EXISTS appointments_delete_business_managers ON public.appointments;
CREATE POLICY appointments_delete_business_managers ON public.appointments AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_business_manager(business_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

-- ---------- split the FOR ALL manager policy; same expressions, no DELETE ----------

DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;

DROP POLICY IF EXISTS "Users can read appointments from their business" ON public.appointments;
CREATE POLICY "Users can read appointments from their business" ON public.appointments AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

DROP POLICY IF EXISTS "Users can insert appointments from their business" ON public.appointments;
CREATE POLICY "Users can insert appointments from their business" ON public.appointments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

DROP POLICY IF EXISTS "Users can update appointments from their business" ON public.appointments;
CREATE POLICY "Users can update appointments from their business" ON public.appointments AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
