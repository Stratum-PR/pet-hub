-- ============================================
-- VERIFICATION QUERIES FOR PET ESTHETIC
-- ============================================
-- Run these to verify all data was created successfully

-- 1. Check business
SELECT id, name, email, subscription_tier, subscription_status 
FROM public.businesses 
WHERE name = 'Pet Esthetic';

-- 2. Check profile is linked
SELECT p.email, p.is_super_admin, b.name as business_name
FROM public.profiles p
LEFT JOIN public.businesses b ON p.business_id = b.id
WHERE p.email = 'g.rodriguez@stratumpr.com';

-- 3. Check data counts
SELECT 
  (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000002') as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000002') as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000002') as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000002') as appointments;

-- 4. List all customers
SELECT first_name, last_name, email, phone 
FROM public.customers 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'
ORDER BY last_name, first_name;

-- 5. List all pets
SELECT p.name, p.species, p.breed, c.first_name || ' ' || c.last_name as owner
FROM public.pets p
JOIN public.customers c ON p.customer_id = c.id
WHERE p.business_id::text = '00000000-0000-0000-0000-000000000002'
ORDER BY p.name;

-- 6. List all services
SELECT name, description, price, duration_minutes 
FROM public.services 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'
ORDER BY name;

-- 7. List all appointments
SELECT 
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.status,
  p.name as pet_name,
  c.first_name || ' ' || c.last_name as customer_name,
  s.name as service_name
FROM public.appointments a
JOIN public.pets p ON a.pet_id = p.id
JOIN public.customers c ON a.customer_id = c.id
LEFT JOIN public.services s ON a.service_id::text = s.id::text
WHERE a.business_id::text = '00000000-0000-0000-0000-000000000002'
ORDER BY a.appointment_date, a.start_time;
