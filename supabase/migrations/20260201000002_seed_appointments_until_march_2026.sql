-- Seed appointments for all employees until March 2026
-- This creates a very full calendar with past, present, and future appointments

DO $$
DECLARE
  v_business_id UUID;
  v_employee_ids UUID[] := ARRAY[]::UUID[];
  v_pet_ids UUID[] := ARRAY[]::UUID[];
  v_service_ids UUID[] := ARRAY[]::UUID[];
  v_employee_id UUID;
  v_pet_id UUID;
  v_service_id UUID;
  v_appointment_date DATE;
  v_start_time TIME;
  v_end_time TIME;
  v_duration_minutes INTEGER;
  v_day_offset INTEGER;
  v_appointments_per_day INTEGER;
  v_hour INTEGER;
  v_minute INTEGER;
  v_status TEXT;
BEGIN
  -- Get business ID
  SELECT id INTO v_business_id FROM public.businesses LIMIT 1;
  
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found. Please create a business first.';
  END IF;

  -- Get all active employees
  SELECT ARRAY_AGG(id) INTO v_employee_ids 
  FROM public.employees 
  WHERE business_id = v_business_id AND status = 'active';
  
  IF ARRAY_LENGTH(v_employee_ids, 1) IS NULL OR ARRAY_LENGTH(v_employee_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No active employees found. Please create employees first.';
  END IF;

  -- Get all pets
  SELECT ARRAY_AGG(id) INTO v_pet_ids 
  FROM public.pets 
  WHERE business_id = v_business_id;
  
  IF ARRAY_LENGTH(v_pet_ids, 1) IS NULL OR ARRAY_LENGTH(v_pet_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No pets found. Please create pets first.';
  END IF;

  -- Get all active services, or create default ones if none exist
  SELECT ARRAY_AGG(id) INTO v_service_ids 
  FROM public.services 
  WHERE business_id = v_business_id AND is_active = true;
  
  IF ARRAY_LENGTH(v_service_ids, 1) IS NULL OR ARRAY_LENGTH(v_service_ids, 1) = 0 THEN
    -- Create default services
    INSERT INTO public.services (id, business_id, name, description, price, duration_minutes, is_active, created_at)
    VALUES
      (gen_random_uuid()::text, v_business_id, 'Full Grooming', 'Complete bath, haircut, nail trim', 75.00, 90, true, NOW()),
      (gen_random_uuid()::text, v_business_id, 'Bath & Brush', 'Bath with shampoo and brush out', 45.00, 45, true, NOW()),
      (gen_random_uuid()::text, v_business_id, 'Daycare - Full Day', 'Full day daycare service', 35.00, 480, true, NOW()),
      (gen_random_uuid()::text, v_business_id, 'Daycare - Half Day', 'Half day daycare service', 25.00, 240, true, NOW())
    ON CONFLICT DO NOTHING;
    
    -- Get the newly created services
    SELECT ARRAY_AGG(id) INTO v_service_ids 
    FROM public.services 
    WHERE business_id = v_business_id AND is_active = true;
  END IF;

  -- Generate appointments from 6 months ago until March 2026
  -- Start from 6 months ago
  FOR v_day_offset IN -180..550 LOOP
    v_appointment_date := CURRENT_DATE + (v_day_offset || ' days')::INTERVAL;
    
    -- Skip Sundays (day 0) - most businesses closed
    IF EXTRACT(DOW FROM v_appointment_date) = 0 THEN
      CONTINUE;
    END IF;
    
    -- More appointments on weekdays, fewer on Saturdays
    IF EXTRACT(DOW FROM v_appointment_date) = 6 THEN
      v_appointments_per_day := 2 + (RANDOM() * 3)::INTEGER; -- 2-5 on Saturday
    ELSE
      v_appointments_per_day := 4 + (RANDOM() * 6)::INTEGER; -- 4-10 on weekdays
    END IF;
    
    -- Create appointments for this day
    FOR apt_num IN 1..v_appointments_per_day LOOP
      -- Random employee
      v_employee_id := v_employee_ids[1 + (RANDOM() * (ARRAY_LENGTH(v_employee_ids, 1) - 1))::INTEGER];
      
      -- Random pet
      v_pet_id := v_pet_ids[1 + (RANDOM() * (ARRAY_LENGTH(v_pet_ids, 1) - 1))::INTEGER];
      
      -- Random service
      v_service_id := v_service_ids[1 + (RANDOM() * (ARRAY_LENGTH(v_service_ids, 1) - 1))::INTEGER];
      
      -- Get service duration
      SELECT duration_minutes INTO v_duration_minutes 
      FROM public.services 
      WHERE id::text = v_service_id::text;
      
      IF v_duration_minutes IS NULL THEN
        v_duration_minutes := 60; -- Default 60 minutes
      END IF;
      
      -- Random start time between 7 AM and 5 PM
      v_hour := 7 + (RANDOM() * 10)::INTEGER; -- 7-17 (7 AM to 5 PM)
      v_minute := (RANDOM() * 4)::INTEGER * 15; -- 0, 15, 30, or 45
      v_start_time := (v_hour || ':' || LPAD(v_minute::TEXT, 2, '0') || ':00')::TIME;
      
      -- Calculate end time properly
      DECLARE
        v_start_hour INTEGER;
        v_start_min INTEGER;
        v_end_hour INTEGER;
        v_end_min INTEGER;
      BEGIN
        v_start_hour := EXTRACT(HOUR FROM v_start_time)::INTEGER;
        v_start_min := EXTRACT(MINUTE FROM v_start_time)::INTEGER;
        
        v_end_min := v_start_min + v_duration_minutes;
        v_end_hour := v_start_hour + (v_end_min / 60);
        v_end_min := v_end_min % 60;
        
        -- Ensure hour doesn't exceed 23
        IF v_end_hour >= 24 THEN
          v_end_hour := 23;
          v_end_min := 59;
        END IF;
        
        v_end_time := (LPAD(v_end_hour::TEXT, 2, '0') || ':' || LPAD(v_end_min::TEXT, 2, '0') || ':00')::TIME;
      END;
      
      -- Determine status based on date
      IF v_appointment_date < CURRENT_DATE THEN
        -- Past appointments - mostly completed, some cancelled
        v_status := CASE (RANDOM() * 10)::INTEGER
          WHEN 0 THEN 'canceled'
          WHEN 1 THEN 'no_show'
          ELSE 'completed'
        END;
      ELSIF v_appointment_date = CURRENT_DATE THEN
        -- Today - mix of scheduled, confirmed, in_progress
        v_status := CASE (RANDOM() * 3)::INTEGER
          WHEN 0 THEN 'scheduled'
          WHEN 1 THEN 'confirmed'
          ELSE 'in_progress'
        END;
      ELSE
        -- Future appointments - mostly scheduled or confirmed
        v_status := CASE (RANDOM() * 10)::INTEGER
          WHEN 0 THEN 'scheduled'
          ELSE 'confirmed'
        END;
      END IF;
      
      -- Get service price
      DECLARE
        v_price NUMERIC;
      BEGIN
        SELECT price INTO v_price FROM public.services WHERE id::text = v_service_id::text;
        
        IF v_price IS NULL THEN
          v_price := 50.00; -- Default price
        END IF;
        
        -- Insert appointment (only if it doesn't conflict with existing appointments)
        INSERT INTO public.appointments (
          id, business_id, customer_id, pet_id, service_id, employee_id,
          appointment_date, start_time, end_time,
          status, total_price, created_at, updated_at
        )
        SELECT 
          gen_random_uuid()::text,
          v_business_id,
          (SELECT client_id FROM public.pets WHERE id = v_pet_id),
          v_pet_id::text,
          v_service_id::text,
          v_employee_id::text,
          v_appointment_date,
          v_start_time,
          v_end_time,
          v_status::text,
          v_price,
          NOW(),
          NOW()
        WHERE NOT EXISTS (
          -- Check for overlapping appointments for same employee
          SELECT 1 FROM public.appointments a
          WHERE a.employee_id = v_employee_id::text
          AND a.appointment_date = v_appointment_date
          AND a.status NOT IN ('canceled', 'no_show')
          AND (
            (a.start_time <= v_start_time AND a.end_time > v_start_time) OR
            (a.start_time < v_end_time AND a.end_time >= v_end_time) OR
            (a.start_time >= v_start_time AND a.end_time <= v_end_time)
          )
        )
        AND NOT EXISTS (
          -- Check for overlapping appointments for same pet
          SELECT 1 FROM public.appointments a
          WHERE a.pet_id = v_pet_id::text
          AND a.appointment_date = v_appointment_date
          AND a.status NOT IN ('canceled', 'no_show')
          AND (
            (a.start_time <= v_start_time AND a.end_time > v_start_time) OR
            (a.start_time < v_end_time AND a.end_time >= v_end_time) OR
            (a.start_time >= v_start_time AND a.end_time <= v_end_time)
          )
        );
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Successfully created appointments until March 2026';
END $$;
