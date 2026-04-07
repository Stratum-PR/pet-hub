-- Store locator + saved payment methods (schema only) + directory read for businesses with slug

BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS maps_embed_url TEXT;

COMMENT ON COLUMN public.businesses.maps_embed_url IS
  'Google Maps embed src URL or share link for client portal / directory.';

-- Allow unauthenticated and authenticated users to list businesses that opted into a public slug (directory / portal discovery)
DROP POLICY IF EXISTS "Public can read businesses with slug for directory" ON public.businesses;
CREATE POLICY "Public can read businesses with slug for directory"
  ON public.businesses FOR SELECT
  TO anon, authenticated
  USING (
    slug IS NOT NULL
    AND btrim(slug) <> ''
  );

CREATE TABLE IF NOT EXISTS public.client_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  external_id TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month SMALLINT,
  exp_year SMALLINT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_payment_methods_profile
  ON public.client_payment_methods (profile_id);

ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved payment methods" ON public.client_payment_methods;
CREATE POLICY "Users manage own saved payment methods"
  ON public.client_payment_methods FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

COMMIT;
