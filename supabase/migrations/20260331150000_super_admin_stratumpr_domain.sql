-- Super admin: only @stratumpr.com auth emails (auth.users.email) get the flag automatically.
-- Only @stratumpr.com accounts may grant or revoke super admin on profiles (including other users).
-- Uses new auth email on INSERT; syncs profiles when auth email changes.

CREATE OR REPLACE FUNCTION public.auth_email_is_stratum_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND lower(trim(coalesce(u.email, ''))) LIKE '%@stratumpr.com'
  );
$$;

-- New signups: Stratum staff get super admin + role from auth email (not profiles.email).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sa boolean := lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_sa,
    CASE WHEN v_sa THEN 'super_admin' ELSE 'client' END
  );
  RETURN NEW;
END;
$$;

-- Business signup must not downgrade Stratum super admins to "manager" role.
-- DROP first: CREATE OR REPLACE cannot change return type if the live definition differs (42P13).
DROP FUNCTION IF EXISTS public.set_profile_business_id(uuid, uuid);

CREATE FUNCTION public.set_profile_business_id(p_uid UUID, p_business_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    business_id = p_business_id,
    role = CASE WHEN is_super_admin = true THEN 'super_admin' ELSE 'manager' END,
    updated_at = now()
  WHERE id = p_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_profile_business_id: no row updated for uid %', p_uid;
  END IF;
END;
$$;

-- When auth.users email changes, keep profiles.is_super_admin in sync with auth email.
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sa boolean := lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com';
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET
    email = NEW.email,
    is_super_admin = v_sa,
    role = CASE
      WHEN v_sa THEN 'super_admin'
      WHEN NOT v_sa AND role = 'super_admin' THEN
        CASE WHEN business_id IS NOT NULL THEN 'manager' ELSE 'client' END
      ELSE role
    END,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_updated();

CREATE OR REPLACE FUNCTION public.profiles_enforce_super_admin_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant boolean;
  v_revoke boolean;
  v_caller_stratum boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_grant :=
    (NEW.is_super_admin IS TRUE AND OLD.is_super_admin IS NOT TRUE)
    OR (
      NEW.role = 'super_admin'
      AND OLD.role IS DISTINCT FROM 'super_admin'
    );

  v_revoke :=
    (NEW.is_super_admin IS NOT TRUE AND OLD.is_super_admin IS TRUE)
    OR (
      NEW.role IS DISTINCT FROM 'super_admin'
      AND OLD.role = 'super_admin'
    );

  IF NOT (v_grant OR v_revoke) THEN
    RETURN NEW;
  END IF;

  -- Service role / internal updates (e.g. auth email sync): no JWT
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_stratum := public.auth_email_is_stratum_staff(auth.uid());

  IF v_grant THEN
    IF v_caller_stratum THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.id = auth.uid() AND public.auth_email_is_stratum_staff(NEW.id) THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'only_stratumpr_staff_may_grant_super_admin' USING ERRCODE = '42501';
  END IF;

  IF v_revoke THEN
    IF v_caller_stratum THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.id = auth.uid() THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'only_stratumpr_staff_may_revoke_super_admin' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_super_admin_mutations ON public.profiles;
CREATE TRIGGER profiles_enforce_super_admin_mutations
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_super_admin_mutations();

-- Data: align with auth.users (canonical email for super admin)
UPDATE public.profiles p
SET
  is_super_admin = true,
  role = 'super_admin',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(trim(coalesce(u.email, ''))) LIKE '%@stratumpr.com'
  AND (p.is_super_admin IS NOT TRUE OR p.role IS DISTINCT FROM 'super_admin');

UPDATE public.profiles p
SET
  is_super_admin = false,
  role = CASE
    WHEN p.role = 'super_admin' AND p.business_id IS NOT NULL THEN 'manager'
    WHEN p.role = 'super_admin' THEN 'client'
    ELSE p.role
  END,
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.is_super_admin = true
  AND lower(trim(coalesce(u.email, ''))) NOT LIKE '%@stratumpr.com';
