-- ============================================
-- ENSURE DEMO PROFILE ONLY SEES BUSINESS_ID ENDING IN 1
-- ============================================
-- This script ensures that demo users only see data with business_id = 00000000-0000-0000-0000-000000000001

-- 1. Update demo user profile to have business_id ending in 1
-- Replace 'demo@pawsomegrooming.com' with the actual demo user email
UPDATE public.profiles
SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE email = 'demo@pawsomegrooming.com'
  AND (business_id IS NULL OR business_id != '00000000-0000-0000-0000-000000000001'::uuid);

-- 2. Ensure RLS policies are correct (drop and recreate to be sure)
DROP POLICY IF EXISTS "Users can access pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;

CREATE POLICY "Users can access pets from their business"
  ON public.pets FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage pets from their business"
  ON public.pets FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 3. Same for clients
DROP POLICY IF EXISTS "Users can access clients from their business" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients from their business" ON public.clients;

CREATE POLICY "Users can access clients from their business"
  ON public.clients FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage clients from their business"
  ON public.clients FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. Same for appointments
DROP POLICY IF EXISTS "Users can access appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;

CREATE POLICY "Users can access appointments from their business"
  ON public.appointments FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage appointments from their business"
  ON public.appointments FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 5. Same for services
DROP POLICY IF EXISTS "Users can access services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;

CREATE POLICY "Users can access services from their business"
  ON public.services FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage services from their business"
  ON public.services FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 6. Verify: Check what business_id the demo user has
SELECT 
  id,
  email,
  business_id,
  CASE 
    WHEN business_id = '00000000-0000-0000-0000-000000000001'::uuid THEN '✅ Correct (Demo)'
    ELSE '❌ Wrong business_id'
  END as status
FROM public.profiles
WHERE email = 'demo@pawsomegrooming.com';

-- 7. Verify: Count pets visible to demo user (should only be pets with business_id ending in 1)
-- This query simulates what the demo user would see
SELECT 
  COUNT(*) as total_pets,
  COUNT(*) FILTER (WHERE business_id = '00000000-0000-0000-0000-000000000001'::uuid) as demo_pets,
  COUNT(*) FILTER (WHERE business_id != '00000000-0000-0000-0000-000000000001'::uuid) as other_pets
FROM public.pets;
