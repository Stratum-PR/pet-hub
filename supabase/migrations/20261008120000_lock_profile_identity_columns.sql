-- HOTFIX: signed-in users could change their own profiles.role / business_id / staff_id
-- through the "Profiles update" policy, making themselves manager of any business.
-- These columns may only change through SECURITY DEFINER functions (complete_manager_signup,
-- complete_employee_signup, handle_new_user, set_profile_business_id, ...), which run as the
-- function owner, or through the service role / super admins.

CREATE OR REPLACE FUNCTION public.profiles_lock_identity_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NOT public.is_super_admin()
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
     )
  THEN
    RAISE EXCEPTION 'profile_identity_columns_are_read_only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_identity_columns ON public.profiles;
CREATE TRIGGER profiles_lock_identity_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_identity_columns();
