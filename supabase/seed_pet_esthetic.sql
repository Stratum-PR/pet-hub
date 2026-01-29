-- ============================================
-- SEED SCRIPT FOR PET ESTHETIC BUSINESS
-- ============================================
-- This script creates the "Pet Esthetic" business with placeholder data
-- Run this after the multi-tenant migration

-- ============================================
-- 1. CREATE PET ESTHETIC BUSINESS
-- ============================================
INSERT INTO public.businesses (
  id,
  name,
  email,
  phone,
  address,
  city,
  state,
  zip_code,
  website,
  subscription_tier,
  subscription_status,
  onboarding_completed,
  trial_ends_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Pet Esthetic',
  'g.rodriguez@stratumpr.com',
  '(787) 555-0100',
  '123 Calle Principal',
  'San Juan',
  'PR',
  '00901',
  'https://petesthetic.com',
  'pro',
  'active',
  true,
  NOW() + INTERVAL '30 days'
) ON CONFLICT (id) DO UPDATE
SET
  name = 'Pet Esthetic',
  email = 'g.rodriguez@stratumpr.com',
  phone = '(787) 555-0100',
  address = '123 Calle Principal',
  city = 'San Juan',
  state = 'PR',
  zip_code = '00901',
  website = 'https://petesthetic.com',
  subscription_tier = 'pro',
  subscription_status = 'active',
  onboarding_completed = true;

-- ============================================
-- 2. LINK USER TO BUSINESS
-- ============================================
-- Link g.rodriguez@stratumpr.com to Pet Esthetic business
DO $$
DECLARE
  user_id_val UUID;
BEGIN
  SELECT id INTO user_id_val
  FROM auth.users
  WHERE email = 'g.rodriguez@stratumpr.com';

  IF user_id_val IS NOT NULL THEN
    -- Update or insert profile
    INSERT INTO public.profiles (id, email, is_super_admin, business_id)
    VALUES (user_id_val, 'g.rodriguez@stratumpr.com', false, '00000000-0000-0000-0000-000000000002')
    ON CONFLICT (id) DO UPDATE
    SET 
      business_id = '00000000-0000-0000-0000-000000000002',
      email = 'g.rodriguez@stratumpr.com';
    
    RAISE NOTICE 'Profile linked to Pet Esthetic for g.rodriguez@stratumpr.com';
  ELSE
    RAISE NOTICE 'User g.rodriguez@stratumpr.com not found in auth.users. Please create the user first.';
  END IF;
END $$;

-- ============================================
-- 3. CREATE SERVICES FOR PET ESTHETIC
-- ============================================
-- Note: If services table has is_active column, add it to the INSERT
-- For now, using only the columns that exist in the base schema
INSERT INTO public.services (
  id,
  business_id,
  name,
  description,
  price,
  duration_minutes
) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Bath & Brush', 'Complete bath with premium shampoo and full brush out', 45.00, 45),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Full Service Groom', 'Complete grooming package: bath, haircut, nail trim, ear cleaning, and styling', 75.00, 120),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Nail Trim Only', 'Professional nail clipping and filing', 18.00, 15),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Teeth Cleaning', 'Professional dental cleaning and breath freshening', 25.00, 20),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'De-shedding Treatment', 'Specialized treatment to reduce shedding and remove loose fur', 55.00, 60),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Puppy First Groom', 'Gentle introduction to grooming for puppies under 6 months', 50.00, 60),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Spa Package', 'Premium package: bath, haircut, nail trim, ear cleaning, teeth cleaning, and aromatherapy', 95.00, 150)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. CREATE CUSTOMERS FOR PET ESTHETIC
-- ============================================
INSERT INTO public.customers (
  business_id,
  first_name,
  last_name,
  email,
  phone,
  address,
  city,
  state,
  zip_code,
  notes
) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Maria', 'Gonzalez', 'maria.gonzalez@email.com', '(787) 555-1001', '456 Avenida Central', 'San Juan', 'PR', '00902', 'Prefers morning appointments'),
  ('00000000-0000-0000-0000-000000000002', 'Carlos', 'Martinez', 'carlos.martinez@email.com', '(787) 555-1002', '789 Calle Luna', 'San Juan', 'PR', '00903', 'Regular customer, monthly visits'),
  ('00000000-0000-0000-0000-000000000002', 'Ana', 'Rivera', 'ana.rivera@email.com', '(787) 555-1003', '321 Calle Sol', 'San Juan', 'PR', '00904', 'Has two dogs'),
  ('00000000-0000-0000-0000-000000000002', 'Jose', 'Torres', 'jose.torres@email.com', '(787) 555-1004', '654 Calle Estrella', 'San Juan', 'PR', '00905', 'New customer'),
  ('00000000-0000-0000-0000-000000000002', 'Carmen', 'Lopez', 'carmen.lopez@email.com', '(787) 555-1005', '987 Calle Mar', 'San Juan', 'PR', '00906', 'VIP customer, prefers specific groomer'),
  ('00000000-0000-0000-0000-000000000002', 'Roberto', 'Sanchez', 'roberto.sanchez@email.com', '(787) 555-1006', '147 Calle Viento', 'San Juan', 'PR', '00907', NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. CREATE PETS FOR PET ESTHETIC
-- ============================================
-- First, ensure all required columns exist
DO $$
BEGIN
  -- Add business_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.pets ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;

  -- Add customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.pets ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;

  -- Add special_instructions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'special_instructions'
  ) THEN
    ALTER TABLE public.pets ADD COLUMN special_instructions TEXT;
  END IF;
