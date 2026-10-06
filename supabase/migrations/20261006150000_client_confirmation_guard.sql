-- Guard for the send-client-confirmation Edge Function (callable without signing in from /registro).
-- It may only email an address that signed up in the last hour and hasn't confirmed yet, at most 3 times
-- per hour, and only for a real business slug. Only the Edge Function (service role) can call this.

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_confirmation_sends (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_confirmation_sends_email ON public.client_confirmation_sends (email, sent_at DESC);
ALTER TABLE public.client_confirmation_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_confirmation_sends FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_client_confirmation_send(p_email TEXT, p_business_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_business_name TEXT;
  v_recent INT;
BEGIN
  SELECT b.name INTO v_business_name
  FROM public.businesses b
  WHERE b.id = public.resolve_public_business_id(p_business_slug);
  IF v_business_name IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'business_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = v_email
      AND u.email_confirmed_at IS NULL
      AND u.created_at > now() - interval '1 hour'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_pending_signup');
  END IF;

  DELETE FROM public.client_confirmation_sends WHERE sent_at < now() - interval '1 day';
  SELECT count(*) INTO v_recent FROM public.client_confirmation_sends
  WHERE email = v_email AND sent_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'too_many');
  END IF;

  INSERT INTO public.client_confirmation_sends (email) VALUES (v_email);
  RETURN jsonb_build_object('allowed', true, 'business_name', v_business_name);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_client_confirmation_send(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_confirmation_send(TEXT, TEXT) TO service_role;

COMMIT;
