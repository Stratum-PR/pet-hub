-- Super admin: optional post-login landing preference (self-update via existing RLS).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prefer_admin_dashboard_on_login BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.prefer_admin_dashboard_on_login IS
  'When true, super admins land on /admin after sign-in; when false (default), prefer their business_id portal if set.';

-- Super admin only: set another profile's role (narrow RPC; avoids broad UPDATE policy on profiles).
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(p_profile_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_caller AND p.is_super_admin = true) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('super_admin', 'manager', 'employee', 'client') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET role = p_role, updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_profile_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_role(uuid, text) TO authenticated;