END $$;

-- Now insert pets
DO $$
DECLARE
  maria_id UUID;
  carlos_id UUID;
  ana_id UUID;
  jose_id UUID;
  carmen_id UUID;
  roberto_id UUID;
  business_uuid UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Get customer IDs (cast business_id to handle TEXT or UUID)
  SELECT id INTO maria_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Maria' AND last_name = 'Gonzalez' LIMIT 1;
  SELECT id INTO carlos_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Carlos' AND last_name = 'Martinez' LIMIT 1;
  SELECT id INTO ana_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Ana' AND last_name = 'Rivera' LIMIT 1;
  SELECT id INTO jose_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Jose' AND last_name = 'Torres' LIMIT 1;
  SELECT id INTO carmen_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Carmen' AND last_name = 'Lopez' LIMIT 1;
  SELECT id INTO roberto_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Roberto' AND last_name = 'Sanchez' LIMIT 1;

  -- Insert pets (only if customer IDs were found)
  IF maria_id IS NOT NULL AND carlos_id IS NOT NULL AND ana_id IS NOT NULL AND 
     jose_id IS NOT NULL AND carmen_id IS NOT NULL AND roberto_id IS NOT NULL THEN
    INSERT INTO public.pets (
      id,
      business_id,
      customer_id,
      name,
      species,
      breed,
      age,
      weight,
      notes,
      special_instructions
    ) VALUES
      (gen_random_uuid(), business_uuid, maria_id, 'Luna', 'dog', 'Yorkshire Terrier', 4, 7.5, 'Very calm and well-behaved', 'Use gentle shampoo, sensitive skin'),
      (gen_random_uuid(), business_uuid, carlos_id, 'Max', 'dog', 'German Shepherd', 5, 85.0, 'Large dog, needs extra time', 'Requires experienced groomer'),
      (gen_random_uuid(), business_uuid, ana_id, 'Bella', 'dog', 'Shih Tzu', 3, 12.0, 'Loves attention', NULL),
      (gen_random_uuid(), business_uuid, ana_id, 'Rocky', 'dog', 'French Bulldog', 2, 25.0, 'Playful puppy', 'Handle with care, breathing issues'),
      (gen_random_uuid(), business_uuid, jose_id, 'Coco', 'dog', 'Poodle', 6, 18.0, 'Senior dog, needs gentle handling', 'Use senior-friendly products'),
      (gen_random_uuid(), business_uuid, carmen_id, 'Princess', 'dog', 'Maltese', 5, 8.0, 'VIP pet, prefers specific groomer', 'Request Maria as groomer'),
      (gen_random_uuid(), business_uuid, roberto_id, 'Tiger', 'cat', 'Persian', 4, 12.0, 'Indoor cat, first time grooming', 'Very nervous, needs patience')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Some customer IDs were not found. Skipping pet insertion.';
    RAISE NOTICE 'Maria: %, Carlos: %, Ana: %, Jose: %, Carmen: %, Roberto: %', 
      maria_id, carlos_id, ana_id, jose_id, carmen_id, roberto_id;
  END IF;
END $$;

