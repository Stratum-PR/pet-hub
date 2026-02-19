-- ============================================
-- Time Rounding Function
-- ============================================
-- Rounds timestamp to nearest interval (default 15 minutes)

CREATE OR REPLACE FUNCTION public.round_time_to_interval(
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_interval_minutes INTEGER DEFAULT 15
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_interval_seconds INTEGER;
  v_timestamp_seconds BIGINT;
  v_rounded_seconds BIGINT;
  v_result TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Convert interval to seconds
  v_interval_seconds := p_interval_minutes * 60;
  
  -- Get timestamp as seconds since epoch
  v_timestamp_seconds := EXTRACT(EPOCH FROM p_timestamp)::BIGINT;
  
  -- Round to nearest interval
  v_rounded_seconds := (ROUND(v_timestamp_seconds::NUMERIC / v_interval_seconds) * v_interval_seconds)::BIGINT;
  
  -- Convert back to timestamp
  v_result := to_timestamp(v_rounded_seconds);
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.round_time_to_interval IS 'Rounds a timestamp to the nearest interval (default 15 minutes)';

