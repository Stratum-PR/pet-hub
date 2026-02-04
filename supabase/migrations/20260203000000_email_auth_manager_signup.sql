-- ============================================
-- Email/Password Auth: manager signup, role, slug, owner_id
-- ============================================
-- Adds role to profiles, owner_id/slug to businesses,
-- complete_manager_signup RPC, and supporting policies.

-- 1. Add role to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'manager', 'employee', 'client'));

-- Backfill role from is_super_admin and business_id
UPDATE public.profiles
SET role = CASE
  WHEN is_super_admin = true THEN 'super_admin'
  WHEN business_id IS NOT NULL AND role = 'client' THEN 'manager'
  ELSE COALESCE(role, 'client')
END
WHERE role IS NULL OR (role = 'client' AND (is_super_admin = true OR business_id IS NOT NULL));

-- 2. Add owner_id and slug to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

-- Backfill slug for existing businesses (from name)
UPDATE public.businesses
SET slug = lower(regexp_replace(
  regexp_replace(
    translate(trim(name), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
    '[^a-zA-Z0-9]+', '-', 'g'
  ), '-+', '-', 'g'
))
WHERE slug IS NULL AND name IS NOT NULL;

-- Ensure unique slugs: append id suffix where duplicate
WITH numbered AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.businesses
  WHERE slug IS NOT NULL
)
UPDATE public.businesses b
SET slug = b.slug || '-' || substring(b.id::text from 1 for 8)
FROM numbered n
WHERE b.id = n.id AND n.rn > 1;

-- 3. Allow 'starter' in subscription_tier
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_subscription_tier_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_subscription_tier_check
  CHECK (subscription_tier IN ('starter', 'basic', 'pro', 'enterprise'));

-- Set existing rows that might have been invalid to 'basic' if needed (starter is new)
-- No change needed if existing data is already basic/pro/enterprise.

-- 4. Profiles INSERT policy (for trigger handle_new_user)
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 5. Businesses INSERT policy (for new manager signup)
DROP POLICY IF EXISTS "Managers can create business" ON public.businesses;
CREATE POLICY "Managers can create business"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 6. Helper: set profile business_id and role (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.set_profile_business_id(p_uid UUID, p_business_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET business_id = p_business_id, role = 'manager', updated_at = now()
  WHERE id = p_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_profile_business_id: no row updated for uid %', p_uid;
  END IF;
END;
$$;

-- 7. complete_manager_signup RPC
CREATE OR REPLACE FUNCTION public.complete_manager_signup(
  p_business_name TEXT,
  p_subscription_tier TEXT DEFAULT 'starter'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_full_name TEXT;
  v_slug TEXT;
  v_base_slug TEXT;
  v_suffix INT := 0;
  v_new_business_id UUID;
  v_profile RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'complete_manager_signup: not authenticated';
  END IF;

  SELECT email, full_name, business_id INTO v_profile
  FROM public.profiles WHERE id = v_uid;

  IF v_profile.business_id IS NOT NULL THEN
    RETURN;
  END IF;

  v_email := COALESCE(v_profile.email, (SELECT email FROM auth.users WHERE id = v_uid));
  v_full_name := v_profile.full_name;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_uid, v_email, v_full_name, 'client')
  ON CONFLICT (id) DO NOTHING;

  v_base_slug := lower(regexp_replace(
    regexp_replace(
      translate(trim(p_business_name), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ), '-+', '-', 'g'
  ));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'negocio';
  END IF;

  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.businesses (
    name,
    slug,
    email,
    owner_id,
    subscription_tier,
    subscription_status,
    onboarding_completed
  ) VALUES (
    trim(p_business_name),
    v_slug,
    v_email,
    v_uid,
    CASE WHEN p_subscription_tier IN ('starter', 'basic', 'pro', 'enterprise') THEN p_subscription_tier ELSE 'starter' END,
    CASE WHEN p_subscription_tier = 'starter' THEN 'active' ELSE 'trialing' END,
    true
  )
  RETURNING id INTO v_new_business_id;

  PERFORM public.set_profile_business_id(v_uid, v_new_business_id);
END;
$$;
