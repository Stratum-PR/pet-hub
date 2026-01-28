-- ============================================
-- CHECK PROFILES AND DATA ACCESS
-- Run this to diagnose why data isn't showing
-- ============================================

-- 1. Check if profiles exist and are linked
SELECT 
  'PROFILES STATUS' as check_type,
  p.id as profile_id,
  p.email,
  p.business_id,
  p.is_super_admin,
  b.name as business_name,
  CASE 
    WHEN p.business_id IS NULL THEN '❌ NOT LINKED'
    WHEN b.id IS NULL THEN '❌ BUSINESS NOT FOUND'
    ELSE '✅ LINKED'
  END as status
FROM public.profiles p
LEFT JOIN public.businesses b ON p.business_id = b.id
WHERE p.email IN ('demo@pawsomegrooming.com', 'g.rodriguez@stratumpr.com', 'tech@stratumpr.com')
ORDER BY p.email;

-- 2. Check if users exist in auth.users
SELECT 
  'AUTH USERS' as check_type,
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email IN ('demo@pawsomegrooming.com', 'g.rodriguez@stratumpr.com', 'tech@stratumpr.com')
ORDER BY email;

-- 3. Check if profiles exist for these users
SELECT 
  'PROFILES EXISTENCE' as check_type,
  u.email as auth_email,
  u.id as auth_user_id,
  p.id as profile_id,
  CASE 
    WHEN p.id IS NULL THEN '❌ PROFILE MISSING'
    ELSE '✅ PROFILE EXISTS'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email IN ('demo@pawsomegrooming.com', 'g.rodriguez@stratumpr.com', 'tech@stratumpr.com')
ORDER BY u.email;

-- 4. Count data for demo business (using business_id directly)
SELECT 
  'DEMO DATA COUNTS' as check_type,
  (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as appointments;

-- 5. Count data for Pet Esthetic business
SELECT 
  'PET ESTHETIC DATA COUNTS' as check_type,
  (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as appointments;

-- 6. Test RLS: What would a user see? (This simulates what the app sees)
-- Note: This will only work if you're authenticated, but shows the query structure
SELECT 
  'RLS TEST - DEMO USER' as check_type,
  COUNT(*) as visible_customers
FROM public.customers
WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text;
