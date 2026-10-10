-- Rollback for 20261009150000_clients_delete_managers_only.sql (P2-01 clients, decision 9).
-- Removes the new delete policy and the three split manager policies, and recreates the three previous policies exactly as
-- in production (copied verbatim from test-env/supabase/prod-schema-snapshot.sql). This REOPENS "employees can delete any
-- client of their business"; use only if the new policy breaks a legitimate flow.
-- The shared helpers (is_business_manager etc.) belong to 20261009120000 and are not touched. Idempotent.

DROP POLICY IF EXISTS clients_delete_business_managers ON public.clients;
DROP POLICY IF EXISTS "Managers can read clients in their business" ON public.clients;
DROP POLICY IF EXISTS "Managers can insert clients in their business" ON public.clients;
DROP POLICY IF EXISTS "Managers can update clients in their business" ON public.clients;

DROP POLICY IF EXISTS "Clients delete" ON public.clients;
DROP POLICY IF EXISTS clients_delete_managers ON public.clients;
DROP POLICY IF EXISTS "Managers can manage clients in their business" ON public.clients;

CREATE POLICY "Clients delete" ON public.clients AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Managers can manage clients in their business" ON public.clients AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY clients_delete_managers ON public.clients AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));
