-- Rollback for 20261010210000_staff_pin_hashes.sql (P2-02).
-- Restores clock_in_out_unthrottled exactly as in production (copied verbatim from
-- test-env/supabase/prod-schema-snapshot.sql: plain-text PIN compare), then removes the hash trigger, the new RPCs,
-- the internal helpers and the staff_pin_hashes / staff_pin_salts tables (the hashes are derived data: staff.pin was
-- never changed, so nothing is lost). The wrapper clock_in_out and staff.pin are untouched. Idempotent.
--
-- The remediation frontend keeps working after this: its PIN calls (kiosk_staff_by_pin, generate_staff_pin,
-- staff_pin_available) fall back to the pre-P2-02 queries when the functions are missing.

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
BEGIN
  v_clock_time := now();
  v_rounded_clock_time := public.round_time_to_interval(v_clock_time, 15);

  SELECT id, name, status, pin_required, pin_set_at, pin, access_role
  INTO v_staff
  FROM public.staff
  WHERE pin = p_employee_pin
    AND business_id = p_business_id
    AND status = 'active';

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
-- (CREATE OR REPLACE keeps the function's privileges unchanged.)

DROP TRIGGER IF EXISTS staff_sync_pin_hash ON public.staff;
DROP FUNCTION IF EXISTS public.staff_sync_pin_hash();
DROP FUNCTION IF EXISTS public.kiosk_staff_by_pin(uuid, text);
DROP FUNCTION IF EXISTS public.staff_pin_available(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.generate_staff_pin(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.staff_pin_hashes_backfill();
DROP FUNCTION IF EXISTS public.staff_pin_hash(uuid, text, boolean);
DROP TABLE IF EXISTS public.staff_pin_hashes;
DROP TABLE IF EXISTS public.staff_pin_salts;
