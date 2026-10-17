-- Rollback for 20261010230000_businesses_update_managers_only.sql (P2-01 businesses, SECURITY_RISKS S-7a).
-- Drops the billing-column trigger and the manager-only update policy, and recreates "Businesses update" exactly as in
-- production (copied verbatim from test-env/supabase/prod-schema-snapshot.sql). This REOPENS "any member can edit the
-- business, billing included" (S-7) and the root cause of U25's stored XSS; use only if the new rules break a
-- legitimate flow. is_business_manager belongs to 20261009120000 and is not touched. Idempotent.

DROP TRIGGER IF EXISTS businesses_lock_billing_columns ON public.businesses;
DROP FUNCTION IF EXISTS public.businesses_lock_billing_columns();

DROP POLICY IF EXISTS businesses_update_managers ON public.businesses;
DROP POLICY IF EXISTS "Businesses update" ON public.businesses;

CREATE POLICY "Businesses update" ON public.businesses AS PERMISSIVE FOR UPDATE TO public
  USING (((id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));
