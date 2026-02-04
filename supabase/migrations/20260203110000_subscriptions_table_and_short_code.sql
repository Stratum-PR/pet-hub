-- ============================================
-- Subscriptions table + short_code in signup
-- ============================================
-- Best practice: Keep both businesses (current tier/status for fast reads)
-- and subscriptions (one row per signup: business_id, profile_id, tier).
-- Subscriptions supports history and future Stripe integration.

-- 1. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('starter', 'basic', 'pro', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile_id ON public.subscriptions(profile_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Managers and super admins can read subscriptions for their business
CREATE POLICY "Users can read subscriptions for own business"
  ON public.subscriptions FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Only the signup RPC (SECURITY DEFINER) inserts; no direct user INSERT policy needed for app.
-- Allow service/definer to insert (RPC runs as definer).
CREATE POLICY "Authenticated can insert own subscription record"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- 2. Replace complete_manager_signup: add short_code, insert into subscriptions
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
  v_short_code TEXT;
  v_tier TEXT;
  v_status TEXT;
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

  v_tier := CASE WHEN p_subscription_tier IN ('starter', 'basic', 'pro', 'enterprise') THEN p_subscription_tier ELSE 'starter' END;
  v_status := CASE WHEN p_subscription_tier = 'starter' THEN 'active' ELSE 'trialing' END;

  -- Slug from business name
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

  -- Unique short_code (6 alphanumeric chars)
  LOOP
    v_short_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE short_code = v_short_code);
  END LOOP;

  INSERT INTO public.businesses (
    name,
    slug,
    short_code,
    email,
    owner_id,
    subscription_tier,
    subscription_status,
    onboarding_completed
  ) VALUES (
    trim(p_business_name),
    v_slug,
    v_short_code,
    v_email,
    v_uid,
    v_tier,
    v_status,
    true
  )
  RETURNING id INTO v_new_business_id;

  INSERT INTO public.subscriptions (business_id, profile_id, subscription_tier, subscription_status)
  VALUES (v_new_business_id, v_uid, v_tier, v_status);

  PERFORM public.set_profile_business_id(v_uid, v_new_business_id);
END;
$$;
