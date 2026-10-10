-- Rollback for 20261009170000_appointments_delete_managers_only.sql (P2-01 appointments, decision 9).
-- Removes the new delete policy and the three split policies, and recreates the two previous policies exactly as in
-- production (copied verbatim from test-env/supabase/prod-schema-snapshot.sql). This REOPENS "employees can delete any
-- appointment of their business"; use only if the new policy breaks a legitimate flow.
-- "Appointments select/insert/update", the portal, demo and "Users can access ..." read policies were not changed and
-- are not touched. The shared helpers (is_business_manager etc.) belong to 20261009120000 and are not touched. Idempotent.

DROP POLICY IF EXISTS appointments_delete_business_managers ON public.appointments;
DROP POLICY IF EXISTS "Users can read appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can update appointments from their business" ON public.appointments;

DROP POLICY IF EXISTS "Appointments delete" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;

CREATE POLICY "Appointments delete" ON public.appointments AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Users can manage appointments from their business" ON public.appointments AS PERMISSIVE FOR ALL TO public
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
