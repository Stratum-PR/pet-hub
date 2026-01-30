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

-- Clear existing demo data to avoid duplicates on re-run
-- Delete time_entries through employees (time_entries may not have business_id directly)
-- Handle type mismatch: employee_id might be TEXT or UUID, cast both sides to text for comparison
DELETE FROM public.time_entries 
WHERE employee_id::text IN (
  SELECT id::text FROM public.employees 
  WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text
);
DELETE FROM public.appointments WHERE business_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.pets        WHERE business_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.customers   WHERE business_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.employees   WHERE business_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.services    WHERE business_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.inventory   WHERE business_id = '00000000-0000-0000-0000-000000000001';

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
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Tratamiento Anti-Caída', 'Tratamiento especial para reducir la caída de pelo', 45.00, 45, true);

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
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'José', 'López', 'jose.lopez@email.com', '(787) 555-3456', 'Calle Tanca 321', 'San Juan', 'PR', '00902', 'Cliente VIP');

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
    (gen_random_uuid(), business_uuid, jose_id, 'Coco', 'dog', 'Poodle (Standard)', 6, 18.0, 'Perro senior, necesita manejo suave', 'Usar productos para perros senior')
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

-- ============================================
-- 7. CREATE DEMO INVENTORY (if inventory table exists)
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
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
      -- Shampoos & Conditioners
      (business_uuid, 'SHMP-001', 'Champú Premium para Mascotas - Lavanda', 'Champú suave e hipoalergénico para todo tipo de pelaje', 'Suplementos de Aseo', 'PetCare Pro', 8.50, 15.99, 24, 10, 20, 'botella', true),
      (business_uuid, 'SHMP-002', 'Champú de Avena Calmante', 'Alivia la picazón y piel seca con avena natural', 'Suplementos de Aseo', 'PetCare Pro', 9.00, 16.99, 18, 10, 20, 'botella', true),
      (business_uuid, 'COND-001', 'Acondicionador Desenredante', 'Facilita el cepillado y reduce los nudos', 'Suplementos de Aseo', 'PetCare Pro', 10.00, 18.99, 15, 8, 15, 'botella', true),
      -- Grooming Tools
      (business_uuid, 'TOOL-001', 'Cortaúñas Profesional', 'Acero inoxidable con protector de seguridad', 'Herramientas de Aseo', 'GroomMaster', 6.75, 14.99, 12, 5, 10, 'unidad', true),
      (business_uuid, 'TOOL-002', 'Cepillo Slicker', 'Remueve pelo suelto y previene enredos', 'Herramientas de Aseo', 'GroomMaster', 7.50, 16.99, 20, 8, 15, 'unidad', true),
      (business_uuid, 'TOOL-003', 'Tijeras de Grooming Curvas', 'Tijeras profesionales curvas para acabado', 'Herramientas de Aseo', 'GroomMaster', 15.00, 32.99, 8, 3, 5, 'unidad', true),
      -- Treats & Rewards
      (business_uuid, 'TRTS-001', 'Galletas de Entrenamiento de Pollo Orgánico', 'Bocaditos pequeños ideales para recompensa', 'Golosinas', 'Healthy Paws', 5.00, 12.99, 48, 15, 30, 'bolsa', true),
      (business_uuid, 'TRTS-002', 'Snacks Dentales', 'Ayuda a mantener los dientes limpios y aliento fresco', 'Golosinas', 'Healthy Paws', 6.50, 14.99, 36, 12, 25, 'bolsa', true),
      -- Accessories
      (business_uuid, 'ACC-001', 'Toalla de Microfibra para Secado', 'Toalla súper absorbente de secado rápido', 'Accesorios', 'PetCare Pro', 4.00, 9.99, 30, 10, 20, 'unidad', true),
      (business_uuid, 'ACC-002', 'Delantal de Grooming Impermeable', 'Delantal resistente al agua con bolsillos', 'Accesorios', 'GroomMaster', 12.00, 24.99, 10, 3, 5, 'unidad', true),
      -- Ear & Eye Care
      (business_uuid, 'CARE-001', 'Solución para Limpieza de Oídos', 'Fórmula suave para limpieza rutinaria de oídos', 'Cuidado de Salud', 'VetCare', 8.00, 15.99, 20, 8, 15, 'botella', true),
      (business_uuid, 'CARE-002', 'Toallitas para Ojos', 'Toallitas pre-humedecidas para manchas de lágrimas', 'Cuidado de Salud', 'VetCare', 5.50, 11.99, 25, 10, 20, 'paquete', true)
    ON CONFLICT (business_id, sku) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 8. CREATE DEMO TIME ENTRIES (recent weeks)
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  emp1 UUID;
  emp2 UUID;
  d DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_entries') THEN
    SELECT id INTO emp1 FROM public.employees WHERE business_id = business_uuid AND name = 'Juan Pérez' LIMIT 1;
    SELECT id INTO emp2 FROM public.employees WHERE business_id = business_uuid AND name = 'Sofía Rivera' LIMIT 1;

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
            (d::date + time '10:00'),
            (d::date + time '16:00'),
            'Turno corrido'
          )
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO public.time_entries (id, employee_id, clock_in, clock_out, notes)
          VALUES (
            gen_random_uuid(),
            emp2,
            (d::date + time '10:00'),
            (d::date + time '16:00'),
            'Turno corrido'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;
END $$;
