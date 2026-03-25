-- Canonical business slugs: {slugify(name)}-{last_6_hex_of_id}
-- Legacy slugs preserved in business_slug_aliases for redirects / resolution.

CREATE TABLE IF NOT EXISTS public.business_slug_aliases (
  old_slug TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_slug_aliases_business_id_idx
  ON public.business_slug_aliases (business_id);

ALTER TABLE public.business_slug_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business slug aliases"
  ON public.business_slug_aliases
  FOR SELECT
  USING (true);

CREATE POLICY "Managers can insert aliases for their business"
  ON public.business_slug_aliases
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

COMMENT ON TABLE public.business_slug_aliases IS 'Previous public slugs after canonical slug migration or rename; used for URL resolution.';

-- Match manager signup slugify (accent translate + non-alphanumeric to hyphen).
CREATE OR REPLACE FUNCTION public.slugify_business_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(
      both '-' FROM lower(
        regexp_replace(
          regexp_replace(
            translate(trim(p_name), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
            '[^a-zA-Z0-9]+', '-', 'g'
          ),
          '-+', '-', 'g'
        )
      )
    ),
    ''
  );
$$;

-- Backfill: store old slug, assign canonical slug (lengthen suffix if collision).
DO $$
DECLARE
  r RECORD;
  v_old TEXT;
  v_base TEXT;
  v_hex TEXT;
  v_len INT;
  v_candidate TEXT;
BEGIN
  FOR r IN SELECT id, name, slug FROM public.businesses ORDER BY created_at ASC
  LOOP
    v_old := r.slug;
    v_base := public.slugify_business_name(r.name);
    IF v_base IS NULL OR v_base = '' THEN
      v_base := 'negocio';
    END IF;
    v_hex := replace(lower(r.id::text), '-', '');
    v_len := 6;
    v_candidate := v_base || '-' || right(v_hex, v_len);
    WHILE EXISTS (SELECT 1 FROM public.businesses b WHERE b.slug = v_candidate AND b.id <> r.id)
    LOOP
      v_len := v_len + 1;
      IF v_len > 32 THEN
        v_candidate := v_base || '-' || v_hex;
        EXIT;
      END IF;
      v_candidate := v_base || '-' || right(v_hex, v_len);
    END LOOP;

    IF v_old IS NOT NULL AND v_old IS DISTINCT FROM v_candidate THEN
      INSERT INTO public.business_slug_aliases (old_slug, business_id)
      VALUES (v_old, r.id)
      ON CONFLICT (old_slug) DO NOTHING;
    END IF;

    UPDATE public.businesses SET slug = v_candidate WHERE id = r.id;
  END LOOP;
END;
$$;

-- Signup: pre-generate id so slug can include id suffix before insert.
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
  v_short_code TEXT;
  v_tier TEXT;
  v_status TEXT;
  v_new_business_id UUID;
  v_profile RECORD;
  v_staff_id UUID;
  v_pin TEXT;
  v_tries INT := 0;
  v_hex TEXT;
  v_len INT := 6;
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

  v_new_business_id := gen_random_uuid();
  v_hex := replace(lower(v_new_business_id::text), '-', '');
  v_len := 6;
  v_slug := v_base_slug || '-' || right(v_hex, v_len);
  WHILE EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) LOOP
    v_len := v_len + 1;
    IF v_len > 32 THEN
      v_slug := v_base_slug || '-' || v_hex;
      EXIT;
    END IF;
    v_slug := v_base_slug || '-' || right(v_hex, v_len);
  END LOOP;

  LOOP
    v_short_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE short_code = v_short_code);
  END LOOP;

  INSERT INTO public.businesses (
    id, name, slug, short_code, email, owner_id, subscription_tier, subscription_status, onboarding_completed
  ) VALUES (
    v_new_business_id, trim(p_business_name), v_slug, v_short_code, v_email, v_uid, v_tier, v_status, true
  );

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

REVOKE ALL ON FUNCTION public.slugify_business_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slugify_business_name(TEXT) TO authenticated, service_role;
