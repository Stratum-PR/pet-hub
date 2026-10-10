-- P2-01 (clients), decision 9 (REMEDIATION_PLAN §9, 2026-10-09): employees may not delete clients; managers keep delete.
--
-- Before, three policies allowed DELETE on public.clients:
--   "Clients delete"                                   FOR DELETE  any member of the business (employees too) or super admin
--   clients_delete_managers                            FOR DELETE  super admin, or profile role manager/super_admin of the business
--   "Managers can manage clients in their business"    FOR ALL     super admin, or a member whose profile role is manager/super_admin
-- Permissive policies are OR-ed, so "Clients delete" let every employee delete any client of their business.
--
-- After, exactly one DELETE policy:
--   clients_delete_business_managers  FOR DELETE TO authenticated  is_business_manager(business_id) OR caller is super admin
-- is_business_manager (P2-01 staff, 20261009120000) = super admin, profile role manager/super_admin of that business, or
-- staff access_role admin/manager in it. That covers everyone the two old manager rules covered, so no manager loses delete.
--
-- "Managers can manage clients in their business" is FOR ALL; it is split into SELECT / INSERT / UPDATE policies with the
-- same name stem, role (public) and the exact same USING / WITH CHECK expressions, so read, add and edit behave exactly as
-- before; only its DELETE part is gone (now covered by the new delete policy).
--
-- Not touched (later P2-01 clients rewrite): every other SELECT / INSERT / UPDATE policy, including "Clients insert",
-- "Clients update" and "Clients select" (employees keep reading, adding and editing their business's clients), the client
-- portal policies ("Clients can read/update own client row", "Clients can insert own client profile"), the appointment-link
-- read policy and the demo-workspace read policy (P2-05).
--
-- Who loses DELETE: a profile with role employee (and no staff access_role admin/manager), or any other non-manager profile
-- linked to the business. Nothing else changes. SECURITY DEFINER functions and the service role are not affected by RLS.
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

DROP POLICY IF EXISTS "Clients delete" ON public.clients;
DROP POLICY IF EXISTS clients_delete_managers ON public.clients;

DROP POLICY IF EXISTS clients_delete_business_managers ON public.clients;
-- The super admin clause keeps super admin delete on clients with no business (business_id NULL, global portal
-- clients); is_business_manager returns false for a NULL business, and the old "Clients delete" policy allowed it.
CREATE POLICY clients_delete_business_managers ON public.clients AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_business_manager(business_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

-- ---------- split the FOR ALL manager policy; same expressions, no DELETE ----------

DROP POLICY IF EXISTS "Managers can manage clients in their business" ON public.clients;

DROP POLICY IF EXISTS "Managers can read clients in their business" ON public.clients;
CREATE POLICY "Managers can read clients in their business" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

DROP POLICY IF EXISTS "Managers can insert clients in their business" ON public.clients;
CREATE POLICY "Managers can insert clients in their business" ON public.clients AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

DROP POLICY IF EXISTS "Managers can update clients in their business" ON public.clients;
CREATE POLICY "Managers can update clients in their business" ON public.clients AS PERMISSIVE FOR UPDATE TO public
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

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
