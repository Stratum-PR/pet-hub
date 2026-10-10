-- Rollback for 20261009160000_pets_delete_managers_only.sql (P2-01 pets, decision 9).
-- Removes the new delete policy and recreates the two previous policies exactly as in production (copied verbatim
-- from test-env/supabase/prod-schema-snapshot.sql). This REOPENS "employees can delete any pet of their business";
-- use only if the new policy breaks a legitimate flow.
-- "Managers can delete pets for their business" and "Clients can delete own pets" were not changed and are not touched.
-- The shared helpers (is_business_manager etc.) belong to 20261009120000 and are not touched. Idempotent.

DROP POLICY IF EXISTS pets_delete_business_managers ON public.pets;

DROP POLICY IF EXISTS "Pets delete" ON public.pets;
DROP POLICY IF EXISTS pets_delete_managers ON public.pets;

CREATE POLICY "Pets delete" ON public.pets AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY pets_delete_managers ON public.pets AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));
