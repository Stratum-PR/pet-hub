-- ============================================
-- TEST RLS POLICIES AND DATA ACCESS
-- Run this while logged in as demo@pawsomegrooming.com or g.rodriguez@stratumpr.com
-- ============================================

-- 1. Check current authenticated user
SELECT 
  'AUTH USER' as test,
  auth.uid() as user_id,
  auth.email() as user_email;

-- 2. Check if profile is accessible
SELECT 
  'MY PROFILE' as test,
  id,
  email,
  business_id,
  is_super_admin
FROM public.profiles
WHERE id = auth.uid();

-- 3. Test customers query (what the app does) - with type casting
SELECT 
  'CUSTOMERS TEST' as test,
  COUNT(*) as count,
  business_id
FROM public.customers
WHERE business_id::text IN (
  SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
)
GROUP BY business_id;

-- 4. Test pets query - with type casting
SELECT 
  'PETS TEST' as test,
  COUNT(*) as count,
  business_id
FROM public.pets
WHERE business_id::text IN (
  SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
)
GROUP BY business_id;

-- 5. Test services query (handle TEXT/UUID mismatch)
SELECT 
  'SERVICES TEST' as test,
  COUNT(*) as count,
  business_id
FROM public.services
WHERE business_id IN (
  SELECT business_id FROM public.profiles WHERE id = auth.uid()
)
GROUP BY business_id;

-- 6. Test appointments query - with type casting
SELECT 
  'APPOINTMENTS TEST' as test,
  COUNT(*) as count,
  business_id
FROM public.appointments
WHERE business_id::text IN (
  SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
)
GROUP BY business_id;

-- 7. Direct query test (bypassing RLS to see if data exists)
-- This will only work if you have service role access
-- Replace '00000000-0000-0000-0000-000000000001' with your business_id
SELECT 
  'DIRECT QUERY (bypass RLS)' as test,
  (SELECT COUNT(*) FROM public.customers WHERE business_id = '00000000-0000-0000-0000-000000000001') as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id = '00000000-0000-0000-0000-000000000001') as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id = '00000000-0000-0000-0000-000000000001') as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id = '00000000-0000-0000-0000-000000000001') as appointments;
