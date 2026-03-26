-- Geofencing now uses the generic feature activation helper.
-- This keeps clock-in fail-open whenever the feature is inactive for the resolved viewer tier.

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

  IF NOT public.feature_is_active('geofencing', v_viewer) THEN
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
