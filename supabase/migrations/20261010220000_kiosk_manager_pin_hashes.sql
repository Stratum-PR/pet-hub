-- P2-04: hash the kiosk manager PIN (businesses.kiosk_manager_pin), the same way P2-02 hashed staff PINs.
--
-- Before: businesses.kiosk_manager_pin holds the 6-digit PIN that unlocks the punch-clock kiosk in plain text. Every
-- member of the business reads it ("Businesses select"), and so does anyone, signed in or not, for every business with
-- a slug ("Public can read businesses with slug for directory"). The kiosk, the manager PIN settings and the employee
-- PIN generator compare it in the browser.
--
-- EXPAND step (one database serves `main`, production's April frontend, and `dev`/`remediation`):
--   * businesses.kiosk_manager_pin is NOT changed, dropped, nulled or revoked. main reads it (TimeKiosk lock gate and
--     PIN entry, KioskManagerAccess, KioskManagerPinSettings, generateUniqueEmployeePin) and writes it
--     (KioskManagerAccess, KioskManagerPinSettings, KioskManagerPinResetDialog), so main keeps working unchanged.
--   * New public.kiosk_manager_pin_hashes (business_id, pin_hash, prefix_hash, pin_length): bcrypt hash of the PIN,
--     plus the hash of its first 4 digits when it has 6 (the kiosk needs to know when 4 typed digits are the start of
--     the manager PIN, and staff PINs must not equal that prefix). Same per-business salt as staff PINs
--     (staff_pin_salts, via staff_pin_hash), so the prefix hash equals the hash a staff member with that 4-digit PIN
--     has, and collisions are one index lookup. Kept in sync by trigger businesses_sync_kiosk_manager_pin_hash
--     (AFTER INSERT OR UPDATE OF kiosk_manager_pin ON businesses) with every writer: main, dev, remediation,
--     functions, the service role. A blank PIN removes the hash; deleting the business cascades. Existing PINs are
--     hashed below (kiosk_manager_pin_hashes_backfill), so nobody needs to set the PIN again.
--   * Hashes: RLS on with no policies, every privilege revoked from anon/authenticated. Only these SECURITY DEFINER
--     functions (and the service role) touch them. The prefix hash makes the 6-digit PIN as guessable from the hashes
--     as a 4-digit staff PIN plus 100 tries; the protection is that nobody but the service role reads them.
--   * New for the remediation frontend, which stops reading the plain PIN:
--       businesses.kiosk_manager_pin_set                  computed field (PostgREST: select('kiosk_manager_pin_set'),
--                                                         not part of select('*')); true when a 6-digit manager PIN
--                                                         is set, NULL for non-members (kiosk lock gate, settings
--                                                         "current PIN" field, employee PIN generator). Before this
--                                                         migration the select fails with 42703, which is how the
--                                                         frontend knows to fall back to the plain column.
--       kiosk_pin_entry(business, pin)                    member; the kiosk keypad. 4 digits: the staff member with
--                                                         that PIN, else "manager_prefix" when they start the manager
--                                                         PIN; 5 digits: "manager_prefix" or invalid; 6 digits:
--                                                         "manager" (plus the staff member with that PIN, as today).
--                                                         Wrong entries count in clock_pin_attempts and share
--                                                         clock_in_out's limits (8 per network / 40 per business in
--                                                         15 minutes); a prefix answer is not a failure.
--       set_kiosk_manager_pin(business, new, current)    managers (is_business_manager). 6 digits; its first 4 must
--                                                         not be a staff PIN. When a 6-digit PIN exists: the current
--                                                         PIN (checked by hash, wrong ones rate-limited) or a password
--                                                         sign-in in the last 10 minutes (the reset dialog's step-up).
--                                                         Writes businesses.kiosk_manager_pin, so main sees the new
--                                                         PIN and the trigger updates the hash.
--   * generate_staff_pin (P2-02) also skips the manager PIN's first 4 digits server-side, so the frontend no longer
--     reads the manager PIN to pass p_reserved (still honoured).
--   * Internal, service-role only: kiosk_manager_pin_hashes_backfill(), kiosk_pin_throttle(business),
--     caller_recent_password_sign_in(seconds).
--
-- Who may set the PIN, before and after: the database allows any member of the business to update the businesses row
-- (main's path, unchanged here). The UI offers the settings card to non-employee roles and the reset dialog to
-- managers/super admins, and asks for the current PIN or the account password. set_kiosk_manager_pin enforces that
-- in the database for the remediation frontend.
--
-- CONTRACT step (a later unit, once `main` runs the remediation frontend; NOT done here): remove the frontend fallbacks;
-- null businesses.kiosk_manager_pin (or drop it) and stop syncing from it (set_kiosk_manager_pin writes only the hash);
-- until then, revoke SELECT on the column from anon/authenticated (column grants on businesses, which also needs every
-- remaining select('*') on businesses gone); move the known() manager-PIN read tests to check().
--
-- Requires: 20261010210000_staff_pin_hashes.sql (staff_pin_hash, staff_pin_salts, staff_pin_hashes,
-- generate_staff_pin), 20261009120000 (is_business_member/manager), 20261006130000 (clock_pin_attempts) and pgcrypto
-- in schema extensions. Idempotent. Rollback: supabase/rollbacks/20261010220000_kiosk_manager_pin_hashes.down.sql.

DO $$
BEGIN
  IF to_regprocedure('public.staff_pin_hash(uuid,text,boolean)') IS NULL OR to_regclass('public.staff_pin_hashes') IS NULL
     OR to_regclass('public.staff_pin_salts') IS NULL
     OR to_regprocedure('public.generate_staff_pin(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'staff PIN hashing is missing: apply 20261010210000_staff_pin_hashes.sql first';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid)') IS NULL OR to_regprocedure('public.is_business_manager(uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_business_member / is_business_manager are missing: apply 20261009120000_staff_rls_rewrite.sql first';
  END IF;
  IF to_regclass('public.clock_pin_attempts') IS NULL THEN
    RAISE EXCEPTION 'clock_pin_attempts is missing: apply 20261006130000_clock_in_pin_rate_limit.sql first';
  END IF;
  IF to_regprocedure('extensions.crypt(text,text)') IS NULL OR to_regprocedure('extensions.gen_salt(text,integer)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto is not installed in schema extensions (CREATE EXTENSION pgcrypto WITH SCHEMA extensions)';
  END IF;
END
$$;

-- ---------- table ----------

CREATE TABLE IF NOT EXISTS public.kiosk_manager_pin_hashes (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  prefix_hash text,
  pin_length integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kiosk_manager_pin_hashes ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER functions below and the service role use this table.
REVOKE ALL ON public.kiosk_manager_pin_hashes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kiosk_manager_pin_hashes TO service_role;

COMMENT ON TABLE public.kiosk_manager_pin_hashes IS
  'P2-04: bcrypt hash of businesses.kiosk_manager_pin (and of its first 4 digits when it has 6), salt from staff_pin_salts, kept in sync by trigger businesses_sync_kiosk_manager_pin_hash. Service role and SECURITY DEFINER functions only.';

-- ---------- keep the hash in sync with businesses.kiosk_manager_pin (every writer) ----------

CREATE OR REPLACE FUNCTION public.businesses_sync_kiosk_manager_pin_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pin text := NEW.kiosk_manager_pin;
BEGIN
  IF TG_OP = 'UPDATE' AND v_pin IS NOT DISTINCT FROM OLD.kiosk_manager_pin THEN
    RETURN NULL;
  END IF;
  IF v_pin IS NULL OR btrim(v_pin) = '' THEN
    DELETE FROM public.kiosk_manager_pin_hashes WHERE business_id = NEW.id;
  ELSE
    -- The plain value as stored (no trim): main compares it as is and calls it configured when length = 6.
    INSERT INTO public.kiosk_manager_pin_hashes (business_id, pin_hash, prefix_hash, pin_length, updated_at)
    VALUES (
      NEW.id,
      public.staff_pin_hash(NEW.id, v_pin, true),
      CASE WHEN length(v_pin) = 6 THEN public.staff_pin_hash(NEW.id, left(v_pin, 4), true) END,
      length(v_pin),
      now()
    )
    ON CONFLICT (business_id) DO UPDATE
      SET pin_hash = EXCLUDED.pin_hash, prefix_hash = EXCLUDED.prefix_hash,
          pin_length = EXCLUDED.pin_length, updated_at = EXCLUDED.updated_at;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.businesses_sync_kiosk_manager_pin_hash() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS businesses_sync_kiosk_manager_pin_hash ON public.businesses;
CREATE TRIGGER businesses_sync_kiosk_manager_pin_hash
  AFTER INSERT OR UPDATE OF kiosk_manager_pin ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_sync_kiosk_manager_pin_hash();

-- Hash every existing manager PIN (and fix any hash that drifted, e.g. after a restore with triggers off). Returns the
-- number of rows written or removed. Service role only; safe to re-run.
CREATE OR REPLACE FUNCTION public.kiosk_manager_pin_hashes_backfill()
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
  v_prefix text;
BEGIN
  DELETE FROM public.kiosk_manager_pin_hashes k
  USING public.businesses b
  WHERE b.id = k.business_id
    AND (b.kiosk_manager_pin IS NULL OR btrim(b.kiosk_manager_pin) = '');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  FOR r IN
    SELECT b.id, b.kiosk_manager_pin AS pin, k.pin_hash AS current_hash, k.prefix_hash AS current_prefix,
           k.pin_length AS current_length
    FROM public.businesses b
    LEFT JOIN public.kiosk_manager_pin_hashes k ON k.business_id = b.id
    WHERE b.kiosk_manager_pin IS NOT NULL AND btrim(b.kiosk_manager_pin) <> ''
  LOOP
    v_hash := public.staff_pin_hash(r.id, r.pin, true);
    v_prefix := CASE WHEN length(r.pin) = 6 THEN public.staff_pin_hash(r.id, left(r.pin, 4), true) END;
    IF r.current_hash IS DISTINCT FROM v_hash OR r.current_prefix IS DISTINCT FROM v_prefix
       OR r.current_length IS DISTINCT FROM length(r.pin) THEN
      INSERT INTO public.kiosk_manager_pin_hashes (business_id, pin_hash, prefix_hash, pin_length, updated_at)
      VALUES (r.id, v_hash, v_prefix, length(r.pin), now())
      ON CONFLICT (business_id) DO UPDATE
        SET pin_hash = EXCLUDED.pin_hash, prefix_hash = EXCLUDED.prefix_hash,
            pin_length = EXCLUDED.pin_length, updated_at = EXCLUDED.updated_at;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_manager_pin_hashes_backfill() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_manager_pin_hashes_backfill() TO service_role;

-- Migrate existing PINs in place.
SELECT public.kiosk_manager_pin_hashes_backfill();

-- ---------- internal helpers ----------

-- Same limits as clock_in_out / kiosk_staff_by_pin (shared table clock_pin_attempts): raises too_many_attempts after
-- 8 wrong PINs from one network or 40 for the business in 15 minutes. Returns the caller's IP (may be NULL) for
-- recording a failure.
CREATE OR REPLACE FUNCTION public.kiosk_pin_throttle(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_headers json;
  v_ip text;
  v_ip_failures int;
  v_business_failures int;
BEGIN
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
  RETURN v_ip;
END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_pin_throttle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_pin_throttle(uuid) TO service_role;

-- True when the caller's session comes from a password sign-in in the last p_max_age_seconds (the access token's amr
-- claim; Supabase Auth keeps the sign-in time across token refreshes, and a new signInWithPassword resets it).
CREATE OR REPLACE FUNCTION public.caller_recent_password_sign_in(p_max_age_seconds integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END
    ) e
    WHERE e ->> 'method' = 'password'
      AND (e ->> 'timestamp') ~ '^[0-9]+$'
      AND (e ->> 'timestamp')::bigint >= extract(epoch FROM now())::bigint - p_max_age_seconds
  );
$function$;

REVOKE ALL ON FUNCTION public.caller_recent_password_sign_in(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caller_recent_password_sign_in(integer) TO service_role;

-- ---------- RPCs for the remediation frontend (it no longer reads businesses.kiosk_manager_pin) ----------

-- Computed field businesses.kiosk_manager_pin_set (PostgREST exposes a function of the row as a selectable field): is
-- a 6-digit manager PIN set? A legacy shorter PIN counts as not set, as in every frontend. NULL for callers who are
-- not members of the business (the directory policy shows slugged businesses to everyone). Not part of select('*'),
-- so main's queries don't change.
CREATE OR REPLACE FUNCTION public.kiosk_manager_pin_set(b public.businesses)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN public.is_business_member(b.id) THEN EXISTS (
    SELECT 1 FROM public.kiosk_manager_pin_hashes k WHERE k.business_id = b.id AND k.pin_length = 6
  ) END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_manager_pin_set(public.businesses) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_manager_pin_set(public.businesses) TO authenticated, service_role;

-- The kiosk keypad (TimeKiosk). Returns {"result": "staff" | "manager" | "manager_prefix" | "invalid", "staff": {...}}
-- where staff has the kiosk confirmation columns (never a PIN or hash). Same decisions the browser made before:
--   4 digits: the active staff member with this PIN; else "manager_prefix" when they are the manager PIN's first 4.
--   5 digits: "manager_prefix" when the first 4 are (the 5th is checked with the 6th).
--   6 digits: "manager" when it is the manager PIN, with the staff member who has that PIN (if any).
-- Anything else is "invalid" and counts as a wrong PIN in clock_pin_attempts.
CREATE OR REPLACE FUNCTION public.kiosk_pin_entry(p_business_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip text;
  v_len int;
  v_mgr record;
  v_hash text;
  v_staff jsonb;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  v_ip := public.kiosk_pin_throttle(p_business_id);

  IF p_pin IS NOT NULL AND p_pin ~ '^[0-9]{4,6}$' THEN
    v_len := length(p_pin);
    SELECT k.pin_hash, k.prefix_hash INTO v_mgr
    FROM public.kiosk_manager_pin_hashes k
    WHERE k.business_id = p_business_id AND k.pin_length = 6;
    -- One bcrypt per call: the 4-digit hash serves the staff lookup and the prefix compare.
    v_hash := public.staff_pin_hash(p_business_id, CASE WHEN v_len = 5 THEN left(p_pin, 4) ELSE p_pin END, false);

    IF v_len IN (4, 6) AND v_hash IS NOT NULL THEN
      SELECT jsonb_build_object(
               'id', s.id, 'business_id', s.business_id, 'name', s.name, 'role', s.role,
               'access_role', s.access_role, 'status', s.status, 'photo_url', s.photo_url)
      INTO v_staff
      FROM public.staff s
      JOIN public.staff_pin_hashes h ON h.staff_id = s.id
      WHERE h.business_id = p_business_id
        AND h.pin_hash = v_hash
        AND s.business_id = p_business_id
        AND s.status = 'active'
      LIMIT 1;
    END IF;

    IF v_len = 4 AND v_staff IS NOT NULL THEN
      RETURN jsonb_build_object('result', 'staff', 'staff', v_staff);
    END IF;
    IF v_mgr.pin_hash IS NOT NULL AND v_hash IS NOT NULL THEN
      IF v_len IN (4, 5) AND v_hash = v_mgr.prefix_hash THEN
        RETURN jsonb_build_object('result', 'manager_prefix', 'staff', NULL);
      END IF;
      IF v_len = 6 AND v_hash = v_mgr.pin_hash THEN
        RETURN jsonb_build_object('result', 'manager', 'staff', v_staff);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.clock_pin_attempts (business_id, client_ip) VALUES (p_business_id, v_ip);
  RETURN jsonb_build_object('result', 'invalid', 'staff', NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.kiosk_pin_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_pin_entry(uuid, text) TO authenticated, service_role;

-- Set or change the manager PIN (KioskManagerPinSettings, KioskManagerPinResetDialog). Returns {"ok": true} or
-- {"ok": false, "error": "invalid_pin" | "pin_prefix_in_use" | "current_pin_required" | "current_pin_incorrect"}
-- (returned, not raised, so a wrong current PIN stays recorded). Raises 42501 for non-managers and
-- too_many_attempts when the wrong-PIN limit is reached.
CREATE OR REPLACE FUNCTION public.set_kiosk_manager_pin(p_business_id uuid, p_new_pin text, p_current_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ip text;
  v_current_hash text;
  v_prefix_hash text;
BEGIN
  IF NOT public.is_business_manager(p_business_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  -- One change at a time per business.
  PERFORM 1 FROM public.businesses b WHERE b.id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT k.pin_hash INTO v_current_hash
  FROM public.kiosk_manager_pin_hashes k
  WHERE k.business_id = p_business_id AND k.pin_length = 6;

  IF v_current_hash IS NOT NULL THEN
    IF p_current_pin IS NOT NULL AND p_current_pin <> '' THEN
      v_ip := public.kiosk_pin_throttle(p_business_id);
      IF public.staff_pin_hash(p_business_id, p_current_pin, false) IS DISTINCT FROM v_current_hash THEN
        INSERT INTO public.clock_pin_attempts (business_id, client_ip) VALUES (p_business_id, v_ip);
        RETURN jsonb_build_object('ok', false, 'error', 'current_pin_incorrect');
      END IF;
    ELSIF NOT public.caller_recent_password_sign_in(600) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'current_pin_required');
    END IF;
  END IF;

  v_prefix_hash := public.staff_pin_hash(p_business_id, left(p_new_pin, 4), true);
  IF EXISTS (
    SELECT 1 FROM public.staff_pin_hashes h WHERE h.business_id = p_business_id AND h.pin_hash = v_prefix_hash
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin_prefix_in_use');
  END IF;

  -- The plain column stays the source main reads; the trigger writes the hash.
  UPDATE public.businesses SET kiosk_manager_pin = p_new_pin WHERE id = p_business_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_kiosk_manager_pin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_kiosk_manager_pin(uuid, text, text) TO authenticated, service_role;

-- ---------- generate_staff_pin: also skip the manager PIN's first 4 digits server-side ----------
-- Body as in 20261010210000 plus the reserved-prefix hash (marked P2-04). CREATE OR REPLACE keeps its grants.

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
  v_reserved_hash text;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  -- P2-04: the kiosk manager PIN's first 4 digits (the kiosk could not tell that staff PIN from the manager PIN).
  SELECT k.prefix_hash INTO v_reserved_hash FROM public.kiosk_manager_pin_hashes k WHERE k.business_id = p_business_id;
  FOR i IN 1..200 LOOP
    v_candidate := lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::int) % 10000)::text, 4, '0');
    CONTINUE WHEN v_candidate IS NOT DISTINCT FROM p_reserved;
    v_hash := public.staff_pin_hash(p_business_id, v_candidate, true);
    CONTINUE WHEN v_hash IS NOT DISTINCT FROM v_reserved_hash;
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
