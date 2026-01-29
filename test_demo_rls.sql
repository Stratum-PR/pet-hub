-- Test script to verify demo RLS policies work
-- Run this in Supabase SQL Editor while logged out (or as anon role)

-- Test 1: Check if we can see demo customers as anonymous
SELECT 
  'customers' as table_name,
  COUNT(*) as row_count
FROM public.customers
WHERE business_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Test 2: Check if we can see demo pets as anonymous
SELECT 
  'pets' as table_name,
  COUNT(*) as row_count
FROM public.pets
WHERE business_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Test 3: Check if we can see demo appointments as anonymous
SELECT 
  'appointments' as table_name,
  COUNT(*) as row_count
FROM public.appointments
WHERE business_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Test 4: Check if we can see demo employees as anonymous
SELECT 
  'employees' as table_name,
  COUNT(*) as row_count
FROM public.employees
WHERE business_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Test 5: Check if we can see demo services as anonymous
SELECT 
  'services' as table_name,
  COUNT(*) as row_count
FROM public.services
WHERE business_id::text = '00000000-0000-0000-0000-000000000001';

-- If all return 0, the RLS policies are blocking access
-- If they return the correct counts, the policies are working
