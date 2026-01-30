-- ============================================
-- DEMO DATA ENRICHMENT SCRIPT
-- ============================================
-- This script enriches demo pets with:
-- - Past appointments (various dates and statuses)
-- - Vaccination records
-- - Visit summaries
-- 
-- Business ID: 00000000-0000-0000-0000-000000000001

BEGIN;

-- ============================================
-- 1. UPDATE PETS WITH VACCINATION DATA
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  pet_record RECORD;
  random_age INTEGER;
BEGIN
  -- Update all demo pets with vaccination data
  FOR pet_record IN 
    SELECT id, name, birth_year, birth_month FROM public.pets 
    WHERE business_id::text = business_uuid::text
  LOOP
    -- Generate random age between 1-10 years if birth_year is not set
    random_age := FLOOR(RANDOM() * 10)::INTEGER + 1;
    
    -- Set birth year and month if not already set
    UPDATE public.pets
    SET 
      birth_year = COALESCE(
        pet_record.birth_year,
        EXTRACT(YEAR FROM CURRENT_DATE) - random_age
      ),
      birth_month = COALESCE(
        pet_record.birth_month,
        FLOOR(RANDOM() * 12)::INTEGER + 1
      ),
      last_vaccination_date = CASE
        WHEN last_vaccination_date IS NULL THEN 
          CURRENT_DATE - (FLOOR(RANDOM() * 365)::INTEGER || ' days')::INTERVAL
        ELSE last_vaccination_date
      END,
      vaccination_status = CASE 
        WHEN last_vaccination_date IS NULL THEN
          CASE 
            WHEN RANDOM() > 0.3 THEN 'up_to_date'
            WHEN RANDOM() > 0.6 THEN 'out_of_date'
            ELSE 'unknown'
          END
        ELSE
          CASE
            WHEN last_vaccination_date >= CURRENT_DATE - INTERVAL '12 months' THEN 'up_to_date'
            ELSE 'out_of_date'
          END
      END
    WHERE id = pet_record.id;
  END LOOP;
END $$;

-- ============================================
-- 2. CREATE PAST APPOINTMENTS FOR ALL PETS
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  pet_record RECORD;
  service_record RECORD;
  appointment_date DATE;
  appointment_status TEXT;
  service_id_val UUID;
  i INTEGER;
  statuses TEXT[] := ARRAY['completed', 'completed', 'completed', 'scheduled', 'canceled'];
  time_slots TEXT[] := ARRAY['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
BEGIN
  -- Get a service ID for appointments
  SELECT id INTO service_id_val 
  FROM public.services 
  WHERE business_id::text = business_uuid::text 
  LIMIT 1;

  -- For each pet, create 3-8 past appointments (more data for demo)
  FOR pet_record IN 
    SELECT id, name, customer_id FROM public.pets 
    WHERE business_id::text = business_uuid::text
  LOOP
    -- Create 3-8 appointments per pet for richer demo data
    FOR i IN 1..(FLOOR(RANDOM() * 6)::INTEGER + 3) LOOP
      -- Random date in the past 6 months
      appointment_date := CURRENT_DATE - (FLOOR(RANDOM() * 180)::INTEGER || ' days')::INTERVAL;
      
      -- Random status (mostly completed)
      appointment_status := statuses[FLOOR(RANDOM() * array_length(statuses, 1))::INTEGER + 1];
      
      -- Random time slot
      INSERT INTO public.appointments (
        id,
        business_id,
        pet_id,
        customer_id,
        service_id,
        appointment_date,
        start_time,
        status,
        price,
        notes
      ) VALUES (
        gen_random_uuid(),
        business_uuid,
        pet_record.id,
        pet_record.customer_id, -- Derive customer_id from pet
        service_id_val,
        appointment_date,
        (time_slots[FLOOR(RANDOM() * array_length(time_slots, 1))::INTEGER + 1])::TIME,
        appointment_status,
        (FLOOR(RANDOM() * 50)::NUMERIC + 20),
        CASE 
          WHEN appointment_status = 'completed' THEN 
            'Servicio completado exitosamente. ' || 
            CASE WHEN RANDOM() > 0.5 THEN 'Mascota muy tranquila.' ELSE 'Requiere atención especial.' END
          WHEN appointment_status = 'canceled' THEN 'Cita cancelada por el cliente.'
          ELSE 'Cita programada.'
        END
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 3. CREATE RECENT APPOINTMENTS (LAST 30 DAYS)
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  pet_record RECORD;
  service_record RECORD;
  appointment_date DATE;
  service_id_val UUID;
  i INTEGER;
  time_slots TEXT[] := ARRAY['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
BEGIN
  -- Get a service ID
  SELECT id INTO service_id_val 
  FROM public.services 
  WHERE business_id::text = business_uuid::text 
  LIMIT 1;

  -- For each pet, create 1-3 recent appointments (ensure all pets have some history)
  FOR pet_record IN 
    SELECT id, name, customer_id FROM public.pets 
    WHERE business_id::text = business_uuid::text
  LOOP
    -- Create 1-3 recent appointments per pet
    FOR i IN 1..(FLOOR(RANDOM() * 3)::INTEGER + 1) LOOP
      -- Random date in the last 30 days
      appointment_date := CURRENT_DATE - (FLOOR(RANDOM() * 30)::INTEGER || ' days')::INTERVAL;
      
      INSERT INTO public.appointments (
        id,
        business_id,
        pet_id,
        customer_id,
        service_id,
        appointment_date,
        start_time,
        status,
        price,
        notes
      ) VALUES (
        gen_random_uuid(),
        business_uuid,
        pet_record.id,
        pet_record.customer_id, -- Derive customer_id from pet
        service_id_val,
        appointment_date,
        (time_slots[FLOOR(RANDOM() * array_length(time_slots, 1))::INTEGER + 1])::TIME,
        CASE 
          WHEN appointment_date < CURRENT_DATE - INTERVAL '7 days' THEN 'completed'
          WHEN appointment_date < CURRENT_DATE THEN 'completed'
          ELSE 'scheduled'
        END,
        (FLOOR(RANDOM() * 50)::NUMERIC + 20),
        'Visita reciente. ' || 
        CASE WHEN RANDOM() > 0.5 THEN 'Todo salió bien.' ELSE 'Seguimiento recomendado.' END
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 4. UPDATE VACCINATION STATUS BASED ON DATES
-- ============================================
UPDATE public.pets
SET vaccination_status = CASE
  WHEN last_vaccination_date IS NULL THEN 'unknown'
  WHEN last_vaccination_date >= CURRENT_DATE - INTERVAL '12 months' THEN 'up_to_date'
  ELSE 'out_of_date'
END
WHERE business_id = '00000000-0000-0000-0000-000000000001'
  AND last_vaccination_date IS NOT NULL;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the enrichment:
-- 
-- SELECT p.name, p.birth_year, p.birth_month, p.last_vaccination_date, p.vaccination_status,
--        COUNT(a.id) as appointment_count
-- FROM public.pets p
-- LEFT JOIN public.appointments a ON a.pet_id = p.id
-- WHERE p.business_id = '00000000-0000-0000-0000-000000000001'
-- GROUP BY p.id, p.name, p.birth_year, p.birth_month, p.last_vaccination_date, p.vaccination_status
-- ORDER BY p.name;
--
-- SELECT COUNT(*) as total_appointments
-- FROM public.appointments
-- WHERE business_id = '00000000-0000-0000-0000-000000000001';
