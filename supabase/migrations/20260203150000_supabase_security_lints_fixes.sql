-- ============================================
-- Supabase Security Lints Fixes
-- ============================================
-- 1. Ensure settings has RLS policies (fix "RLS enabled, no policy")
-- 2. Fix all 14 functions with SET search_path = public (fix "Function Search Path Mutable")
-- 3. Replace employee_invitations permissive UPDATE policy with strict policy

-- ============================================
-- 1. SETTINGS: Ensure RLS policies exist
-- ============================================
-- Drop any legacy policy names so we have a clean state
DROP POLICY IF EXISTS "Allow all operations on settings" ON public.settings;
DROP POLICY IF EXISTS "Users can read their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.settings;

-- Recreate policies (idempotent: drop by name first)
DROP POLICY IF EXISTS "Users can read settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can update settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can insert settings for their business" ON public.settings;

CREATE POLICY "Users can read settings from their business"
ON public.settings FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can update settings from their business"
ON public.settings FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can insert settings for their business"
ON public.settings FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- ============================================
-- 2. FUNCTIONS: Set search_path = public
-- ============================================

-- 2a. update_updated_at_column (from 20260114012543)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 2b. generate_impersonation_token, use_impersonation_token (from 20250120000000)
CREATE OR REPLACE FUNCTION public.generate_impersonation_token(target_business_id UUID)
RETURNS TABLE(token TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  token_expires_at TIMESTAMP WITH TIME ZONE;
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_admin_id AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can generate impersonation tokens';
  END IF;
  new_token := encode(gen_random_bytes(16), 'hex');
  token_expires_at := now() + INTERVAL '1 hour';
  INSERT INTO public.admin_impersonation_tokens (admin_id, business_id, token, expires_at)
  VALUES (current_admin_id, target_business_id, new_token, token_expires_at);
  RETURN QUERY SELECT new_token, token_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_impersonation_token(impersonation_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
BEGIN
  SELECT * INTO token_record
  FROM public.admin_impersonation_tokens
  WHERE token = impersonation_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid impersonation token';
  END IF;
  IF token_record.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Impersonation token has already been used';
  END IF;
  IF token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Impersonation token has expired';
  END IF;
  UPDATE public.admin_impersonation_tokens
  SET used_at = now()
  WHERE id = token_record.id;
  RETURN token_record.business_id;
END;
$$;

-- 2c. calculate_pet_age, calculate_vaccination_status, update_vaccination_status (from 20260128000006)
CREATE OR REPLACE FUNCTION public.calculate_pet_age(
  p_birth_month INTEGER,
  p_birth_year INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  current_month INTEGER;
  current_year INTEGER;
  age_years INTEGER;
BEGIN
  IF p_birth_month IS NULL OR p_birth_year IS NULL THEN
    RETURN NULL;
  END IF;
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  age_years := current_year - p_birth_year;
  IF current_month < p_birth_month OR
     (current_month = p_birth_month AND EXTRACT(DAY FROM CURRENT_DATE) < 1) THEN
    age_years := age_years - 1;
  END IF;
  RETURN GREATEST(0, age_years);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_vaccination_status(
  p_last_vaccination_date DATE
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_last_vaccination_date IS NULL THEN
    RETURN 'unknown';
  END IF;
  IF p_last_vaccination_date >= CURRENT_DATE - INTERVAL '12 months' THEN
    RETURN 'up_to_date';
  ELSE
    RETURN 'out_of_date';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vaccination_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.vaccination_status := public.calculate_vaccination_status(NEW.last_vaccination_date);
  RETURN NEW;
END;
$$;

-- 2d. set_inventory_updated_at (from 20260128000002)
CREATE OR REPLACE FUNCTION public.set_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- 2e. Functions that may exist only in DB (created via Dashboard): set search_path via ALTER
--     update_breeds_updated_at, is_super_admin, is_stratumpr_email, get_my_business_id,
--     get_my_role, can_access_business, enforce_super_admin_domain
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_breeds_updated_at',
        'is_super_admin',
        'is_stratumpr_email',
        'get_my_business_id',
        'get_my_role',
        'can_access_business',
        'enforce_super_admin_domain'
      )
  ) LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public',
      r.proname,
      r.args
    );
  END LOOP;
END;
$$;

-- ============================================
-- 3. EMPLOYEE_INVITATIONS: Strict UPDATE policy
-- ============================================
-- Ensure RLS is enabled (table may have been created without it)
ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;

-- Drop the permissive "System can update invitations" policy if it exists
DROP POLICY IF EXISTS "System can update invitations" ON public.employee_invitations;

-- Only managers/super_admins for the invitation's business (or any super_admin) can update
CREATE POLICY "Managers and super admins can update employee invitations"
ON public.employee_invitations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.is_super_admin = true
      OR (p.business_id = employee_invitations.business_id AND p.role IN ('manager', 'super_admin'))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.is_super_admin = true
      OR (p.business_id = employee_invitations.business_id AND p.role IN ('manager', 'super_admin'))
    )
  )
);
