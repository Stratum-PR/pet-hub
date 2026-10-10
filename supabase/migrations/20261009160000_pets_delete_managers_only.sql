-- P2-01 (pets), decision 9 (REMEDIATION_PLAN §9, 2026-10-09): employees may not delete pets; managers keep delete.
--
-- Before, four policies allowed DELETE on public.pets:
--   "Pets delete"                                   FOR DELETE  any member of the business (employees too) or super admin
--   pets_delete_managers                            FOR DELETE  super admin, or profile role manager/super_admin of the business
--   "Managers can delete pets for their business"   FOR DELETE  super admin, or profile role manager/super_admin whose business
--                                                               owns the pet or has an appointment for it
--   "Clients can delete own pets"                   FOR DELETE  a portal client, for their own pets with no business
-- Permissive policies are OR-ed, so "Pets delete" let every employee delete any pet of their business.
--
-- After:
--   pets_delete_business_managers  FOR DELETE TO authenticated  is_business_manager(business_id) OR caller is super admin
--   "Managers can delete pets for their business" and "Clients can delete own pets" are kept unchanged (neither admits
--   an employee: the first needs profile role manager/super_admin, the second profile role client).
-- is_business_manager (P2-01 staff, 20261009120000) = super admin, profile role manager/super_admin of that business, or
-- staff access_role admin/manager in it. That covers everyone pets_delete_managers covered, so no manager loses delete.
-- The super admin clause keeps super admin delete on pets with no business (global portal pets): is_business_manager
-- returns false for a NULL business, and the old "Pets delete" policy allowed it.
--
-- There is no FOR ALL policy on pets, so nothing needs splitting. Not touched: every SELECT / INSERT / UPDATE policy
-- ("Pets select/insert/update", the manager and portal policies, the appointment-link and demo-workspace reads), so
-- employees keep reading, adding and editing their business's pets and portal clients keep managing their own pets.
--
-- Who loses DELETE: a profile with role employee (and no staff access_role admin/manager), or any other non-manager
-- profile linked to the business. Nothing else changes. SECURITY DEFINER functions, the service role and FK cascades
-- (e.g. deleting a client) are not affected by RLS.
--
-- Requires 20261009120000_staff_rls_rewrite.sql (is_business_manager). Idempotent.

DO $$
BEGIN
  IF to_regprocedure('public.is_business_manager(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_business_manager(uuid) is missing: apply 20261009120000_staff_rls_rewrite.sql first';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Pets delete" ON public.pets;
DROP POLICY IF EXISTS pets_delete_managers ON public.pets;

DROP POLICY IF EXISTS pets_delete_business_managers ON public.pets;
CREATE POLICY pets_delete_business_managers ON public.pets AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_business_manager(business_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
