-- Allow *existing* super admins to grant/revoke `super_admin` for other users,
-- even if their auth email is not @stratumpr.com.
--
-- Observed runtime error:
--   42501 only_stratumpr_staff_may_grant_super_admin
-- coming from `public.profiles_enforce_super_admin_mutations()`.

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
  v_caller_is_super_admin boolean;
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

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_stratum := public.auth_email_is_stratum_staff(auth.uid());

  -- "Existing super admin" should be determined from profiles, not email domain,
  -- so allowlisted/non-stratum super admins can still manage others.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_super_admin IS TRUE
  )
  INTO v_caller_is_super_admin;

  IF v_grant THEN
    -- Keep original behavior for Stratum staff
    IF v_caller_stratum THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;

    -- NEW: allow any existing super admin to grant super admin to OTHER users
    IF v_caller_is_super_admin AND NEW.id IS DISTINCT FROM auth.uid() THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;

    -- For self-grant, keep the stricter Stratum staff restriction.
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
    -- Keep original behavior for Stratum staff
    IF v_caller_stratum THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      RETURN NEW;
    END IF;

    -- NEW: allow any existing super admin to revoke super admin from OTHER users
    IF v_caller_is_super_admin AND NEW.id IS DISTINCT FROM auth.uid() THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      RETURN NEW;
    END IF;

    -- For self-revoke, keep the stricter Stratum staff restriction.
    IF NEW.id = auth.uid() THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      IF public.auth_email_is_stratum_staff(NEW.id) THEN
        RETURN NEW;
      END IF;
    END IF;

    RAISE EXCEPTION 'only_stratumpr_staff_may_revoke_super_admin' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

