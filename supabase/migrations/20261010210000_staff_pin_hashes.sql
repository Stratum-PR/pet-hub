-- P2-02: hash staff kiosk PINs (pgcrypto crypt), migrating existing PINs in place so nobody needs a reset.
--
-- Before: staff.pin holds every kiosk PIN in plain text. Every member of a business reads it (RLS
-- staff_select_business_members), clock_in_out compares it in plain text, and the app selects it to look staff up.
--
-- EXPAND step (one database serves `main`, production's April frontend, and `dev`/`remediation`):
--   * staff.pin is NOT changed, dropped, nulled or revoked. main (and dev) still read it (useTimeKiosk.getEmployeeByPin:
--     select('*').eq('pin', typed PIN); fetchEmployeePinsForBusiness; EmployeeManagement shows/edits it) and write it
--     (staff insert/update), so their kiosk and staff screens keep working unchanged.
--   * New public.staff_pin_hashes (staff_id, business_id, pin_hash): bcrypt hash of the PIN. The trigger
--     staff_sync_pin_hash (AFTER INSERT OR UPDATE OF pin, business_id ON staff) keeps it in sync with whatever any
--     frontend, function or the service role writes to staff.pin; a blank PIN or no business removes the hash; deleting
--     the staff row cascades. Existing PINs are hashed below (staff_pin_hashes_backfill), so nobody needs a reset.
--   * One bcrypt salt per business (public.staff_pin_salts, gen_salt('bf', 8)). Same PIN + same business = same
--     hash, so a PIN check is one crypt() plus an index lookup, and per-business uniqueness can later be enforced on the
--     hash alone. PINs are already unique per business (staff_business_pin_unique), so this reveals nothing the plain
--     column doesn't. A 4-digit PIN is brute-forceable from any hash; the point is that the hash table is readable by
--     nobody but the service role, and that the plain column can be dropped in the contract step.
--   * Hashes and salts: RLS on with no policies, every privilege revoked from anon/authenticated. Only these SECURITY
--     DEFINER functions (and the service role) touch them.
--   * clock_in_out_unthrottled now finds the staff member by hash. Its callers (main, dev, remediation) all pass the
--     PIN the person typed, so they need no change. The wrapper clock_in_out (rate limit) is not changed.
--     One tightening: a blank PIN never matches (before, '' matched a staff row with pin '' and pin_required false).
--   * New RPCs for the remediation frontend, which stops selecting staff.pin:
--       kiosk_staff_by_pin(business, pin)            member of the business; kiosk confirmation columns, never the PIN;
--                                                    wrong PINs count toward clock_in_out's limit (clock_pin_attempts).
--       staff_pin_available(business, pin, exclude)  managers (is_business_manager); uniqueness and manager-PIN prefix.
--       generate_staff_pin(business, exclude, reserved) member; a random free 4-digit PIN (staff form auto-fill,
--                                                    also used by an employee's self-service form).
--   * Internal, service-role only: staff_pin_hash(business, pin, create_salt), staff_pin_hashes_backfill().
--
-- CONTRACT step (a later unit, once `main` runs the remediation frontend; NOT done here): drop or null staff.pin (and
-- staff_business_pin_unique), make staff_pin_hashes (business_id, pin_hash) unique, change the staff writers to set
-- PINs through an RPC (set_staff_pin) that writes only the hash, remove `pin` from clock_in_out_unthrottled's SELECT,
-- and move the known() "employee cannot read a coworker's kiosk PIN" test to check().
--
-- Requires: 20261006130000_clock_in_pin_rate_limit.sql (clock_pin_attempts, clock_in_out_unthrottled),
-- 20261009120000_staff_rls_rewrite.sql (is_business_member, is_business_manager), and pgcrypto (Supabase: schema
-- extensions). Idempotent. Rollback: supabase/rollbacks/20261010210000_staff_pin_hashes.down.sql.

DO $$
BEGIN
  IF to_regprocedure('public.is_business_member(uuid)') IS NULL OR to_regprocedure('public.is_business_manager(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_business_member / is_business_manager are missing: apply 20261009120000_staff_rls_rewrite.sql first';
  END IF;
  IF to_regclass('public.clock_pin_attempts') IS NULL
     OR to_regprocedure('public.clock_in_out_unthrottled(text,uuid,numeric,numeric,text,text)') IS NULL THEN
    RAISE EXCEPTION 'clock_pin_attempts / clock_in_out_unthrottled are missing: apply 20261006130000_clock_in_pin_rate_limit.sql first';
  END IF;
  IF to_regprocedure('extensions.crypt(text,text)') IS NULL OR to_regprocedure('extensions.gen_salt(text,integer)') IS NULL
     OR to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto is not installed in schema extensions (CREATE EXTENSION pgcrypto WITH SCHEMA extensions)';
  END IF;
END
$$;

-- ---------- tables ----------

CREATE TABLE IF NOT EXISTS public.staff_pin_salts (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_pin_hashes (
  staff_id uuid PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Not unique yet: staff_business_pin_unique on the plain column enforces uniqueness during the expand step (a unique
-- hash index could reject a multi-row update that the plain index accepts, depending on trigger order).
CREATE INDEX IF NOT EXISTS idx_staff_pin_hashes_business_hash ON public.staff_pin_hashes (business_id, pin_hash);

ALTER TABLE public.staff_pin_salts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_pin_hashes ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER functions below and the service role use these tables.
REVOKE ALL ON public.staff_pin_salts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.staff_pin_hashes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.staff_pin_salts TO service_role;
GRANT ALL ON public.staff_pin_hashes TO service_role;

COMMENT ON TABLE public.staff_pin_hashes IS
  'P2-02: bcrypt hash of staff.pin (per-business salt in staff_pin_salts), kept in sync by trigger staff_sync_pin_hash. Service role and SECURITY DEFINER functions only.';
COMMENT ON TABLE public.staff_pin_salts IS
  'P2-02: one bcrypt salt per business for staff kiosk PIN hashes. Service role and SECURITY DEFINER functions only.';

-- ---------- internal helpers ----------

-- The hash of a PIN for a business. NULL when the PIN is blank or the business is NULL. Without a salt yet: creates
-- one when p_create_salt, else NULL (lookups never create salts).
CREATE OR REPLACE FUNCTION public.staff_pin_hash(p_business_id uuid, p_pin text, p_create_salt boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_salt text;
BEGIN
  IF p_business_id IS NULL OR p_pin IS NULL OR btrim(p_pin) = '' THEN
    RETURN NULL;
  END IF;
  SELECT s.salt INTO v_salt FROM public.staff_pin_salts s WHERE s.business_id = p_business_id;
  IF v_salt IS NULL THEN
    IF NOT p_create_salt THEN
      RETURN NULL;
    END IF;
    INSERT INTO public.staff_pin_salts (business_id, salt)
    VALUES (p_business_id, extensions.gen_salt('bf', 8))
    ON CONFLICT (business_id) DO NOTHING;
    SELECT s.salt INTO v_salt FROM public.staff_pin_salts s WHERE s.business_id = p_business_id;
  END IF;
  RETURN extensions.crypt(p_pin, v_salt);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_pin_hash(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_pin_hash(uuid, text, boolean) TO service_role;

-- ---------- keep hashes in sync with staff.pin (every writer: main, dev, remediation, functions, service role) ----------

CREATE OR REPLACE FUNCTION public.staff_sync_pin_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.pin IS NOT DISTINCT FROM OLD.pin
     AND NEW.business_id IS NOT DISTINCT FROM OLD.business_id THEN
    RETURN NULL;
  END IF;
  IF NEW.business_id IS NULL OR NEW.pin IS NULL OR btrim(NEW.pin) = '' THEN
    DELETE FROM public.staff_pin_hashes WHERE staff_id = NEW.id;
  ELSE
    INSERT INTO public.staff_pin_hashes (staff_id, business_id, pin_hash, updated_at)
    VALUES (NEW.id, NEW.business_id, public.staff_pin_hash(NEW.business_id, NEW.pin, true), now())
    ON CONFLICT (staff_id) DO UPDATE
      SET business_id = EXCLUDED.business_id, pin_hash = EXCLUDED.pin_hash, updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_sync_pin_hash() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS staff_sync_pin_hash ON public.staff;
CREATE TRIGGER staff_sync_pin_hash
  AFTER INSERT OR UPDATE OF pin, business_id ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.staff_sync_pin_hash();

-- Hash every existing PIN (and fix any hash that drifted, e.g. after a restore with triggers off). Returns the number
-- of rows written or removed. Service role only; safe to re-run.
CREATE OR REPLACE FUNCTION public.staff_pin_hashes_backfill()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_n integer;
  r record;
  v_hash text;
BEGIN
  DELETE FROM public.staff_pin_hashes h
  USING public.staff s
  WHERE s.id = h.staff_id
    AND (s.business_id IS NULL OR s.pin IS NULL OR btrim(s.pin) = '' OR s.business_id IS DISTINCT FROM h.business_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  FOR r IN
    SELECT s.id, s.business_id, s.pin, h.pin_hash AS current_hash
    FROM public.staff s
    LEFT JOIN public.staff_pin_hashes h ON h.staff_id = s.id
    WHERE s.business_id IS NOT NULL AND s.pin IS NOT NULL AND btrim(s.pin) <> ''
  LOOP
    v_hash := public.staff_pin_hash(r.business_id, r.pin, true);
    IF r.current_hash IS DISTINCT FROM v_hash THEN
      INSERT INTO public.staff_pin_hashes (staff_id, business_id, pin_hash, updated_at)
      VALUES (r.id, r.business_id, v_hash, now())
      ON CONFLICT (staff_id) DO UPDATE
        SET business_id = EXCLUDED.business_id, pin_hash = EXCLUDED.pin_hash, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_pin_hashes_backfill() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_pin_hashes_backfill() TO service_role;

-- Migrate existing PINs in place.
SELECT public.staff_pin_hashes_backfill();

-- ---------- clock_in_out compares hashes ----------
-- Body copied verbatim from production (test-env/supabase/prod-schema-snapshot.sql); only the staff lookup changes.

CREATE OR REPLACE FUNCTION public.clock_in_out_unthrottled(p_employee_pin text, p_business_id uuid, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_location_name text DEFAULT NULL::text, p_support_feature_tier text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_staff record;
  v_active_entry record;
  v_clock_time timestamptz;
  v_rounded_clock_time timestamptz;
  v_schedule_check jsonb;
  v_geofence_check jsonb;
  v_time_entry_id text;
  v_result jsonb;
  v_entry_status text;
  v_mgr_tier boolean;
  v_pin_hash text;
BEGIN
  v_clock_time := now();
  v_rounded_clock_time := public.round_time_to_interval(v_clock_time, 15);

  -- P2-02: compare hashes (staff_pin_hashes), not the plain PIN. NULL when the PIN is blank or the business has no
  -- hashed PINs, which matches nobody.
  v_pin_hash := public.staff_pin_hash(p_business_id, p_employee_pin, false);

  SELECT s.id, s.name, s.status, s.pin_required, s.pin_set_at, s.pin, s.access_role
  INTO v_staff
  FROM public.staff s
  JOIN public.staff_pin_hashes h ON h.staff_id = s.id
  WHERE v_pin_hash IS NOT NULL
    AND h.business_id = p_business_id
    AND h.pin_hash = v_pin_hash
    AND s.business_id = p_business_id
    AND s.status = 'active';

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_pin',
      'message', 'Invalid PIN or staff member not found'
    );
  END IF;

  IF v_staff.pin_required = true AND (v_staff.pin IS NULL OR v_staff.pin = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'pin_not_set',
      'message', 'A PIN must be set before clocking in. Please contact your manager.'
    );
  END IF;

  SELECT id, clock_in, rounded_clock_in
  INTO v_active_entry
  FROM public.time_entries
  WHERE staff_id::text = v_staff.id::text
    AND clock_out IS NULL
    AND status IN ('active', 'approved')
  ORDER BY clock_in DESC
  LIMIT 1;

  IF v_active_entry.id IS NOT NULL THEN
    UPDATE public.time_entries
    SET
      clock_out = v_clock_time,
      rounded_clock_out = v_rounded_clock_time,
      location_longitude = COALESCE(p_longitude, location_longitude),
      location_latitude = COALESCE(p_latitude, location_latitude),
      location_name = COALESCE(p_location_name, location_name)
    WHERE id = v_active_entry.id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'clock_out',
      'time_entry_id', v_active_entry.id,
      'clock_out', v_clock_time,
      'rounded_clock_out', v_rounded_clock_time,
      'warning', null
    );
  ELSE
    v_geofence_check := public.check_geofence(
      p_business_id,
      p_latitude,
      p_longitude,
      p_support_feature_tier
    );
    IF (v_geofence_check->>'within_fence')::boolean = false THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', v_geofence_check->>'error',
        'message', CASE
          WHEN v_geofence_check->>'error' = 'outside_geofence' THEN
            'You must be at the store location to clock in. You are ' ||
            round((v_geofence_check->>'distance_meters')::numeric / 1000, 2) ||
            ' km away from the store.'
          WHEN v_geofence_check->>'error' = 'employee_location_required' THEN
            'Location is required for clock in. Please enable location services.'
          WHEN v_geofence_check->>'error' = 'geofence_location_not_set' THEN
            'Geofencing is enabled but store location is not set. Please contact your manager.'
          ELSE 'Location validation failed'
        END,
        'geofence_info', v_geofence_check
      );
    END IF;

    v_schedule_check := public.check_employee_schedule(v_staff.id, v_clock_time);
    v_mgr_tier := v_staff.access_role IN ('manager', 'admin');
    v_entry_status := CASE WHEN v_mgr_tier THEN 'approved' ELSE 'active' END;

    INSERT INTO public.time_entries (
      id,
      staff_id,
      business_id,
      clock_in,
      rounded_clock_in,
      location_latitude,
      location_longitude,
      location_name,
      is_off_schedule,
      status
    )
    VALUES (
      gen_random_uuid()::text,
      v_staff.id::text,
      p_business_id,
      v_clock_time,
      v_rounded_clock_time,
      p_latitude,
      p_longitude,
      p_location_name,
      NOT (v_schedule_check->>'is_scheduled')::boolean,
      v_entry_status
    )
    RETURNING id INTO v_time_entry_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'clock_in',
      'time_entry_id', v_time_entry_id,
      'clock_in', v_clock_time,
      'rounded_clock_in', v_rounded_clock_time,
      'warning', v_schedule_check->>'warning',
      'is_off_schedule', NOT (v_schedule_check->>'is_scheduled')::boolean,
      'schedule_info', v_schedule_check,
      'auto_approved', v_mgr_tier
    );
  END IF;

  RETURN v_result;
END;
$function$
;
-- CREATE OR REPLACE keeps the function's privileges: still callable only through the rate-limited wrapper
-- clock_in_out (REVOKE in 20261006130000).

-- ---------- RPCs for the remediation frontend (it no longer selects staff.pin) ----------

-- Kiosk PIN entry (useTimeKiosk.getEmployeeByPin): the active staff member of this business with this PIN, with the
-- columns the confirmation screen shows. Never returns the PIN or its hash. Wrong PINs are recorded in
-- clock_pin_attempts and share clock_in_out's limits (8 per network / 40 per business in 15 minutes).
CREATE OR REPLACE FUNCTION public.kiosk_staff_by_pin(p_business_id uuid, p_pin text)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  name text,
  role text,
  access_role text,
  status text,
  photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_headers json;
  v_ip text;
  v_ip_failures int;
  v_business_failures int;
  v_hash text;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;
  v_ip := NULLIF(trim(split_part(COALESCE(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1)), '');

  SELECT
    count(*) FILTER (WHERE v_ip IS NOT NULL AND a.client_ip = v_ip),
    count(*)
  INTO v_ip_failures, v_business_failures
  FROM public.clock_pin_attempts a
  WHERE a.business_id = p_business_id
    AND a.attempted_at > now() - interval '15 minutes';

  IF v_ip_failures >= 8 OR v_business_failures >= 40 THEN
    RAISE EXCEPTION 'too_many_attempts'
      USING ERRCODE = 'P0001',
            DETAIL = 'Demasiados intentos con PIN incorrecto. Espera 15 minutos o pide ayuda a tu gerente. / Too many wrong PINs. Wait 15 minutes or ask your manager.';
  END IF;

  v_hash := public.staff_pin_hash(p_business_id, p_pin, false);

  RETURN QUERY
    SELECT s.id, s.business_id, s.name, s.role, s.access_role, s.status, s.photo_url
    FROM public.staff s
    JOIN public.staff_pin_hashes h ON h.staff_id = s.id
    WHERE v_hash IS NOT NULL
      AND h.business_id = p_business_id
      AND h.pin_hash = v_hash
      AND s.business_id = p_business_id
      AND s.status = 'active'
    LIMIT 1;

  -- FOUND: RETURN QUERY returned a row.
  IF NOT FOUND THEN
    INSERT INTO public.clock_pin_attempts (business_id, client_ip) VALUES (p_business_id, v_ip);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_staff_by_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_staff_by_pin(uuid, text) TO authenticated, service_role;

-- PIN uniqueness and the kiosk manager PIN prefix check (KioskManagerPinSettings / KioskManagerPinResetDialog):
-- true when no other staff member of the business has this PIN. Managers only, so employees can't probe PINs.
CREATE OR REPLACE FUNCTION public.staff_pin_available(p_business_id uuid, p_pin text, p_exclude_staff_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hash text;
BEGIN
  IF NOT public.is_business_manager(p_business_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  v_hash := public.staff_pin_hash(p_business_id, p_pin, false);
  IF v_hash IS NULL THEN
    RETURN true;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.staff_pin_hashes h
    WHERE h.business_id = p_business_id
      AND h.pin_hash = v_hash
      AND h.staff_id IS DISTINCT FROM p_exclude_staff_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_pin_available(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_pin_available(uuid, text, uuid) TO authenticated, service_role;

-- A random 4-digit PIN no other staff member of the business has (p_exclude_staff_id: the person being edited, who may
-- keep theirs) and that isn't p_reserved (the kiosk manager PIN's first 4 digits). Any member of the business: the
-- staff form fills it in for managers and for an employee's own self-service form.
CREATE OR REPLACE FUNCTION public.generate_staff_pin(
  p_business_id uuid,
  p_exclude_staff_id uuid DEFAULT NULL,
  p_reserved text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_candidate text;
  v_hash text;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  FOR i IN 1..200 LOOP
    v_candidate := lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::int) % 10000)::text, 4, '0');
    CONTINUE WHEN v_candidate IS NOT DISTINCT FROM p_reserved;
    v_hash := public.staff_pin_hash(p_business_id, v_candidate, true);
    IF NOT EXISTS (
      SELECT 1
      FROM public.staff_pin_hashes h
      WHERE h.business_id = p_business_id
        AND h.pin_hash = v_hash
        AND h.staff_id IS DISTINCT FROM p_exclude_staff_id
    ) THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'could not generate a unique PIN for this business';
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_staff_pin(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_staff_pin(uuid, uuid, text) TO authenticated, service_role;