-- ============================================
-- 6. CREATE APPOINTMENTS FOR PET ESTHETIC
-- ============================================
-- First, ensure all required columns exist
DO $$
BEGIN
  -- Add business_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;

  -- Add customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;

  -- Add service_id if it doesn't exist
  -- Check the type of services.id first to match it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'service_id'
  ) THEN
    -- Check if services.id is TEXT or UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'services' 
      AND column_name = 'id' 
      AND data_type = 'text'
    ) THEN
      -- services.id is TEXT, so make service_id TEXT too (no FK constraint due to type mismatch)
      ALTER TABLE public.appointments ADD COLUMN service_id TEXT;
    ELSE
      -- services.id is UUID, so make service_id UUID with FK constraint
      ALTER TABLE public.appointments ADD COLUMN service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT;
    END IF;
  END IF;

  -- Add appointment_date if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'appointment_date'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN appointment_date DATE;
  END IF;

  -- Add start_time if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'start_time'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN start_time TIME;
  END IF;

  -- Add end_time if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'end_time'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN end_time TIME;
  END IF;

  -- Add total_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'total_price'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN total_price NUMERIC;
  END IF;
END $$;

-- Now insert appointments
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000002';
  luna_pet_id UUID;
  max_pet_id UUID;
  bella_pet_id UUID;
  coco_pet_id UUID;
  princess_pet_id UUID;
  full_groom_service_id TEXT;
  bath_brush_service_id TEXT;
  spa_service_id TEXT;
  maria_customer_id UUID;
  carlos_customer_id UUID;
  ana_customer_id UUID;
  jose_customer_id UUID;
  carmen_customer_id UUID;
  today_date DATE := CURRENT_DATE;
  tomorrow_date DATE := CURRENT_DATE + INTERVAL '1 day';
  next_week_date DATE := CURRENT_DATE + INTERVAL '7 days';
BEGIN
  -- Get service IDs (cast to TEXT since services.id is TEXT)
  SELECT id::text INTO full_groom_service_id FROM public.services 
    WHERE business_id::text = business_uuid::text AND name = 'Full Service Groom' LIMIT 1;
  SELECT id::text INTO bath_brush_service_id FROM public.services 
    WHERE business_id::text = business_uuid::text AND name = 'Bath & Brush' LIMIT 1;
  SELECT id::text INTO spa_service_id FROM public.services 
    WHERE business_id::text = business_uuid::text AND name = 'Spa Package' LIMIT 1;

  -- Get customer IDs (cast business_id to handle TEXT or UUID)
  SELECT id INTO maria_customer_id FROM public.customers 
    WHERE business_id::text = business_uuid::text AND first_name = 'Maria' LIMIT 1;
  SELECT id INTO carlos_customer_id FROM public.customers 
    WHERE business_id::text = business_uuid::text AND first_name = 'Carlos' LIMIT 1;
  SELECT id INTO ana_customer_id FROM public.customers 
    WHERE business_id::text = business_uuid::text AND first_name = 'Ana' LIMIT 1;
  SELECT id INTO jose_customer_id FROM public.customers 
    WHERE business_id::text = business_uuid::text AND first_name = 'Jose' LIMIT 1;
  SELECT id INTO carmen_customer_id FROM public.customers 
    WHERE business_id::text = business_uuid::text AND first_name = 'Carmen' LIMIT 1;

  -- Get pet IDs (cast business_id to handle TEXT or UUID)
  SELECT id INTO luna_pet_id FROM public.pets 
    WHERE business_id::text = business_uuid::text AND name = 'Luna' LIMIT 1;
  SELECT id INTO max_pet_id FROM public.pets 
    WHERE business_id::text = business_uuid::text AND name = 'Max' LIMIT 1;
  SELECT id INTO bella_pet_id FROM public.pets 
    WHERE business_id::text = business_uuid::text AND name = 'Bella' LIMIT 1;
  SELECT id INTO coco_pet_id FROM public.pets 
    WHERE business_id::text = business_uuid::text AND name = 'Coco' LIMIT 1;
  SELECT id INTO princess_pet_id FROM public.pets 
    WHERE business_id::text = business_uuid::text AND name = 'Princess' LIMIT 1;

  -- Insert appointments (generate id for each)
  INSERT INTO public.appointments (
    id,
    business_id,
    customer_id,
    pet_id,
    service_id,
    appointment_date,
    start_time,
    end_time,
    status,
    total_price,
    notes
  ) VALUES
    -- Today's appointments
    (
      gen_random_uuid(),
      business_uuid,
      maria_customer_id,
      luna_pet_id,
      full_groom_service_id,
      today_date,
      '09:00:00',
      '11:00:00',
      'confirmed',
      75.00,
      'Regular monthly appointment'
    ),
    (
      gen_random_uuid(),
      business_uuid,
      carlos_customer_id,
      max_pet_id,
      bath_brush_service_id,
      today_date,
      '13:00:00',
      '13:45:00',
      'scheduled',
      45.00,
      'Large dog, allow extra time'
    ),
    -- Tomorrow's appointments
    (
      gen_random_uuid(),
      business_uuid,
      ana_customer_id,
      bella_pet_id,
      full_groom_service_id,
      tomorrow_date,
      '10:00:00',
      '12:00:00',
      'confirmed',
      75.00,
      'First appointment with this pet'
    ),
    (
      gen_random_uuid(),
      business_uuid,
      jose_customer_id,
      coco_pet_id,
      bath_brush_service_id,
      tomorrow_date,
      '14:00:00',
      '14:45:00',
      'scheduled',
      45.00,
      'Senior dog, gentle handling'
    ),
    -- Next week's appointments
    (
      gen_random_uuid(),
      business_uuid,
      carmen_customer_id,
      princess_pet_id,
      spa_service_id,
      next_week_date,
      '11:00:00',
      '13:30:00',
      'confirmed',
      95.00,
      'VIP customer, request Maria as groomer'
    );
