-- Feature rollout tiers: production | staged | development (hierarchical visibility).
-- Geofencing gated as development-only until promoted in feature_rollout.

CREATE TABLE IF NOT EXISTS public.feature_rollout (
  feature_key text PRIMARY KEY,
  min_tier text NOT NULL CHECK (min_tier IN ('production', 'staged', 'development')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_rollout IS 'Minimum rollout channel per feature; viewers at production see production-only, staged sees production+staged, development sees all.';

ALTER TABLE public.feature_rollout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_rollout_select_authenticated"
  ON public.feature_rollout FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.feature_rollout (feature_key, min_tier)
VALUES ('geofencing', 'development')
ON CONFLICT (feature_key) DO UPDATE
SET min_tier = excluded.min_tier, updated_at = now();

-- Visible if viewer_tier is high enough to include feature's min_tier.
CREATE OR REPLACE FUNCTION public.feature_is_visible(p_feature_key text, p_viewer_tier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p_viewer_tier, 'production')))
    WHEN 'production' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'production') = 'production'
    WHEN 'staged' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'production') IN ('production', 'staged')
    WHEN 'development' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'production') IN ('production', 'staged', 'development')
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.feature_is_visible IS 'Returns whether p_feature_key is visible for hierarchical viewer tier (production < staged < development).';

CREATE OR REPLACE FUNCTION public.resolve_support_feature_viewer_tier(p_support_feature_tier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'production';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    RETURN 'production';
  END IF;

  v_normalized := lower(trim(coalesce(p_support_feature_tier, '')));
  IF v_normalized IN ('production', 'staged', 'development') THEN
    RETURN v_normalized;
  END IF;

  RETURN 'production';
END;
$$;

-- check_geofence: optional tier for super-admins; when geofencing not visible, behave as no geofence.
-- Single signature with optional 4th arg; drop any old overloads so name is unique.
DROP FUNCTION IF EXISTS public.check_geofence(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.check_geofence(uuid, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.check_geofence(
  p_business_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_support_feature_tier text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_business RECORD;
  v_distance DECIMAL;
  v_result JSONB;
  v_viewer text;
BEGIN
  v_viewer := public.resolve_support_feature_viewer_tier(p_support_feature_tier);

  IF NOT public.feature_is_visible('geofencing', v_viewer) THEN
    RETURN jsonb_build_object(
      'within_fence', true,
      'distance_meters', NULL,
      'radius_meters', NULL,
      'error', NULL
    );
  END IF;

  SELECT
    geofencing_enabled,
    geofencing_latitude,
    geofencing_longitude,
    geofencing_radius_meters,
    geofencing_location_name
  INTO v_business
  FROM public.businesses
  WHERE id = p_business_id;

  IF NOT v_business.geofencing_enabled THEN
    RETURN jsonb_build_object(
      'within_fence', true,
      'distance_meters', NULL,
      'radius_meters', NULL,
      'error', NULL
    );
  END IF;

  IF v_business.geofencing_latitude IS NULL OR v_business.geofencing_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'within_fence', false,
      'distance_meters', NULL,
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'geofence_location_not_set'
    );
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'within_fence', false,
      'distance_meters', NULL,
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'employee_location_required'
    );
  END IF;

  v_distance := public.calculate_distance_meters(
    v_business.geofencing_latitude,
    v_business.geofencing_longitude,
    p_latitude,
    p_longitude
  );

  IF v_distance <= v_business.geofencing_radius_meters THEN
    v_result := jsonb_build_object(
      'within_fence', true,
      'distance_meters', ROUND(v_distance, 2),
      'radius_meters', v_business.geofencing_radius_meters,
      'error', NULL
    );
  ELSE
    v_result := jsonb_build_object(
      'within_fence', false,
      'distance_meters', ROUND(v_distance, 2),
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'outside_geofence'
    );
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_geofence(uuid, numeric, numeric, text) IS 'Checks geofence; honors feature_rollout for geofencing when caller is super admin with support tier.';

CREATE OR REPLACE FUNCTION public.clock_in_out(
  p_employee_pin text,
  p_business_id uuid,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_location_name text DEFAULT NULL,
  p_support_feature_tier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND status = 'active'
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
    v_geofence_check := public.check_geofence(p_business_id, p_latitude, p_longitude, p_support_feature_tier);
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
$$;
