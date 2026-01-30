-- ============================================
-- FIX RLS POLICIES - ENSURE PROPER BUSINESS ISOLATION
-- ============================================
-- This script ensures RLS policies correctly filter by business_id
-- Run this in production to fix any RLS policy issues

-- 1. Ensure RLS is enabled on all tables
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 2. Drop and recreate pets policies to ensure they're correct
DROP POLICY IF EXISTS "Users can access pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Public read for demo pets" ON public.pets;

-- Recreate SELECT policy - users can only see pets from their business
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

-- Recreate ALL policy - users can only manage pets from their business
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

-- Public demo policy (only for business_id ending in 1, and only when not logged in)
CREATE POLICY "Public read for demo pets"
  ON public.pets FOR SELECT
  USING (
    auth.uid() IS NULL 
    AND business_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- 3. Drop and recreate clients policies
DROP POLICY IF EXISTS "Users can access clients from their business" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients from their business" ON public.clients;
DROP POLICY IF EXISTS "Public read for demo clients" ON public.clients;

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

CREATE POLICY "Public read for demo clients"
  ON public.clients FOR SELECT
  USING (
    auth.uid() IS NULL 
    AND business_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- 4. Drop and recreate appointments policies
DROP POLICY IF EXISTS "Users can access appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Public read for demo appointments" ON public.appointments;

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

CREATE POLICY "Public read for demo appointments"
  ON public.appointments FOR SELECT
  USING (
    auth.uid() IS NULL 
    AND business_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- 5. Drop and recreate services policies
DROP POLICY IF EXISTS "Users can access services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;
DROP POLICY IF EXISTS "Public read for demo services" ON public.services;

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

CREATE POLICY "Public read for demo services"
  ON public.services FOR SELECT
  USING (
    auth.uid() IS NULL 
    AND business_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

-- 6. Verify policies were created
SELECT 
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'READ'
    WHEN cmd = 'ALL' THEN 'READ/WRITE'
    ELSE cmd
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('pets', 'clients', 'appointments', 'services')
ORDER BY tablename, cmd, policyname;
