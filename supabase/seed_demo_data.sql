-- ============================================
-- SEED SCRIPT FOR DEMO BUSINESS DATA
-- ============================================
-- Run this in Supabase SQL Editor to populate demo business with sample data
-- Business ID: 00000000-0000-0000-0000-000000000001
-- Business Name: "Demo" (slug: "demo")

-- ============================================
-- 1. UPDATE DEMO BUSINESS NAME TO "Demo"
-- ============================================
UPDATE public.businesses 
SET name = 'Demo'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================
-- 2. CREATE DEMO SERVICES (Puerto Rican themed)
-- ============================================
INSERT INTO public.services (
  id,
  business_id,
  name,
  description,
  price,
  duration_minutes,
  is_active
) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Baño Básico', 'Baño completo con champú y acondicionador', 35.00, 30, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Arreglo Completo', 'Servicio completo de grooming incluyendo baño, corte, limpieza de uñas y orejas', 65.00, 90, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Corte de Uñas', 'Corte y limado de uñas', 15.00, 15, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Cepillado de Dientes', 'Tratamiento de higiene dental', 20.00, 10, true),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Tratamiento Anti-Caída', 'Tratamiento especial para reducir la caída de pelo', 45.00, 45, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CREATE DEMO CUSTOMERS (Puerto Rican names)
-- ============================================
INSERT INTO public.customers (
  id,
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
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'María', 'Rodríguez', 'maria.rodriguez@email.com', '(787) 555-1234', 'Calle San Juan 123', 'San Juan', 'PR', '00901', 'Cliente frecuente, muy amable'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Carlos', 'González', 'carlos.gonzalez@email.com', '(787) 555-5678', 'Avenida Ponce 456', 'Ponce', 'PR', '00717', 'Prefiere citas en la mañana'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Ana', 'Martínez', 'ana.martinez@email.com', '(787) 555-9012', 'Calle Loíza 789', 'Carolina', 'PR', '00983', 'Nueva cliente'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'José', 'López', 'jose.lopez@email.com', '(787) 555-3456', 'Calle Tanca 321', 'San Juan', 'PR', '00902', 'Cliente VIP')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. CREATE DEMO PETS
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  maria_id UUID;
  carlos_id UUID;
  ana_id UUID;
  jose_id UUID;
BEGIN
  -- Get customer IDs (cast to handle type mismatch)
  SELECT id INTO maria_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'María' AND last_name = 'Rodríguez' LIMIT 1;
  SELECT id INTO carlos_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Carlos' AND last_name = 'González' LIMIT 1;
  SELECT id INTO ana_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Ana' AND last_name = 'Martínez' LIMIT 1;
  SELECT id INTO jose_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'José' AND last_name = 'López' LIMIT 1;

  -- Insert pets
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
    (gen_random_uuid(), business_uuid, maria_id, 'Luna', 'dog', 'Yorkshire Terrier', 4, 7.5, 'Muy tranquila y bien educada', 'Usar champú suave, piel sensible'),
    (gen_random_uuid(), business_uuid, carlos_id, 'Max', 'dog', 'German Shepherd', 5, 85.0, 'Perro grande, necesita tiempo extra', 'Requiere peluquero experimentado'),
    (gen_random_uuid(), business_uuid, ana_id, 'Bella', 'dog', 'Shih Tzu', 3, 12.0, 'Le encanta la atención', NULL),
    (gen_random_uuid(), business_uuid, ana_id, 'Rocky', 'dog', 'French Bulldog', 2, 25.0, 'Cachorro juguetón', 'Manejar con cuidado, problemas respiratorios'),
    (gen_random_uuid(), business_uuid, jose_id, 'Coco', 'dog', 'Poodle', 6, 18.0, 'Perro senior, necesita manejo suave', 'Usar productos para perros senior')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- 5. CREATE DEMO APPOINTMENTS
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  maria_customer_id UUID;
  carlos_customer_id UUID;
  luna_pet_id UUID;
  max_pet_id UUID;
  full_groom_service_id UUID;
  basic_bath_service_id UUID;
  today_date DATE := CURRENT_DATE;
  tomorrow_date DATE := CURRENT_DATE + INTERVAL '1 day';
BEGIN
  -- Get customer IDs (cast to handle type mismatch)
  SELECT id INTO maria_customer_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'María' LIMIT 1;
  SELECT id INTO carlos_customer_id FROM public.customers WHERE business_id::text = business_uuid::text AND first_name = 'Carlos' LIMIT 1;

  -- Get pet IDs (cast to handle type mismatch)
  SELECT id INTO luna_pet_id FROM public.pets WHERE business_id::text = business_uuid::text AND name = 'Luna' LIMIT 1;
  SELECT id INTO max_pet_id FROM public.pets WHERE business_id::text = business_uuid::text AND name = 'Max' LIMIT 1;

  -- Get service IDs (cast to handle type mismatch)
  SELECT id INTO full_groom_service_id FROM public.services WHERE business_id::text = business_uuid::text AND name = 'Arreglo Completo' LIMIT 1;
  SELECT id INTO basic_bath_service_id FROM public.services WHERE business_id::text = business_uuid::text AND name = 'Baño Básico' LIMIT 1;

  -- Insert appointments
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
    (
      gen_random_uuid(),
      business_uuid,
      maria_customer_id,
      luna_pet_id,
      full_groom_service_id,
      today_date,
      '09:00:00',
      '10:30:00',
      'confirmed',
      65.00,
      'Cita mensual regular'
    ),
    (
      gen_random_uuid(),
      business_uuid,
      carlos_customer_id,
      max_pet_id,
      basic_bath_service_id,
      today_date,
      '13:00:00',
      '13:30:00',
      'scheduled',
      35.00,
      'Perro grande, permitir tiempo extra'
    ),
    (
      gen_random_uuid(),
      business_uuid,
      maria_customer_id,
      luna_pet_id,
      basic_bath_service_id,
      tomorrow_date,
      '10:00:00',
      '10:30:00',
      'confirmed',
      35.00,
      'Seguimiento'
    )
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- 6. CREATE DEMO EMPLOYEES (if table exists)
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    -- Check if business_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'business_id') THEN
      -- Insert with business_id
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
        (gen_random_uuid(), business_uuid, 'Juan Pérez', 'juan.perez@demo.com', '(787) 555-1111', 'groomer', 'active', '1234', 18.00),
        (gen_random_uuid(), business_uuid, 'Sofía Rivera', 'sofia.rivera@demo.com', '(787) 555-2222', 'groomer', 'active', '5678', 22.00)
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
        (gen_random_uuid(), 'Juan Pérez', 'juan.perez@demo.com', '(787) 555-1111', 'groomer', 'active', '1234', 18.00),
        (gen_random_uuid(), 'Sofía Rivera', 'sofia.rivera@demo.com', '(787) 555-2222', 'groomer', 'active', '5678', 22.00)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
