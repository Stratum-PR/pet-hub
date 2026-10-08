-- HOTFIX: signed-in users could change their own profiles.role / business_id / staff_id
-- through the "Profiles update" policy, making themselves manager of any business.
-- These columns may only change through SECURITY DEFINER functions (complete_manager_signup,
-- complete_employee_signup, handle_new_user, set_profile_business_id, ...), which run as the
-- function owner, or through the service role / super admins.
--
-- The "System can insert profiles" policy has the same hole for INSERT (own row, any role/business),
-- so an API INSERT may only create a plain client profile. handle_new_user creates every real profile
-- as the function owner and is unaffected.

CREATE OR REPLACE FUNCTION public.profiles_lock_identity_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'client'
       OR NEW.business_id IS NOT NULL
       OR NEW.staff_id IS NOT NULL
       OR NEW.is_super_admin IS TRUE
    THEN
      RAISE EXCEPTION 'profile_identity_columns_are_read_only' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.business_id IS DISTINCT FROM OLD.business_id
     OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
  THEN
    RAISE EXCEPTION 'profile_identity_columns_are_read_only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_identity_columns ON public.profiles;
CREATE TRIGGER profiles_lock_identity_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_identity_columns();

-- set_profile_business_id(uid, business_id) trusts its arguments. 20261006120000 revoked it from the API;
-- repeat it here (idempotent) so every database that gets this hotfix is closed, including stacks built
-- from a schema snapshot without privileges. complete_manager_signup still calls it as the owner.
REVOKE ALL ON FUNCTION public.set_profile_business_id(uuid, uuid) FROM PUBLIC, anon, authenticated;