END $$;

-- ============================================
-- 7. CREATE EMPLOYEES FOR PET ESTHETIC
-- ============================================
-- Note: This assumes the employees table exists and has been migrated
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Check if employees table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    -- Check if business_id column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'employees' 
      AND column_name = 'business_id'
    ) THEN
      -- Insert with business_id (new schema)
      INSERT INTO public.employees (
        id,
        business_id,
        name,
        email,
        phone,
        role,
        status,
        pin,
        hourly_rate
      ) VALUES
        (gen_random_uuid(), business_uuid, 'Maria Rodriguez', 'maria.r@petesthetic.com', '(787) 555-2001', 'groomer', 'active', '2001', 22.00),
        (gen_random_uuid(), business_uuid, 'Juan Perez', 'juan.p@petesthetic.com', '(787) 555-2002', 'groomer', 'active', '2002', 18.00),
        (gen_random_uuid(), business_uuid, 'Sofia Martinez', 'sofia.m@petesthetic.com', '(787) 555-2003', 'groomer', 'active', '2003', 16.00)
      ON CONFLICT DO NOTHING;
    ELSE
      -- Insert without business_id (old schema)
      INSERT INTO public.employees (
        id,
        name,
        email,
        phone,
        role,
        status,
        pin,
        hourly_rate
      ) VALUES
        (gen_random_uuid(), 'Maria Rodriguez', 'maria.r@petesthetic.com', '(787) 555-2001', 'groomer', 'active', '2001', 22.00),
        (gen_random_uuid(), 'Juan Perez', 'juan.p@petesthetic.com', '(787) 555-2002', 'groomer', 'active', '2002', 18.00),
        (gen_random_uuid(), 'Sofia Martinez', 'sofia.m@petesthetic.com', '(787) 555-2003', 'groomer', 'active', '2003', 16.00)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- ============================================
