-- ============================================
-- TEST DATA QUERY - Run this as the logged-in user
-- This simulates what the app is trying to do
-- ============================================

-- First, check what user you're logged in as
SELECT 
  'CURRENT USER' as check_type,
  auth.uid() as user_id,
  auth.email() as user_email;

-- Check the profile for the current user
SELECT 
  'MY PROFILE' as check_type,
  id,
  email,
  business_id,
  is_super_admin
FROM public.profiles
WHERE id = auth.uid();

-- If you have a business_id, test the queries the app makes
-- Replace 'YOUR_BUSINESS_ID_HERE' with the actual business_id from above
DO $$
DECLARE
  my_business_id UUID;
BEGIN
  -- Get your business_id
  SELECT business_id INTO my_business_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF my_business_id IS NULL THEN
    RAISE NOTICE 'No business_id found for current user';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing queries with business_id: %', my_business_id;

  -- Test customers query
  PERFORM COUNT(*) FROM public.customers WHERE business_id = my_business_id;
  RAISE NOTICE 'Customers query: OK';

  -- Test pets query
  PERFORM COUNT(*) FROM public.pets WHERE business_id = my_business_id;
  RAISE NOTICE 'Pets query: OK';

  -- Test services query
  PERFORM COUNT(*) FROM public.services WHERE business_id = my_business_id;
  RAISE NOTICE 'Services query: OK';

  -- Test appointments query
  PERFORM COUNT(*) FROM public.appointments WHERE business_id = my_business_id;
  RAISE NOTICE 'Appointments query: OK';

  -- Show actual counts
  RAISE NOTICE 'Customers count: %', (SELECT COUNT(*) FROM public.customers WHERE business_id = my_business_id);
  RAISE NOTICE 'Pets count: %', (SELECT COUNT(*) FROM public.pets WHERE business_id = my_business_id);
  RAISE NOTICE 'Services count: %', (SELECT COUNT(*) FROM public.services WHERE business_id = my_business_id);
  RAISE NOTICE 'Appointments count: %', (SELECT COUNT(*) FROM public.appointments WHERE business_id = my_business_id);
END $$;
