-- Rollback for 20261009120000_staff_rls_rewrite.sql (P2-01 staff).
-- Removes the new staff policies and helpers and recreates the 11 previous policies exactly as in production
-- (copied verbatim from test-env/supabase/prod-schema-snapshot.sql). This REOPENS the holes P2-01 closed
-- (employees can add staff rows, edit or delete coworkers); use only if the new policies break a legitimate flow.
-- The demo-workspace read policies and the P2-03 trigger are not touched. Idempotent.

DROP POLICY IF EXISTS staff_select_business_members ON public.staff;
DROP POLICY IF EXISTS staff_insert_managers ON public.staff;
DROP POLICY IF EXISTS staff_update_managers ON public.staff;
DROP POLICY IF EXISTS staff_update_own_row ON public.staff;
DROP POLICY IF EXISTS staff_delete_managers ON public.staff;

DROP POLICY IF EXISTS "Employees delete" ON public.staff;
DROP POLICY IF EXISTS "Employees insert" ON public.staff;
DROP POLICY IF EXISTS "Employees select" ON public.staff;
DROP POLICY IF EXISTS "Employees update" ON public.staff;
DROP POLICY IF EXISTS "Users can access employees from their business" ON public.staff;
DROP POLICY IF EXISTS "Users can manage employees from their business" ON public.staff;
DROP POLICY IF EXISTS employee_update_own_staff_row ON public.staff;
DROP POLICY IF EXISTS employees_delete_managers ON public.staff;
DROP POLICY IF EXISTS employees_insert_managers ON public.staff;
DROP POLICY IF EXISTS employees_select_business ON public.staff;
DROP POLICY IF EXISTS employees_update_managers ON public.staff;

CREATE POLICY "Employees delete" ON public.staff AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Employees insert" ON public.staff AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Employees select" ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Employees update" ON public.staff AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Users can access employees from their business" ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))) OR (id IN ( SELECT p.staff_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.staff_id IS NOT NULL))))))));

CREATE POLICY "Users can manage employees from their business" ON public.staff AS PERMISSIVE FOR ALL TO public
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

CREATE POLICY employee_update_own_staff_row ON public.staff AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY employees_delete_managers ON public.staff AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY employees_insert_managers ON public.staff AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY employees_select_business ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id = staff.business_id) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'employee'::text) AND (p.staff_id = staff.id))))))));

CREATE POLICY employees_update_managers ON public.staff AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));


-- The helpers are new in 20261009120000. If a later migration's policy uses them, these drops fail on purpose:
-- roll that migration back first.
DROP FUNCTION IF EXISTS public.is_business_member(uuid);
DROP FUNCTION IF EXISTS public.is_business_manager(uuid);
DROP FUNCTION IF EXISTS public.is_own_staff_row(uuid);
