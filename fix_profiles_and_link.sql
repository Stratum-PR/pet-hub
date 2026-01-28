-- ============================================
-- FIX PROFILES AND LINK TO BUSINESSES
-- This script will create profiles if missing and link them
-- ============================================

-- Step 1: Get user IDs from auth.users
DO $$
DECLARE
  demo_user_id UUID;
  pet_esthetic_user_id UUID;
  tech_user_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo@pawsomegrooming.com' LIMIT 1;
  SELECT id INTO pet_esthetic_user_id FROM auth.users WHERE email = 'g.rodriguez@stratumpr.com' LIMIT 1;
  SELECT id INTO tech_user_id FROM auth.users WHERE email = 'tech@stratumpr.com' LIMIT 1;

  -- Create/update demo profile
  IF demo_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, business_id, is_super_admin)
    VALUES (demo_user_id, 'demo@pawsomegrooming.com', '00000000-0000-0000-0000-000000000001', false)
    ON CONFLICT (id) DO UPDATE
    SET business_id = '00000000-0000-0000-0000-000000000001',
        email = 'demo@pawsomegrooming.com',
        is_super_admin = false;
    
    RAISE NOTICE 'Demo profile created/updated for user: %', demo_user_id;
  ELSE
    RAISE NOTICE 'Demo user not found in auth.users';
  END IF;

  -- Create/update Pet Esthetic profile
  IF pet_esthetic_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, business_id, is_super_admin)
    VALUES (pet_esthetic_user_id, 'g.rodriguez@stratumpr.com', '00000000-0000-0000-0000-000000000002', false)
    ON CONFLICT (id) DO UPDATE
    SET business_id = '00000000-0000-0000-0000-000000000002',
        email = 'g.rodriguez@stratumpr.com',
        is_super_admin = false;
    
    RAISE NOTICE 'Pet Esthetic profile created/updated for user: %', pet_esthetic_user_id;
  ELSE
    RAISE NOTICE 'Pet Esthetic user not found in auth.users';
  END IF;

  -- Create/update tech profile (super admin)
  IF tech_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, business_id, is_super_admin)
    VALUES (tech_user_id, 'tech@stratumpr.com', NULL, true)
    ON CONFLICT (id) DO UPDATE
    SET email = 'tech@stratumpr.com',
        is_super_admin = true;
    
    RAISE NOTICE 'Tech profile created/updated for user: %', tech_user_id;
  ELSE
    RAISE NOTICE 'Tech user not found in auth.users';
  END IF;
END $$;

-- Step 2: Verify the links
SELECT 
  'VERIFICATION' as check_type,
  p.email,
  p.business_id,
  p.is_super_admin,
  b.name as business_name,
  CASE 
    WHEN p.business_id IS NULL AND NOT p.is_super_admin THEN '❌ NOT LINKED'
    WHEN p.business_id IS NOT NULL AND b.id IS NULL THEN '❌ BUSINESS NOT FOUND'
    WHEN p.is_super_admin THEN '✅ SUPER ADMIN'
    ELSE '✅ LINKED'
  END as status
FROM public.profiles p
LEFT JOIN public.businesses b ON p.business_id = b.id
WHERE p.email IN ('demo@pawsomegrooming.com', 'g.rodriguez@stratumpr.com', 'tech@stratumpr.com')
ORDER BY p.email;
