-- ============================================
-- FIX PROFILE FOR tech@stratumpr.com
-- ============================================
-- Run this to verify and fix the profile for your admin account

-- Step 1: Check if user exists in auth.users
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'tech@stratumpr.com';

-- Step 2: Check if profile exists
SELECT id, email, is_super_admin, business_id, created_at
FROM public.profiles 
WHERE email = 'tech@stratumpr.com';

-- Step 3: If profile doesn't exist, create it
-- First, get the user ID from the query above, then run:
-- (Replace USER_ID_HERE with the actual ID from Step 1)

DO $$
DECLARE
  user_id_val UUID;
BEGIN
  -- Get user ID
  SELECT id INTO user_id_val
  FROM auth.users
  WHERE email = 'tech@stratumpr.com';

  IF user_id_val IS NOT NULL THEN
    -- Insert or update profile
    INSERT INTO public.profiles (id, email, is_super_admin, business_id)
    VALUES (user_id_val, 'tech@stratumpr.com', true, NULL)
    ON CONFLICT (id) DO UPDATE
    SET 
      is_super_admin = true,
      email = 'tech@stratumpr.com';
    
    RAISE NOTICE 'Profile created/updated for tech@stratumpr.com';
  ELSE
    RAISE NOTICE 'User tech@stratumpr.com not found in auth.users';
  END IF;
END $$;

-- Step 4: Verify the profile was created/updated
SELECT id, email, is_super_admin, business_id, created_at
FROM public.profiles 
WHERE email = 'tech@stratumpr.com';

-- Step 5: Test RLS - This should return your profile
-- (Run this while logged in as tech@stratumpr.com)
SELECT * FROM public.profiles WHERE id = auth.uid();
