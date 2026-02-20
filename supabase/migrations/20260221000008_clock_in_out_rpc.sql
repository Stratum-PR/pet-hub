-- ============================================
-- Clock In/Out Function
-- ============================================
-- Main kiosk function: validates PIN, checks schedule, creates/updates time entry

CREATE OR REPLACE FUNCTION public.clock_in_out(
  p_employee_pin TEXT,
  p_business_id UUID,
  p_latitude DECIMAL DEFAULT NULL,
  p_longitude DECIMAL DEFAULT NULL,
  p_location_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee RECORD;
  v_active_entry RECORD;
  v_clock_time TIMESTAMP WITH TIME ZONE;
  v_rounded_clock_time TIMESTAMP WITH TIME ZONE;
  v_schedule_check JSONB;
  v_geofence_check JSONB;
  v_time_entry_id TEXT;
  v_action TEXT;
  v_result JSONB;
BEGIN
  -- Get current timestamp
  v_clock_time := NOW();
  v_rounded_clock_time := public.round_time_to_interval(v_clock_time, 15);
  
  -- Find employee by PIN and business_id
  SELECT id, name, status, pin_required, pin_set_at, pin
  INTO v_employee
  FROM public.employees
  WHERE pin = p_employee_pin
    AND business_id = p_business_id
    AND status = 'active';
  
  -- Validate employee
  IF v_employee.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_pin',
      'message', 'Invalid PIN or employee not found'
    );
  END IF;
  
  -- Check if PIN is required and exists (PIN can be set by manager or employee)
  -- If pin_required is true, PIN must exist (not null/empty)
  -- pin_set_at tracks when PIN was set (by manager or employee), but is not required for clock in
  IF v_employee.pin_required = true AND (v_employee.pin IS NULL OR v_employee.pin = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'pin_not_set',
      'message', 'Employee must have a PIN set before clocking in. Please contact your manager.'
    );
  END IF;
  
  -- Check for active time entry (clocked in but not out)
  -- Cast both sides to TEXT to handle potential type mismatch (employee_id may be TEXT in some databases)
  SELECT id, clock_in, rounded_clock_in
  INTO v_active_entry
  FROM public.time_entries
  WHERE employee_id::TEXT = v_employee.id::TEXT
    AND clock_out IS NULL
    AND status = 'active'
  ORDER BY clock_in DESC
  LIMIT 1;
  
  -- Determine action: clock in or clock out
  IF v_active_entry.id IS NOT NULL THEN
    -- Clock out
    v_action := 'clock_out';
    v_time_entry_id := v_active_entry.id;
    
    -- Update existing time entry
    UPDATE public.time_entries
    SET 
      clock_out = v_clock_time,
      rounded_clock_out = v_rounded_clock_time,
      location_longitude = COALESCE(p_longitude, location_longitude),
      location_latitude = COALESCE(p_latitude, location_latitude),
      location_name = COALESCE(p_location_name, location_name)
    WHERE id = v_time_entry_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'clock_out',
      'time_entry_id', v_time_entry_id,
      'clock_out', v_clock_time,
      'rounded_clock_out', v_rounded_clock_time,
      'warning', NULL
    );
  ELSE
    -- Clock in
    v_action := 'clock_in';
    
    -- Check geofencing if enabled
    v_geofence_check := public.check_geofence(p_business_id, p_latitude, p_longitude);
    
    -- If geofencing is enabled and employee is outside fence, return error
    IF (v_geofence_check->>'within_fence')::BOOLEAN = false THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', v_geofence_check->>'error',
        'message', CASE 
          WHEN v_geofence_check->>'error' = 'outside_geofence' THEN 
            'You must be at the store location to clock in. You are ' || 
            ROUND((v_geofence_check->>'distance_meters')::DECIMAL / 1000, 2) || 
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
    
    -- Check schedule
    -- check_employee_schedule expects UUID
    v_schedule_check := public.check_employee_schedule(v_employee.id, v_clock_time);
    
    -- Create new time entry
    -- time_entries.id is TEXT, employee_id may be TEXT or UUID depending on database
    -- Cast employee_id to TEXT to ensure compatibility
    INSERT INTO public.time_entries (
      id,
      employee_id,
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
      gen_random_uuid()::TEXT,
      v_employee.id::TEXT,
      p_business_id,
      v_clock_time,
      v_rounded_clock_time,
      p_latitude,
      p_longitude,
      p_location_name,
      NOT (v_schedule_check->>'is_scheduled')::BOOLEAN,
      'active'
    )
    RETURNING id INTO v_time_entry_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'clock_in',
      'time_entry_id', v_time_entry_id,
      'clock_in', v_clock_time,
      'rounded_clock_in', v_rounded_clock_time,
      'warning', v_schedule_check->>'warning',
      'is_off_schedule', NOT (v_schedule_check->>'is_scheduled')::BOOLEAN,
      'schedule_info', v_schedule_check
    );
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.clock_in_out IS 'Main kiosk function: validates PIN, checks schedule, creates/updates time entry with geolocation. Returns action, time_entry_id, and warnings.';

