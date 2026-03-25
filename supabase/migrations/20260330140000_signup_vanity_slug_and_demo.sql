-- LinkedIn-style signup: unique vanity slug from business name with numeric suffix on collision.
-- Demo business uses slug `demo`; previous slug preserved as alias when it differed.

CREATE OR REPLACE FUNCTION public.complete_manager_signup(
  p_business_name TEXT,
  p_subscription_tier TEXT DEFAULT 'basic'
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
  v_short_code TEXT;
  v_tier TEXT;
  v_status TEXT;
  v_new_business_id UUID;
  v_profile RECORD;
  v_staff_id UUID;
  v_pin TEXT;
  v_tries INT := 0;
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

  v_tier := CASE WHEN p_subscription_tier IN ('basic', 'growth', 'pro') THEN p_subscription_tier ELSE 'basic' END;
  v_status := 'trialing';

  v_base_slug := public.slugify_business_name(trim(p_business_name));
  IF v_base_slug IS NULL OR v_base_slug = '' THEN
    v_base_slug := 'negocio';
  END IF;

  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  END LOOP;

  LOOP
    v_short_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE short_code = v_short_code);
  END LOOP;

  INSERT INTO public.businesses (
    name, slug, short_code, email, owner_id, subscription_tier, subscription_status, onboarding_completed
  ) VALUES (
    trim(p_business_name), v_slug, v_short_code, v_email, v_uid, v_tier, v_status, true
  )
  RETURNING id INTO v_new_business_id;

  INSERT INTO public.subscriptions (business_id, profile_id, subscription_tier, subscription_status)
  VALUES (v_new_business_id, v_uid, v_tier, v_status);

  PERFORM public.set_profile_business_id(v_uid, v_new_business_id);

  v_pin := '0000';
  v_tries := 0;
  WHILE v_tries < 500 LOOP
    v_tries := v_tries + 1;
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.staff WHERE business_id = v_new_business_id AND pin = v_pin
    );
  END LOOP;

  INSERT INTO public.staff (
    business_id, name, email, phone, pin, hourly_rate, role, status, access_role, user_id,
    created_at, updated_at
  ) VALUES (
    v_new_business_id,
    COALESCE(nullif(trim(v_full_name), ''), 'Manager'),
    v_email,
    '',
    v_pin,
    15,
    'manager',
    'active',
    'manager',
    v_uid,
    now(),
    now()
  )
  RETURNING id INTO v_staff_id;

  UPDATE public.profiles SET staff_id = v_staff_id WHERE id = v_uid;
END;
$$;

-- Demo tenant: prefer memorable slug `demo` when available; keep old slug as alias.
DO $$
DECLARE
  v_demo CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_old text;
BEGIN
  SELECT b.slug INTO v_old FROM public.businesses b WHERE b.id = v_demo;
  IF v_old IS NULL THEN
    RETURN;
  END IF;
  IF v_old = 'demo' THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.businesses b WHERE b.slug = 'demo' AND b.id <> v_demo) THEN
    RETURN;
  END IF;
  INSERT INTO public.business_slug_aliases (old_slug, business_id)
  VALUES (v_old, v_demo)
  ON CONFLICT (old_slug) DO NOTHING;
  UPDATE public.businesses SET slug = 'demo', updated_at = now() WHERE id = v_demo;
END;
$$;
