-- Allow super admins to grant `super_admin` even when the target user's auth email
-- is not @stratumpr.com.
--
-- Runtime error we observed:
--   P0001: "Super admin role is restricted to @stratumpr.com emails only"
-- thrown from `public.enforce_super_admin_domain()`.

CREATE OR REPLACE FUNCTION public.enforce_super_admin_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_caller_is_super_admin boolean := false;
BEGIN
  -- During UPDATEs, if the caller is already a super admin, allow the mutation
  -- without enforcing the target email domain restriction.
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_super_admin = true
    )
    INTO v_caller_is_super_admin;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE')
     AND (NEW.is_super_admin IS TRUE OR NEW.role = 'super_admin') THEN
    IF TG_OP = 'UPDATE' AND v_caller_is_super_admin THEN
      RETURN NEW;
    END IF;

    SELECT lower(trim(coalesce(u.email, '')))
    INTO v_email
    FROM auth.users u
    WHERE u.id = NEW.id;

    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION 'Super admin requires a linked auth user with an email' USING ERRCODE = 'P0001';
    END IF;

    IF NOT (
      v_email LIKE '%@stratumpr.com'
      OR public.auth_email_super_admin_allowlisted(v_email)
    ) THEN
      RAISE EXCEPTION 'Super admin role is restricted to @stratumpr.com emails only'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

