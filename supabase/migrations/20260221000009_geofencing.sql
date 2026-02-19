-- ============================================
-- Geofencing for Time Clock
-- ============================================
-- Adds geofencing settings to businesses table and validation function

-- Add geofencing columns to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS geofencing_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS geofencing_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS geofencing_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS geofencing_radius_meters INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS geofencing_location_name TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_businesses_geofencing_enabled 
  ON public.businesses(geofencing_enabled);

-- Add comments
COMMENT ON COLUMN public.businesses.geofencing_enabled IS 'Whether geofencing is enabled for clock in/out';
COMMENT ON COLUMN public.businesses.geofencing_latitude IS 'Latitude of the geofence center (store location)';
COMMENT ON COLUMN public.businesses.geofencing_longitude IS 'Longitude of the geofence center (store location)';
COMMENT ON COLUMN public.businesses.geofencing_radius_meters IS 'Radius in meters around the center location for valid clock ins';
COMMENT ON COLUMN public.businesses.geofencing_location_name IS 'Human-readable name for the geofence location';

-- Function to calculate distance between two coordinates (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance_meters(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius DECIMAL := 6371000; -- Earth radius in meters
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  -- Convert degrees to radians
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  -- Haversine formula
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2) * sin(dlon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN earth_radius * c;
END;
$$;

COMMENT ON FUNCTION public.calculate_distance_meters IS 'Calculates distance between two coordinates in meters using Haversine formula';

-- Function to check if location is within geofence
CREATE OR REPLACE FUNCTION public.check_geofence(
  p_business_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_business RECORD;
  v_distance DECIMAL;
  v_result JSONB;
BEGIN
  -- Get business geofencing settings
  SELECT 
    geofencing_enabled,
    geofencing_latitude,
    geofencing_longitude,
    geofencing_radius_meters,
    geofencing_location_name
  INTO v_business
  FROM public.businesses
  WHERE id = p_business_id;
  
  -- If geofencing is not enabled, allow clock in
  IF NOT v_business.geofencing_enabled THEN
    RETURN jsonb_build_object(
      'within_fence', true,
      'distance_meters', NULL,
      'radius_meters', NULL,
      'error', NULL
    );
  END IF;
  
  -- If geofencing is enabled but location not set, return error
  IF v_business.geofencing_latitude IS NULL OR v_business.geofencing_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'within_fence', false,
      'distance_meters', NULL,
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'geofence_location_not_set'
    );
  END IF;
  
  -- If employee location not provided, return error
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'within_fence', false,
      'distance_meters', NULL,
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'employee_location_required'
    );
  END IF;
  
  -- Calculate distance
  v_distance := public.calculate_distance_meters(
    v_business.geofencing_latitude,
    v_business.geofencing_longitude,
    p_latitude,
    p_longitude
  );
  
  -- Check if within radius
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

COMMENT ON FUNCTION public.check_geofence IS 'Checks if a location is within the business geofence. Returns distance and validation result.';

