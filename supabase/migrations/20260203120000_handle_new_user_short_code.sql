-- ============================================
-- handle_new_user: set short_code when creating business
-- ============================================
-- Some environments have businesses.short_code NOT NULL. Generate it when
-- creating a business in the manager signup trigger.

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
  short_code_val TEXT;
BEGIN
  signup_role_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'signup_role', '')), '');
  business_name_val := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), '');

  IF signup_role_val = 'manager' AND business_name_val IS NOT NULL AND LENGTH(business_name_val) > 0 THEN
    -- Generate short_code for businesses table (required in some schemas)
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
  ELSE
    profile_role_val := COALESCE(NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'signup_role', '')), ''), 'client');
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
