-- Rate-limit PIN guesses on the time clock.
-- clock_in_out(pin, business_id, ...) is callable without signing in (the kiosk) and PINs are 4 digits,
-- so without a limit anyone could try all 10,000 PINs for a business and clock staff in or out.
--
-- The original function is renamed to clock_in_out_unthrottled (no longer callable from the API) and a
-- wrapper with the same name and signature records failed PIN attempts:
--   * 8 wrong PINs from the same network for a business in 15 minutes  → that network waits.
--   * 40 wrong PINs for a business in 15 minutes from anywhere        → the business's kiosk waits.
-- Successful clock-ins and other errors (geofence, etc.) don't count. The app needs no changes: the
-- wrapper returns the same {success:false, error, message} shape the kiosk already shows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.clock_pin_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID NOT NULL,
  client_ip TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clock_pin_attempts_business_time
  ON public.clock_pin_attempts (business_id, attempted_at DESC);
ALTER TABLE public.clock_pin_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions touch this table.
REVOKE ALL ON public.clock_pin_attempts FROM anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.clock_in_out_unthrottled(text,uuid,numeric,numeric,text,text)') IS NULL THEN
    ALTER FUNCTION public.clock_in_out(text, uuid, numeric, numeric, text, text)
      RENAME TO clock_in_out_unthrottled;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.clock_in_out_unthrottled(text, uuid, numeric, numeric, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clock_in_out(
  p_employee_pin text,
  p_business_id uuid,
  p_latitude numeric DEFAULT NULL::numeric,
  p_longitude numeric DEFAULT NULL::numeric,
  p_location_name text DEFAULT NULL::text,
  p_support_feature_tier text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_headers json;
  v_ip text;
  v_ip_failures int;
  v_business_failures int;
  v_result jsonb;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;
  v_ip := NULLIF(trim(split_part(COALESCE(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1)), '');

  -- Old rows are only needed for the 15-minute window.
  DELETE FROM public.clock_pin_attempts WHERE attempted_at < now() - interval '1 day';

  SELECT
    count(*) FILTER (WHERE v_ip IS NOT NULL AND client_ip = v_ip),
    count(*)
  INTO v_ip_failures, v_business_failures
  FROM public.clock_pin_attempts
  WHERE business_id = p_business_id
    AND attempted_at > now() - interval '15 minutes';

  IF v_ip_failures >= 8 OR v_business_failures >= 40 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'too_many_attempts',
      'message', 'Demasiados intentos con PIN incorrecto. Espera 15 minutos o pide ayuda a tu gerente. / Too many wrong PINs. Wait 15 minutes or ask your manager.'
    );
  END IF;

  v_result := public.clock_in_out_unthrottled(
    p_employee_pin, p_business_id, p_latitude, p_longitude, p_location_name, p_support_feature_tier
  );

  IF v_result->>'error' = 'invalid_pin' THEN
    INSERT INTO public.clock_pin_attempts (business_id, client_ip) VALUES (p_business_id, v_ip);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.clock_in_out(text, uuid, numeric, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clock_in_out(text, uuid, numeric, numeric, text, text) TO anon, authenticated;

COMMIT;