-- 8. CREATE INVENTORY FOR PET ESTHETIC (same as Demo)
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inventory'
  ) THEN
    -- Delete existing inventory for this business first to avoid conflicts
    DELETE FROM public.inventory WHERE business_id = business_uuid;
    
    INSERT INTO public.inventory (
      business_id,
      sku,
      product_name,
      description,
      category,
      brand,
      cost_price,
      retail_price,
      quantity_on_hand,
      reorder_level,
      reorder_quantity,
      unit_of_measure,
      is_active
    ) VALUES
      (business_uuid, 'SHMP-001', 'Champú Premium para Mascotas - Lavanda', 'Champú suave e hipoalergénico para todo tipo de pelaje', 'Suplementos de Aseo', 'PetCare Pro', 8.50, 15.99, 24, 10, 20, 'botella', true),
      (business_uuid, 'SHMP-002', 'Champú de Avena Calmante', 'Alivia la picazón y piel seca con avena natural', 'Suplementos de Aseo', 'PetCare Pro', 9.00, 16.99, 18, 10, 20, 'botella', true),
      (business_uuid, 'COND-001', 'Acondicionador Desenredante', 'Facilita el cepillado y reduce los nudos', 'Suplementos de Aseo', 'PetCare Pro', 10.00, 18.99, 15, 8, 15, 'botella', true),
      (business_uuid, 'TOOL-001', 'Cortaúñas Profesional', 'Acero inoxidable con protector de seguridad', 'Herramientas de Aseo', 'GroomMaster', 6.75, 14.99, 12, 5, 10, 'unidad', true),
      (business_uuid, 'TOOL-002', 'Cepillo Slicker', 'Remueve pelo suelto y previene enredos', 'Herramientas de Aseo', 'GroomMaster', 7.50, 16.99, 20, 8, 15, 'unidad', true),
      (business_uuid, 'TOOL-003', 'Tijeras de Grooming Curvas', 'Tijeras profesionales curvas para acabado', 'Herramientas de Aseo', 'GroomMaster', 15.00, 32.99, 8, 3, 5, 'unidad', true),
      (business_uuid, 'TRTS-001', 'Galletas de Entrenamiento de Pollo Orgánico', 'Bocaditos pequeños ideales para recompensa', 'Golosinas', 'Healthy Paws', 5.00, 12.99, 48, 15, 30, 'bolsa', true),
      (business_uuid, 'TRTS-002', 'Snacks Dentales', 'Ayuda a mantener los dientes limpios y aliento fresco', 'Golosinas', 'Healthy Paws', 6.50, 14.99, 36, 12, 25, 'bolsa', true),
      (business_uuid, 'ACC-001', 'Toalla de Microfibra para Secado', 'Toalla súper absorbente de secado rápido', 'Accesorios', 'PetCare Pro', 4.00, 9.99, 30, 10, 20, 'unidad', true),
      (business_uuid, 'ACC-002', 'Delantal de Grooming Impermeable', 'Delantal resistente al agua con bolsillos', 'Accesorios', 'GroomMaster', 12.00, 24.99, 10, 3, 5, 'unidad', true),
      (business_uuid, 'CARE-001', 'Solución para Limpieza de Oídos', 'Fórmula suave para limpieza rutinaria de oídos', 'Cuidado de Salud', 'VetCare', 8.00, 15.99, 20, 8, 15, 'botella', true),
      (business_uuid, 'CARE-002', 'Toallitas para Ojos', 'Toallitas pre-humedecidas para manchas de lágrimas', 'Cuidado de Salud', 'VetCare', 5.50, 11.99, 25, 10, 20, 'paquete', true)
    ON CONFLICT (business_id, sku) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 9. CREATE TIME ENTRIES FOR PET ESTHETIC (recent weeks)
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000002';
  emp1 UUID;
  emp2 UUID;
  d DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_entries') THEN
    SELECT id INTO emp1 FROM public.employees WHERE business_id = business_uuid AND name = 'Maria Rodriguez' LIMIT 1;
    SELECT id INTO emp2 FROM public.employees WHERE business_id = business_uuid AND name = 'Juan Perez' LIMIT 1;

    -- Últimos 5 días laborales para cada empleado
    FOR d IN (SELECT (current_date - 4) + generate_series(0,4)) LOOP
      IF emp1 IS NOT NULL THEN
        -- Check if business_id column exists, otherwise insert without it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'time_entries' AND column_name = 'business_id') THEN
          INSERT INTO public.time_entries (id, employee_id, business_id, clock_in, clock_out, notes)
          VALUES (
            gen_random_uuid(),
            emp1,
            business_uuid,
            (d::date + time '09:00'),
            (d::date + time '17:00'),
            'Turno regular'
          )
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO public.time_entries (id, employee_id, clock_in, clock_out, notes)
          VALUES (
            gen_random_uuid(),
            emp1,
            (d::date + time '09:00'),
            (d::date + time '17:00'),
            'Turno regular'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      IF emp2 IS NOT NULL THEN
        -- Check if business_id column exists, otherwise insert without it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'time_entries' AND column_name = 'business_id') THEN
          INSERT INTO public.time_entries (id, employee_id, business_id, clock_in, clock_out, notes)
          VALUES (
            gen_random_uuid(),
            emp2,
            business_uuid,
            (d::date + time '11:00'),
            (d::date + time '17:30'),
            'Turno flexible'
          )
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO public.time_entries (id, employee_id, clock_in, clock_out, notes)
          VALUES (
            gen_random_uuid(),
            emp2,
            (d::date + time '11:00'),
            (d::date + time '17:30'),
            'Turno flexible'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the data was created:

-- Check business
SELECT id, name, email, subscription_tier, subscription_status 
FROM public.businesses 
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Check customers count
SELECT COUNT(*) as customer_count 
FROM public.customers 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text;

-- Check pets count
SELECT COUNT(*) as pet_count 
FROM public.pets 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text;

-- Check services count
SELECT COUNT(*) as service_count 
FROM public.services 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text;

-- Check appointments count
SELECT COUNT(*) as appointment_count 
FROM public.appointments 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text;
