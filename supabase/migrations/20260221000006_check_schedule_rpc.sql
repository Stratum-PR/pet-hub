-- ============================================
-- Schedule Check Function
-- ============================================
-- Checks if employee has a scheduled shift at the given time

CREATE OR REPLACE FUNCTION public.check_employee_schedule(
  p_employee_id UUID,
  p_clock_time TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_shift RECORD;
  v_result JSONB;
BEGIN
  -- Find any shift that overlaps with the clock time
  -- Allow 30 minutes before/after scheduled time for flexibility
  SELECT es.id, es.start_time, es.end_time
  INTO v_shift
  FROM public.employee_shifts es
  WHERE es.employee_id = p_employee_id
    AND es.start_time <= (p_clock_time + INTERVAL '30 minutes')
    AND es.end_time >= (p_clock_time - INTERVAL '30 minutes')
  ORDER BY ABS(EXTRACT(EPOCH FROM (es.start_time - p_clock_time)))
  LIMIT 1;
  
  IF v_shift.id IS NOT NULL THEN
    -- Employee is on schedule
    v_result := jsonb_build_object(
      'is_scheduled', true,
      'shift_id', v_shift.id,
      'shift_start', v_shift.start_time,
      'shift_end', v_shift.end_time,
      'warning', NULL
    );
  ELSE
    -- Employee is off schedule - find nearest shift
    SELECT es.id, es.start_time, es.end_time
    INTO v_shift
    FROM public.employee_shifts es
    WHERE es.employee_id = p_employee_id
      AND es.start_time >= (p_clock_time::DATE)
      AND es.start_time < (p_clock_time::DATE + INTERVAL '1 day')
    ORDER BY ABS(EXTRACT(EPOCH FROM (es.start_time - p_clock_time)))
    LIMIT 1;
    
    v_result := jsonb_build_object(
      'is_scheduled', false,
      'shift_id', COALESCE(v_shift.id::TEXT, NULL),
      'shift_start', COALESCE(v_shift.start_time, NULL),
      'shift_end', COALESCE(v_shift.end_time, NULL),
      'warning', 'off_schedule'
    );
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.check_employee_schedule IS 'Checks if employee has a scheduled shift at the given time, returns schedule info and warning if off-schedule';

