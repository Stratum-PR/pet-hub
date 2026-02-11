-- Seed data with Puerto Rican clients, employees, and pets
-- This migration adds diverse data including young Puerto Rican clients

DO $$
DECLARE
  v_business_id UUID;
  v_client_id UUID;
  v_pet_id UUID;
  v_employee_id UUID;
  v_service_id UUID;
  v_breed_id UUID;
  i INTEGER;
  pet_names TEXT[] := ARRAY['Max', 'Luna', 'Bella', 'Rocky', 'Coco', 'Milo', 'Lola', 'Charlie', 'Princess', 'Toby', 'Daisy', 'Zeus', 'Maya', 'Bruno', 'Lucky'];
  pet_breeds TEXT[] := ARRAY['Labrador Retriever', 'Poodle', 'Golden Retriever', 'French Bulldog', 'Chihuahua', 'Yorkshire Terrier', 'Shih Tzu', 'German Shepherd'];
BEGIN
  -- Get or create default business
  SELECT id INTO v_business_id FROM public.businesses LIMIT 1;
  
  IF v_business_id IS NULL THEN
    INSERT INTO public.businesses (name, created_at, updated_at)
    VALUES ('Pet Esthetic', NOW(), NOW())
    RETURNING id INTO v_business_id;
  END IF;

  -- Add Puerto Rican employees (only if they don't exist)
  INSERT INTO public.employees (business_id, name, email, phone, pin, hourly_rate, role, status, created_at, updated_at)
  SELECT v_business_id, 'María Rodríguez', 'maria.rodriguez@petesthetic.com', '787-555-0101', '1234', 18.00, 'Groomer', 'active', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE email = 'maria.rodriguez@petesthetic.com');

  INSERT INTO public.employees (business_id, name, email, phone, pin, hourly_rate, role, status, created_at, updated_at)
  SELECT v_business_id, 'Carlos Rivera', 'carlos.rivera@petesthetic.com', '787-555-0102', '5678', 20.00, 'Senior Groomer', 'active', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE email = 'carlos.rivera@petesthetic.com');

  INSERT INTO public.employees (business_id, name, email, phone, pin, hourly_rate, role, status, created_at, updated_at)
  SELECT v_business_id, 'Sofía Martínez', 'sofia.martinez@petesthetic.com', '787-555-0103', '9012', 16.00, 'Groomer', 'active', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE email = 'sofia.martinez@petesthetic.com');

  INSERT INTO public.employees (business_id, name, email, phone, pin, hourly_rate, role, status, created_at, updated_at)
  SELECT v_business_id, 'Diego González', 'diego.gonzalez@petesthetic.com', '787-555-0104', '3456', 19.00, 'Groomer', 'active', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.employees WHERE email = 'diego.gonzalez@petesthetic.com');

  -- Add young Puerto Rican clients
  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Isabella', 'Torres', 'isabella.torres@email.com', '787-555-1001', 'Calle San Juan 123', 'San Juan', 'PR', '00901', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'isabella.torres@email.com')
  RETURNING id INTO v_client_id;

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Sebastián', 'Vega', 'sebastian.vega@email.com', '787-555-1002', 'Ave. Ponce de León 456', 'San Juan', 'PR', '00902', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'sebastian.vega@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Valentina', 'Ramos', 'valentina.ramos@email.com', '787-555-1003', 'Calle Loíza 789', 'San Juan', 'PR', '00911', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'valentina.ramos@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Mateo', 'Cruz', 'mateo.cruz@email.com', '787-555-1004', 'Carr. 2 Km 5.2', 'Bayamón', 'PR', '00956', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'mateo.cruz@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Camila', 'Ortiz', 'camila.ortiz@email.com', '787-555-1005', 'Ave. Las Américas 321', 'Ponce', 'PR', '00717', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'camila.ortiz@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Adrián', 'Méndez', 'adrian.mendez@email.com', '787-555-1006', 'Calle Tanca 654', 'San Juan', 'PR', '00901', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'adrian.mendez@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Lucía', 'Santiago', 'lucia.santiago@email.com', '787-555-1007', 'Urb. Villa Nevárez', 'Carolina', 'PR', '00983', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'lucia.santiago@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Nicolás', 'Delgado', 'nicolas.delgado@email.com', '787-555-1008', 'Calle Mayor 987', 'Mayagüez', 'PR', '00680', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'nicolas.delgado@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Emma', 'Herrera', 'emma.herrera@email.com', '787-555-1009', 'Ave. Muñoz Rivera 147', 'San Juan', 'PR', '00901', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'emma.herrera@email.com');

  INSERT INTO public.clients (business_id, first_name, last_name, email, phone, address, city, state, zip_code, created_at, updated_at)
  SELECT v_business_id, 'Alejandro', 'Morales', 'alejandro.morales@email.com', '787-555-1010', 'Calle Fortaleza 258', 'San Juan', 'PR', '00901', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE email = 'alejandro.morales@email.com');

  -- Add pets for clients (simplified - add at least one pet per client)
  FOR v_client_id IN 
    SELECT id FROM public.clients WHERE business_id = v_business_id AND email LIKE '%@email.com'
  LOOP
    -- Check if client already has pets
    IF NOT EXISTS (SELECT 1 FROM public.pets WHERE client_id = v_client_id LIMIT 1) THEN
      -- Get a random breed
      SELECT id INTO v_breed_id FROM public.breeds WHERE species = 'dog' ORDER BY RANDOM() LIMIT 1;
      
      -- Add a pet
      INSERT INTO public.pets (
        business_id, client_id, name, species, breed_id, 
        birth_month, birth_year, weight, vaccination_status, created_at, updated_at
      )
      VALUES (
        v_business_id, 
        v_client_id,
        pet_names[1 + (RANDOM() * (ARRAY_LENGTH(pet_names, 1) - 1))::INT],
        'dog',
        v_breed_id,
        (1 + (RANDOM() * 11))::INT,
        (2020 + (RANDOM() * 4))::INT,
        (10 + (RANDOM() * 50))::NUMERIC,
        'up_to_date',
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;

END $$;
