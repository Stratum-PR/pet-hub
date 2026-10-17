-- Rollback for 20261010220000_kiosk_manager_pin_hashes.sql (P2-04).
-- Restores generate_staff_pin exactly as 20261010210000_staff_pin_hashes.sql created it (copied verbatim), then
-- removes the hash trigger on businesses, the new RPCs, the internal helpers and kiosk_manager_pin_hashes (the hashes
-- are derived data: businesses.kiosk_manager_pin was never changed, so nothing is lost). Idempotent.
--
-- Order: roll this back BEFORE 20261010210000's rollback (this migration's functions call staff_pin_hash).
-- Salts this migration created in staff_pin_salts (businesses with a manager PIN but no staff PINs) stay: that table
-- belongs to 20261010210000, a salt alone reveals nothing, and that migration's rollback drops the table.
--
-- The remediation frontend keeps working after this: its manager-PIN calls (kiosk_manager_pin_set,
-- kiosk_pin_entry, set_kiosk_manager_pin) fall back to the pre-P2-04 queries when the functions are missing.

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

DROP TRIGGER IF EXISTS businesses_sync_kiosk_manager_pin_hash ON public.businesses;
DROP FUNCTION IF EXISTS public.businesses_sync_kiosk_manager_pin_hash();
DROP FUNCTION IF EXISTS public.set_kiosk_manager_pin(uuid, text, text);
DROP FUNCTION IF EXISTS public.kiosk_pin_entry(uuid, text);
DROP FUNCTION IF EXISTS public.kiosk_manager_pin_set(public.businesses);
DROP FUNCTION IF EXISTS public.caller_recent_password_sign_in(integer);
DROP FUNCTION IF EXISTS public.kiosk_pin_throttle(uuid);
DROP FUNCTION IF EXISTS public.kiosk_manager_pin_hashes_backfill();
DROP TABLE IF EXISTS public.kiosk_manager_pin_hashes;
