-- GDPR-oriented consent audit log (written only via Edge Function + service role).
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  anonymous_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  policy_version text NOT NULL,
  preferences boolean NOT NULL DEFAULT false,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  locale text
);

COMMENT ON TABLE public.cookie_consents IS 'Append-only cookie category choices for compliance; no direct client access.';

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

-- No policies: anon/authenticated cannot read or write; service role bypasses RLS.

REVOKE ALL ON public.cookie_consents FROM PUBLIC;
REVOKE ALL ON public.cookie_consents FROM anon;
REVOKE ALL ON public.cookie_consents FROM authenticated;
GRANT ALL ON public.cookie_consents TO service_role;
