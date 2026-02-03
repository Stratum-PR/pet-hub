-- ============================================
-- Add profile.role and manager signup (handle_new_user)
-- ============================================
-- 1. Add role column to profiles
-- 2. Backfill existing profiles
-- 3. Replace handle_new_user to create business + set business_id/role for manager signups

-- Add role column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin','manager','employee','client'));

-- Backfill: super_admins -> admin, has business_id -> manager, else -> client
UPDATE public.profiles
SET role = CASE
  WHEN is_super_admin = true THEN 'admin'
  WHEN business_id IS NOT NULL THEN 'manager'
  ELSE 'client'
END
WHERE role IS NULL;

-- Replace handle_new_user to support manager signup with business creation
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
  profile_role_val TEXT;
BEGIN
  signup_role_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'signup_role', '')), '');
  business_name_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), '');

  IF signup_role_val = 'manager' AND business_name_val IS NOT NULL AND LENGTH(business_name_val) > 0 THEN
    -- Create business for manager signup
    INSERT INTO public.businesses (name, email, subscription_tier, subscription_status)
    VALUES (business_name_val, NEW.email, 'basic', 'trialing')
    RETURNING id INTO new_business_id;

    INSERT INTO public.profiles (id, email, full_name, role, business_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'manager',
      new_business_id
    );
  ELSE
    -- Non-manager: insert profile with role from metadata or default 'client'
    profile_role_val := COALESCE(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'signup_role', '')), ''), 'client');
    -- Ensure role is one of allowed values
    IF profile_role_val NOT IN ('admin','manager','employee','client') THEN
      profile_role_val := 'client';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      profile_role_val
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger already exists from initial migration; ensure it uses the updated function
-- (no need to recreate trigger, function replace is enough)
