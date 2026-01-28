-- ============================================
-- LINK USERS TO BUSINESSES AND VERIFY DATA
-- Run this script to ensure everything is set up correctly
-- ============================================

-- Step 1: Link demo user to demo business
UPDATE public.profiles
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE email = 'demo@pawsomegrooming.com';

-- Step 2: Link Pet Esthetic user to Pet Esthetic business
UPDATE public.profiles
SET business_id = '00000000-0000-0000-0000-000000000002'
WHERE email = 'g.rodriguez@stratumpr.com';

-- Step 3: Ensure tech@stratumpr.com is super admin
UPDATE public.profiles
SET is_super_admin = true
WHERE email = 'tech@stratumpr.com';

-- Step 4: Verify profiles are linked
SELECT 
  'PROFILES CHECK' as check_type,
  p.email,
  p.business_id,
  p.is_super_admin,
  b.name as business_name
FROM public.profiles p
LEFT JOIN public.businesses b ON p.business_id = b.id
WHERE p.email IN ('demo@pawsomegrooming.com', 'g.rodriguez@stratumpr.com', 'tech@stratumpr.com')
ORDER BY p.email;

-- Step 5: Verify demo business data
SELECT 
  'DEMO BUSINESS DATA' as check_type,
  (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as appointments,
  (SELECT COUNT(*) FROM public.employees WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as employees;

-- Step 6: Verify Pet Esthetic business data
SELECT 
  'PET ESTHETIC BUSINESS DATA' as check_type,
  (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as appointments,
  (SELECT COUNT(*) FROM public.employees WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as employees;

-- Step 7: Show sample customers from demo
SELECT 
  'DEMO SAMPLE CUSTOMERS' as check_type,
  first_name,
  last_name,
  email,
  phone
FROM public.customers 
WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text
LIMIT 3;

-- Step 8: Show sample customers from Pet Esthetic
SELECT 
  'PET ESTHETIC SAMPLE CUSTOMERS' as check_type,
  first_name,
  last_name,
  email,
  phone
FROM public.customers 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text
LIMIT 3;

-- Step 9: Check if businesses exist
SELECT 
  'BUSINESSES' as check_type,
  id,
  name,
  email,
  subscription_tier,
  subscription_status
FROM public.businesses
WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
ORDER BY name;
