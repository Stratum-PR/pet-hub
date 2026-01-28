-- ============================================
-- SEED SCRIPT FOR DEMO DATA
-- ============================================
-- This script creates a demo business with sample data
-- Run this after the multi-tenant migration

-- ============================================
-- 1. CREATE DEMO BUSINESS
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
  subscription_tier,
  subscription_status,
  onboarding_completed,
  trial_ends_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Pawsome Grooming Demo',
  'demo@pawsomegrooming.com',
  '(555) 123-4567',
  '123 Pet Street',
  'San Francisco',
  'CA',
  '94102',
  'pro',
  'active',
  true,
  NOW() + INTERVAL '14 days'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. CREATE DEMO USER (if auth user exists)
-- ============================================
-- Note: You need to create the auth user first via Supabase Auth UI
-- Then run this to link the profile:
-- UPDATE public.profiles SET business_id = '00000000-0000-0000-0000-000000000001' WHERE email = 'demo@pawsomegrooming.com';

-- ============================================
-- 3. CREATE DEMO SERVICES
-- ============================================
INSERT INTO public.services (
  business_id,
  name,
  description,
  price,
  duration_minutes,
  is_active
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Basic Bath', 'Full bath with shampoo and conditioner', 35.00, 30, true),
  ('00000000-0000-0000-0000-000000000001', 'Full Groom', 'Complete grooming service including bath, haircut, nail trim, and ear cleaning', 65.00, 90, true),
  ('00000000-0000-0000-0000-000000000001', 'Nail Trim', 'Nail clipping and filing', 15.00, 15, true),
  ('00000000-0000-0000-0000-000000000001', 'Teeth Brushing', 'Dental hygiene treatment', 20.00, 10, true),
  ('00000000-0000-0000-0000-000000000001', 'De-shedding Treatment', 'Special treatment to reduce shedding', 45.00, 45, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. CREATE DEMO CUSTOMERS
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
  zip_code
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Sarah', 'Johnson', 'sarah.johnson@email.com', '(555) 111-2222', '456 Main St', 'San Francisco', 'CA', '94103'),
  ('00000000-0000-0000-0000-000000000001', 'Mike', 'Chen', 'mike.chen@email.com', '(555) 222-3333', '789 Oak Ave', 'San Francisco', 'CA', '94104'),
  ('00000000-0000-0000-0000-000000000001', 'Emily', 'Rodriguez', 'emily.rodriguez@email.com', '(555) 333-4444', '321 Pine St', 'San Francisco', 'CA', '94105'),
  ('00000000-0000-0000-0000-000000000001', 'David', 'Kim', 'david.kim@email.com', '(555) 444-5555', '654 Elm St', 'San Francisco', 'CA', '94106')
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. CREATE DEMO PETS
-- ============================================
-- Get customer IDs (assuming they were just created)
DO $$
DECLARE
  sarah_id UUID;
  mike_id UUID;
  emily_id UUID;
  david_id UUID;
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Get customer IDs
  SELECT id INTO sarah_id FROM public.customers WHERE business_id = business_uuid AND first_name = 'Sarah' AND last_name = 'Johnson' LIMIT 1;
  SELECT id INTO mike_id FROM public.customers WHERE business_id = business_uuid AND first_name = 'Mike' AND last_name = 'Chen' LIMIT 1;
  SELECT id INTO emily_id FROM public.customers WHERE business_id = business_uuid AND first_name = 'Emily' AND last_name = 'Rodriguez' LIMIT 1;
  SELECT id INTO david_id FROM public.customers WHERE business_id = business_uuid AND first_name = 'David' AND last_name = 'Kim' LIMIT 1;

  -- Insert pets
  INSERT INTO public.pets (
    business_id,
    customer_id,
    name,
    species,
    breed,
    age,
    weight,
    color,
    notes
  ) VALUES
    (business_uuid, sarah_id, 'Max', 'dog', 'Golden Retriever', 3, 75.5, 'Golden', 'Very friendly, loves treats'),
    (business_uuid, mike_id, 'Bella', 'dog', 'Poodle', 5, 15.2, 'White', 'Requires gentle handling'),
    (business_uuid, emily_id, 'Luna', 'cat', 'Siamese', 2, 8.5, 'Cream', 'Loves being brushed'),
    (business_uuid, david_id, 'Charlie', 'dog', 'Labrador', 4, 65.0, 'Black', 'High energy, needs exercise'),
    (business_uuid, sarah_id, 'Daisy', 'dog', 'Beagle', 1, 20.0, 'Tri-color', 'Puppy, very playful')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- 6. CREATE DEMO APPOINTMENTS FOR TODAY
-- ============================================
DO $$
DECLARE
  business_uuid UUID := '00000000-0000-0000-0000-000000000001';
  max_pet_id UUID;
  charlie_pet_id UUID;
  full_groom_service_id UUID;
  basic_bath_service_id UUID;
  sarah_customer_id UUID;
  david_customer_id UUID;
  today_date DATE := CURRENT_DATE;
BEGIN
  -- Get service IDs
  SELECT id INTO full_groom_service_id FROM public.services WHERE business_id = business_uuid AND name = 'Full Groom' LIMIT 1;
  SELECT id INTO basic_bath_service_id FROM public.services WHERE business_id = business_uuid AND name = 'Basic Bath' LIMIT 1;

  -- Get customer IDs
  SELECT id INTO sarah_customer_id FROM public.customers WHERE business_id = business_uuid AND first_name = 'Sarah' LIMIT 1;
  SELECT id INTO david_customer_id FROM public.customers WHERE business_id = business_uuid AND first_name = 'David' LIMIT 1;

  -- Get pet IDs
  SELECT id INTO max_pet_id FROM public.pets WHERE business_id = business_uuid AND name = 'Max' LIMIT 1;
  SELECT id INTO charlie_pet_id FROM public.pets WHERE business_id = business_uuid AND name = 'Charlie' LIMIT 1;

  -- Insert appointments
  INSERT INTO public.appointments (
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
      business_uuid,
      sarah_customer_id,
      max_pet_id,
      full_groom_service_id,
      today_date,
      '10:00:00',
      '11:30:00',
      'confirmed',
      65.00,
      'Regular grooming appointment'
    ),
    (
      business_uuid,
      david_customer_id,
      charlie_pet_id,
      basic_bath_service_id,
      today_date,
      '14:00:00',
      '14:30:00',
      'scheduled',
      35.00,
      'First time customer'
    )
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- 7. MAKE YOURSELF SUPER ADMIN
-- ============================================
-- Run this SQL command in Supabase SQL Editor:
-- UPDATE public.profiles SET is_super_admin = true WHERE email = 'your-email@example.com';
