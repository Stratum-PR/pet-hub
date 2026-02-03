-- Add businesses.slug if missing (for URL /:slug/dashboard; matches authRouting.slugify logic).
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS slug TEXT;

-- SECURITY DEFINER helper to set profile business_id and role.
-- Must be owned by the same role that owns public.profiles so the UPDATE bypasses RLS
-- (table owner bypasses RLS in PostgreSQL). Called from complete_manager_signup.

CREATE OR REPLACE FUNCTION public.set_profile_business_id(p_user_id uuid, p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.profiles
  SET business_id = p_business_id, role = 'manager', updated_at = now()
  WHERE id = p_user_id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

-- Ensure helper runs as table owner so RLS is bypassed (local/dev often uses postgres).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.set_profile_business_id(uuid, uuid) OWNER TO postgres;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- Make complete_manager_signup use the helper and fail loudly if profile update affects 0 rows.
CREATE OR REPLACE FUNCTION public.complete_manager_signup(p_business_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  user_email text;
  new_business_id uuid;
  trimmed_name text;
  short_code_val text;
  slug_val text;
  updated_count integer;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  trimmed_name := NULLIF(TRIM(p_business_name), '');
  IF trimmed_name IS NULL OR LENGTH(trimmed_name) < 1 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  -- Only run for profiles that have no business_id (new OAuth signup or legacy account)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND business_id IS NOT NULL) THEN
    RETURN;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid LIMIT 1;

  -- Ensure profile row exists (handle_new_user may not have run for some OAuth/sso flows)
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    uid,
    COALESCE(user_email, ''),
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = uid LIMIT 1), ''),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  short_code_val := lower(substring(regexp_replace(trimmed_name, '[^a-zA-Z0-9]', '', 'g') from 1 for 12));
  IF short_code_val IS NULL OR short_code_val = '' THEN
    short_code_val := 'b' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 7);
  ELSE
    short_code_val := short_code_val || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4);
  END IF;

  -- Slug for URL /:slug/dashboard (same logic as authRouting.slugify)
  slug_val := lower(trim(trimmed_name));
  slug_val := regexp_replace(slug_val, '[''"]', '', 'g');
  slug_val := regexp_replace(slug_val, '[^a-z0-9]+', '-', 'g');
  slug_val := regexp_replace(slug_val, '-+', '-', 'g');
  slug_val := trim(both '-' from slug_val);
  IF slug_val IS NULL OR slug_val = '' THEN
    slug_val := 'business-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
  END IF;

  INSERT INTO public.businesses (name, email, subscription_tier, subscription_status, short_code, slug)
  VALUES (trimmed_name, COALESCE(user_email, ''), 'basic', 'trialing', short_code_val, slug_val)
  RETURNING id INTO new_business_id;

  updated_count := public.set_profile_business_id(uid, new_business_id);
  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'Failed to link profile to business (updated % rows for user %)', updated_count, uid;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.complete_manager_signup(text) OWNER TO postgres;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
