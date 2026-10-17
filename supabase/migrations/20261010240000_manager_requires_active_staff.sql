-- U30 (owner decision 2026-10-10): staff access_role admin/manager gives manager rights only while that staff row
-- is active.
--
-- Before: is_business_manager (20261009120000) and can_manage_staff_private (20261006140000) counted
-- caller_staff_access_role_for_business IN ('admin','manager') without looking at staff.status, so a deactivated
-- lead kept deleting clients/pets/appointments (U13-U15), editing the business (U29), adding/editing/deleting staff
-- (U08), resetting staff and kiosk manager PINs (U11/U12 RPCs), reading staff_private (SSN, bank) and changing their
-- own pay/access columns (P2-03 lock uses can_manage_staff_private).
--
-- After: the staff path also requires that same staff row (the one caller_staff_access_role_for_business reads:
-- profiles.staff_id when the profile links one in this business, else the oldest row with staff.user_id = caller)
-- to have status = 'active'. staff.status is NOT NULL with CHECK (status IN ('active','inactive')), so "not active"
-- means 'inactive'. Super admins and profile managers (profiles.role manager/super_admin) are unchanged, whatever
-- their own staff row's status.
--
-- Not changed: caller_staff_access_role_for_business itself. Its other caller, the trigger
-- staff_enforce_access_role_mutations, is the only gate for a profile manager changing access_role, so making it
-- return NULL for inactive rows would block an owner whose own staff row is inactive. An inactive lead can't reach
-- that trigger for other rows any more (staff UPDATE/INSERT policies use is_business_manager), and can't change their
-- own access_role (staff_lock_pay_and_role_columns uses can_manage_staff_private).
--
-- Signatures, LANGUAGE sql, STABLE, SECURITY DEFINER, search_path and grants are unchanged (CREATE OR REPLACE keeps
-- the existing ACL; the GRANT/REVOKE lines below restate it). Idempotent. Rollback:
-- supabase/rollbacks/20261010240000_manager_requires_active_staff.down.sql.

DO $$
BEGIN
  IF to_regprocedure('public.is_business_manager(uuid)') IS NULL
     OR to_regprocedure('public.can_manage_staff_private(uuid)') IS NULL
     OR to_regprocedure('public.caller_staff_access_role_for_business(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_business_manager / can_manage_staff_private / caller_staff_access_role_for_business are missing: apply 20261006140000 and 20261009120000 first';
  END IF;
END;
$$;

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
        -- U30: the caller's staff row (same row as caller_staff_access_role_for_business) is admin/manager AND active.
        OR EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.business_id = p_business_id
            AND s.id = COALESCE(
              (SELECT p.staff_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id),
              (SELECT s2.id FROM public.staff s2
                WHERE s2.business_id = p_business_id AND s2.user_id = auth.uid()
                ORDER BY s2.created_at ASC
                LIMIT 1)
            )
            AND s.access_role IN ('admin', 'manager')
            AND s.status = 'active'
        )
      )
    )
  );
$function$;

COMMENT ON FUNCTION public.is_business_manager(uuid) IS
  'P2-01: the caller manages this business: super admin, profile role manager/super_admin of it, or ACTIVE staff with access_role admin/manager in it (U30). Same rule as can_manage_staff_private.';

CREATE OR REPLACE FUNCTION public.can_manage_staff_private(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id)
      AND (
        public.profile_is_manager_or_super_admin(auth.uid())
        -- U30: the caller's staff row (same row as caller_staff_access_role_for_business) is admin/manager AND active.
        OR EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.business_id = p_business_id
            AND s.id = COALESCE(
              (SELECT p.staff_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id),
              (SELECT s2.id FROM public.staff s2
                WHERE s2.business_id = p_business_id AND s2.user_id = auth.uid()
                ORDER BY s2.created_at ASC
                LIMIT 1)
            )
            AND s.access_role IN ('admin', 'manager')
            AND s.status = 'active'
        )
      )
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.is_business_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_manager(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_manage_staff_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_staff_private(uuid) TO authenticated;
