-- Non-Stratum emails that always receive super_admin (canonical allowlist via auth.users.email).
-- Also: audit table for support user-session issuance.

CREATE OR REPLACE FUNCTION public.auth_email_super_admin_allowlisted(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p_email, ''))) = 'jovanielrodriguez4@gmail.com';
$$;

-- Some hosted environments may define this trigger; keep it but align with allowlist + canonical auth email.
CREATE OR REPLACE FUNCTION public.enforce_super_admin_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE')
     AND (NEW.is_super_admin IS TRUE OR NEW.role = 'super_admin') THEN
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

-- Unchanged meaning: only @stratumpr.com may grant/revoke super admin on others (see profiles_enforce).
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sa boolean :=
    lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com'
    OR public.auth_email_super_admin_allowlisted(NEW.email);
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

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sa boolean :=
    lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com'
    OR public.auth_email_super_admin_allowlisted(NEW.email);
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

UPDATE public.profiles p
SET
  is_super_admin = true,
  role = 'super_admin',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(trim(coalesce(u.email, ''))) = 'jovanielrodriguez4@gmail.com'
  AND (p.is_super_admin IS NOT TRUE OR p.role IS DISTINCT FROM 'super_admin');

CREATE TABLE IF NOT EXISTS public.support_impersonation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_support_impersonation_audit_admin
  ON public.support_impersonation_audit (admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_impersonation_audit_target
  ON public.support_impersonation_audit (target_user_id, created_at DESC);

COMMENT ON TABLE public.support_impersonation_audit IS 'Records when a super admin issued support login material for another user (Edge Function).';

ALTER TABLE public.support_impersonation_audit ENABLE ROW LEVEL SECURITY;
