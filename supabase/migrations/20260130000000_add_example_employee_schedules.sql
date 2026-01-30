-- Add example work schedules for employees to demonstrate payroll functionality
-- This creates time entries for the past 2 weeks to show example payroll data

-- First, get existing employees and create time entries
DO $$
DECLARE
  emp_record RECORD;
  emp_id UUID;
  entry_date DATE;
  clock_in_time TIMESTAMP WITH TIME ZONE;
  clock_out_time TIMESTAMP WITH TIME ZONE;
  days_ago INTEGER;
BEGIN
  -- Loop through all active employees
  FOR emp_record IN 
    SELECT id FROM public.employees WHERE status = 'active' LIMIT 5
  LOOP
    emp_id := emp_record.id;
    
    -- Create time entries for the past 14 days (2 weeks)
    FOR days_ago IN 0..13 LOOP
      entry_date := CURRENT_DATE - days_ago;
      
      -- Skip weekends (Saturday = 6, Sunday = 0)
      IF EXTRACT(DOW FROM entry_date) NOT IN (0, 6) THEN
        -- Create a work day entry
        -- Random start time between 8:00 AM and 9:00 AM
        clock_in_time := entry_date + (8 + RANDOM() * 1) * INTERVAL '1 hour' + 
                         (RANDOM() * 60) * INTERVAL '1 minute';
        
        -- Work 6-8 hours (random)
        clock_out_time := clock_in_time + (6 + RANDOM() * 2) * INTERVAL '1 hour' + 
                          (RANDOM() * 60) * INTERVAL '1 minute';
        
        -- Only create if clock_out is before 6 PM
        IF clock_out_time::TIME < '18:00:00'::TIME THEN
          -- Check if entry already exists for this employee and date
          IF NOT EXISTS (
            SELECT 1 FROM public.time_entries 
            WHERE employee_id = emp_id::text
            AND clock_in::DATE = entry_date
          ) THEN
            INSERT INTO public.time_entries (id, employee_id, clock_in, clock_out, notes)
            VALUES (
              gen_random_uuid()::text,
              emp_id::text,
              clock_in_time,
              clock_out_time,
              CASE 
                WHEN RANDOM() > 0.7 THEN 'Full day shift'
                WHEN RANDOM() > 0.4 THEN 'Morning shift'
                ELSE ''
              END
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Add some additional example entries with different patterns
-- Some employees working partial days
DO $$
DECLARE
  emp_record RECORD;
  emp_id UUID;
  work_date DATE;
  clock_in_ts TIMESTAMP WITH TIME ZONE;
  clock_out_ts TIMESTAMP WITH TIME ZONE;
  i INTEGER;
BEGIN
  FOR emp_record IN 
    SELECT id FROM public.employees WHERE status = 'active' LIMIT 3
  LOOP
    emp_id := emp_record.id;
    FOR i IN 1..3 LOOP
      work_date := CURRENT_DATE - (RANDOM() * 7)::INTEGER;
      
      -- Skip if entry already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.time_entries 
        WHERE employee_id = emp_id::text
        AND clock_in::DATE = work_date
      ) THEN
        clock_in_ts := work_date + (8 + RANDOM() * 2) * INTERVAL '1 hour';
        clock_out_ts := work_date + (12 + RANDOM() * 2) * INTERVAL '1 hour';
        
        INSERT INTO public.time_entries (id, employee_id, clock_in, clock_out, notes)
        VALUES (gen_random_uuid()::text, emp_id::text, clock_in_ts, clock_out_ts, 'Half day shift');
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Add some overtime examples (more than 8 hours)
DO $$
DECLARE
  emp_record RECORD;
  emp_id UUID;
  work_date DATE;
  clock_in_ts TIMESTAMP WITH TIME ZONE;
  clock_out_ts TIMESTAMP WITH TIME ZONE;
  i INTEGER;
BEGIN
  FOR emp_record IN 
    SELECT id FROM public.employees WHERE status = 'active' LIMIT 2
  LOOP
    emp_id := emp_record.id;
    FOR i IN 1..2 LOOP
      work_date := CURRENT_DATE - (RANDOM() * 14)::INTEGER;
      
      -- Skip if entry already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.time_entries 
        WHERE employee_id = emp_id::text
        AND clock_in::DATE = work_date
      ) THEN
        clock_in_ts := work_date + 7 * INTERVAL '1 hour';
        clock_out_ts := work_date + (16 + RANDOM() * 2) * INTERVAL '1 hour';
        
        INSERT INTO public.time_entries (id, employee_id, clock_in, clock_out, notes)
        VALUES (gen_random_uuid()::text, emp_id::text, clock_in_ts, clock_out_ts, 'Overtime shift');
      END IF;
    END LOOP;
  END LOOP;
END $$;
