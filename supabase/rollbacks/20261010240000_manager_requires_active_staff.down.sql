-- Rollback for 20261010240000_manager_requires_active_staff.sql (U30).
-- Restores the previous bodies verbatim: is_business_manager from 20261009120000_staff_rls_rewrite.sql (with its
-- comment) and can_manage_staff_private from 20261006140000_staff_private_details.sql (= production snapshot).
-- This REOPENS "inactive staff with access_role admin/manager keep manager rights". caller_staff_access_role_for_business
-- was not changed by the migration and is not touched here. Grants are restated unchanged. Idempotent.

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

CREATE OR REPLACE FUNCTION public.can_manage_staff_private(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id)
      AND (
        public.profile_is_manager_or_super_admin(auth.uid())
        OR COALESCE(public.caller_staff_access_role_for_business(p_business_id), '') IN ('admin', 'manager')
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_manager(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_manage_staff_private(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_staff_private(UUID) TO authenticated;
