-- P2-01 (staff): one clear set of RLS policies on public.staff, built on shared helpers.
--
-- Before: 13 policies, most of them generic or duplicates. "Employees insert/update/delete/select" let ANY member
-- of a business (an employee too) add staff rows, edit or delete coworkers, and "employee_update_own_staff_row" let
-- an employee move their own row to another business. P2-03 locked the pay/role columns on UPDATE only.
--
-- After (all TO authenticated):
--   staff_select_business_members  SELECT  is_business_member(business_id) OR is_own_staff_row(id)
--   staff_insert_managers          INSERT  is_business_manager(business_id)
--   staff_update_managers          UPDATE  is_business_manager(business_id)                    (both USING and CHECK)
--   staff_update_own_row           UPDATE  is_own_staff_row(id); CHECK also is_business_member(business_id)
--   staff_delete_managers          DELETE  is_business_manager(business_id)
-- Unchanged: "Demo workspace read employees" / "Demo workspace read staff" (demo workspace, P2-05), the triggers
-- staff_enforce_access_role_mutations and staff_lock_pay_and_role_columns (P2-03: which columns an employee may
-- change on their own row).
--
-- Who is a manager is exactly can_manage_staff_private's rule (super admin; profile role manager/super_admin in
-- that business; or the caller's staff access_role is admin/manager in that business), so nobody who manages staff
-- today loses it. Employees keep reading their business's staff (coworker names, photos and PINs as before; PINs
-- are P2-02) and editing their own row. Public booking reads staff through SECURITY DEFINER RPCs
-- (get_public_booking_options, bookable_staff_ids); signup, invite and kiosk paths are SECURITY DEFINER functions
-- (handle_new_user, complete_manager_signup, clock_in_out) or the service role (accept-employee-invitation,
-- send-employee-invitation, support-begin-user-session, notify-appointment); none of them is affected.
--
-- Idempotent: helpers use CREATE OR REPLACE, every policy is dropped by name before it is created.

-- ---------- shared helpers (same style as can_manage_staff_private) ----------

CREATE OR REPLACE FUNCTION public.is_business_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND p_business_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id)
  );
$function$;

COMMENT ON FUNCTION public.is_business_member(uuid) IS
  'P2-01: the caller is a super admin or their profile belongs to this business (any role).';

CREATE OR REPLACE FUNCTION public.is_business_manager(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND p_business_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id)
      AND (
        public.profile_is_manager_or_super_admin(auth.uid())
        OR COALESCE(public.caller_staff_access_role_for_business(p_business_id), '') IN ('admin', 'manager')
      )
    )
  );
$function$;

COMMENT ON FUNCTION public.is_business_manager(uuid) IS
  'P2-01: the caller manages this business: super admin, profile role manager/super_admin of it, or staff access_role admin/manager in it. Same rule as can_manage_staff_private.';

CREATE OR REPLACE FUNCTION public.is_own_staff_row(p_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND p_staff_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.id = p_staff_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.staff_id = p_staff_id)
  );
$function$;

COMMENT ON FUNCTION public.is_own_staff_row(uuid) IS
  'P2-01: this staff row is the caller''s own (staff.user_id = caller, or the caller''s profile.staff_id).';

REVOKE ALL ON FUNCTION public.is_business_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_business_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_own_staff_row(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_own_staff_row(uuid) TO authenticated, service_role;

-- ---------- drop the old generic / duplicate staff policies ----------

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

-- ---------- the new set ----------

DROP POLICY IF EXISTS staff_select_business_members ON public.staff;
CREATE POLICY staff_select_business_members ON public.staff AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_business_member(business_id) OR public.is_own_staff_row(id));

DROP POLICY IF EXISTS staff_insert_managers ON public.staff;
CREATE POLICY staff_insert_managers ON public.staff AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_business_manager(business_id));

DROP POLICY IF EXISTS staff_update_managers ON public.staff;
CREATE POLICY staff_update_managers ON public.staff AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_business_manager(business_id))
  WITH CHECK (public.is_business_manager(business_id));

-- Column limits for this path (pay, role, job title, access) are the P2-03 trigger's job.
DROP POLICY IF EXISTS staff_update_own_row ON public.staff;
CREATE POLICY staff_update_own_row ON public.staff AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_own_staff_row(id))
  WITH CHECK (public.is_own_staff_row(id) AND public.is_business_member(business_id));

DROP POLICY IF EXISTS staff_delete_managers ON public.staff;
CREATE POLICY staff_delete_managers ON public.staff AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_business_manager(business_id));

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
