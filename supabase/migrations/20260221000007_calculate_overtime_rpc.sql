-- ============================================
-- Overtime Calculation Function
-- ============================================
-- Calculates regular hours, overtime hours (after 40h/week), and total hours

CREATE OR REPLACE FUNCTION public.calculate_overtime_hours(
  p_employee_id UUID,
  p_week_start DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_week_end DATE;
  v_total_hours DECIMAL(10, 2);
  v_regular_hours DECIMAL(10, 2);
  v_overtime_hours DECIMAL(10, 2);
  v_result JSONB;
BEGIN
  -- Calculate week end (7 days from start)
  v_week_end := p_week_start + INTERVAL '7 days';
  
  -- Calculate total hours worked in the week
  -- Using rounded times if available, otherwise actual times
  SELECT COALESCE(
    SUM(
      EXTRACT(EPOCH FROM (
        COALESCE(te.rounded_clock_out, te.clock_out) - 
        COALESCE(te.rounded_clock_in, te.clock_in)
      )) / 3600.0
    ),
    0
  )
  INTO v_total_hours
  FROM public.time_entries te
  WHERE te.employee_id = p_employee_id
    AND te.clock_in >= p_week_start::TIMESTAMP WITH TIME ZONE
    AND te.clock_in < v_week_end::TIMESTAMP WITH TIME ZONE
    AND te.clock_out IS NOT NULL
    AND te.status = 'active';
  
  -- Calculate regular and overtime hours
  -- Overtime threshold: 40 hours per week
  IF v_total_hours > 40 THEN
    v_regular_hours := 40;
    v_overtime_hours := v_total_hours - 40;
  ELSE
    v_regular_hours := v_total_hours;
    v_overtime_hours := 0;
  END IF;
  
  v_result := jsonb_build_object(
    'total_hours', ROUND(v_total_hours, 2),
    'regular_hours', ROUND(v_regular_hours, 2),
    'overtime_hours', ROUND(v_overtime_hours, 2),
    'week_start', p_week_start,
    'week_end', v_week_end
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.calculate_overtime_hours IS 'Calculates regular hours, overtime hours (after 40h/week), and total hours for an employee in a given week';

