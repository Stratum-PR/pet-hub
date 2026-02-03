-- ============================================
-- RPC: complete_manager_signup(business_name)
-- ============================================
-- Used after OAuth callback when user signed up from manager signup page
-- with business name stored in sessionStorage. Creates business and links
-- profile to it (role = manager, business_id set).

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

  -- Generate short_code for businesses table (required in some schemas).
  -- Slug from name (alphanumeric, max 12 chars) + 4-char suffix for uniqueness.
  short_code_val := lower(substring(regexp_replace(trimmed_name, '[^a-zA-Z0-9]', '', 'g') from 1 for 12));
  IF short_code_val IS NULL OR short_code_val = '' THEN
    short_code_val := 'b' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 7);
  ELSE
    short_code_val := short_code_val || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4);
  END IF;

  INSERT INTO public.businesses (name, email, subscription_tier, subscription_status, short_code)
  VALUES (trimmed_name, COALESCE(user_email, ''), 'basic', 'trialing', short_code_val)
  RETURNING id INTO new_business_id;

  UPDATE public.profiles
  SET business_id = new_business_id, role = 'manager'
  WHERE id = uid;
END;
$$;
