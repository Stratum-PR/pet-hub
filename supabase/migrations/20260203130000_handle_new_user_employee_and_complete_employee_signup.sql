-- ============================================
-- handle_new_user: add employee (invite-only) branch
-- complete_employee_signup RPC for OAuth employee signup
-- ============================================
-- 1. handle_new_user: manager (business_name), employee (invite_token -> business_id from employee_invitations), else client
-- 2. complete_employee_signup(p_invite_token): for OAuth employee signup after callback

-- Ensure employee_invitations exists (it may in production; create if not for local)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_invitations') THEN
    CREATE TABLE public.employee_invitations (
      id bigint GENERATED ALWAYS AS IDENTITY NOT NULL PRIMARY KEY,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      token text,
      email text,
      business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
      accepted_at timestamp with time zone,
      expires_at timestamp with time zone
    );
    CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON public.employee_invitations(token);
  END IF;
END $$;

-- Replace handle_new_user: manager, employee (invite), or client
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_business_id UUID;
  signup_role_val TEXT;
  business_name_val TEXT;
  invite_token_val TEXT;
  invite_business_id UUID;
  short_code_val TEXT;
BEGIN
  signup_role_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'signup_role', '')), '');
  business_name_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), '');
  invite_token_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  -- 1. Manager: create business + profile(manager, business_id)
  IF signup_role_val = 'manager' AND business_name_val IS NOT NULL AND LENGTH(business_name_val) > 0 THEN
    short_code_val := lower(substring(regexp_replace(business_name_val, '[^a-zA-Z0-9]', '', 'g') from 1 for 12));
    IF short_code_val IS NULL OR short_code_val = '' THEN
      short_code_val := 'b' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 7);
    ELSE
      short_code_val := short_code_val || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4);
    END IF;

    INSERT INTO public.businesses (name, email, subscription_tier, subscription_status, short_code)
    VALUES (business_name_val, NEW.email, 'basic', 'trialing', short_code_val)
    RETURNING id INTO new_business_id;

    INSERT INTO public.profiles (id, email, full_name, role, business_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'manager',
      new_business_id
    );
    RETURN NEW;
  END IF;

  -- 2. Employee: valid invite_token -> profile(employee, business_id), mark invite accepted
  IF signup_role_val = 'employee' AND invite_token_val IS NOT NULL AND LENGTH(invite_token_val) > 0 THEN
    SELECT ei.business_id INTO invite_business_id
    FROM public.employee_invitations ei
    WHERE ei.token = invite_token_val
      AND (ei.expires_at IS NULL OR ei.expires_at > now())
      AND ei.accepted_at IS NULL
      AND ei.business_id IS NOT NULL
    LIMIT 1;

    IF invite_business_id IS NOT NULL THEN
      INSERT INTO public.profiles (id, email, full_name, role, business_id)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'employee',
        invite_business_id
      );
      UPDATE public.employee_invitations
      SET accepted_at = now()
      WHERE token = invite_token_val AND accepted_at IS NULL;
      RETURN NEW;
    END IF;
    /* fall through to client if token invalid/expired/used */
  END IF;

  -- 3. Client / fallback: profile(role = client) only
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client'
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- RPC: complete_employee_signup(p_invite_token)
-- ============================================
-- Used after OAuth callback when user signed up as employee with invite token in sessionStorage.
-- Looks up employee_invitations by token, sets profile.business_id and role = 'employee', marks invite accepted.

CREATE OR REPLACE FUNCTION public.complete_employee_signup(p_invite_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  invite_business_id uuid;
  trimmed_token text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  trimmed_token := NULLIF(TRIM(p_invite_token), '');
  IF trimmed_token IS NULL OR LENGTH(trimmed_token) < 1 THEN
    RETURN;
  END IF;

  -- Already has business_id (e.g. already completed)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND business_id IS NOT NULL) THEN
    RETURN;
  END IF;

  SELECT ei.business_id INTO invite_business_id
  FROM public.employee_invitations ei
  WHERE ei.token = trimmed_token
    AND (ei.expires_at IS NULL OR ei.expires_at > now())
    AND ei.accepted_at IS NULL
    AND ei.business_id IS NOT NULL
  LIMIT 1;

  IF invite_business_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET business_id = invite_business_id, role = 'employee'
  WHERE id = uid;

  UPDATE public.employee_invitations
  SET accepted_at = now()
  WHERE token = trimmed_token AND accepted_at IS NULL;
END;
$$;

-- ============================================
-- RPC: get_employee_invite_info(p_token) - read-only validation for signup UI
-- ============================================
-- Returns valid and business name so the signup page can show "You're joining [Business name]".

CREATE OR REPLACE FUNCTION public.get_employee_invite_info(p_token text)
RETURNS TABLE(valid boolean, business_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  bname text;
BEGIN
  valid := false;
  business_name := NULL;

  IF p_token IS NULL OR LENGTH(TRIM(p_token)) < 1 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT ei.business_id INTO bid
  FROM public.employee_invitations ei
  WHERE ei.token = TRIM(p_token)
    AND (ei.expires_at IS NULL OR ei.expires_at > now())
    AND ei.accepted_at IS NULL
    AND ei.business_id IS NOT NULL
  LIMIT 1;

  IF bid IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT b.name INTO bname FROM public.businesses b WHERE b.id = bid LIMIT 1;
  valid := true;
  business_name := bname;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ============================================
-- RPC: create_employee_invite(optional email, optional expires_days)
-- ============================================
-- Manager creates an invite; returns invite_token. Frontend builds URL: origin + /signup?invite=TOKEN.

CREATE OR REPLACE FUNCTION public.create_employee_invite(
  p_email text DEFAULT NULL,
  p_expires_days integer DEFAULT 7
)
RETURNS TABLE(invite_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  bid uuid;
  tok text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT business_id INTO bid FROM public.profiles WHERE id = uid LIMIT 1;
  IF bid IS NULL THEN
    RAISE EXCEPTION 'No business associated with your account';
  END IF;

  tok := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.employee_invitations (token, email, business_id, expires_at)
  VALUES (
    tok,
    NULLIF(TRIM(p_email), ''),
    bid,
    CASE WHEN p_expires_days IS NOT NULL AND p_expires_days > 0
         THEN now() + (p_expires_days || ' days')::interval
         ELSE now() + interval '7 days'
    END
  );

  invite_token := tok;
  RETURN NEXT;
  RETURN;
END;
$$;
