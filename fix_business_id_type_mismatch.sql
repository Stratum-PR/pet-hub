-- ============================================
-- FIX BUSINESS_ID TYPE MISMATCH
-- This fixes RLS policies and ensures type compatibility
-- ============================================

-- 1. Check current types
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'business_id'
  AND table_name IN ('profiles', 'customers', 'pets', 'services', 'appointments', 'employees')
ORDER BY table_name;

-- 2. Fix services RLS policies to handle type casting
DROP POLICY IF EXISTS "Users can access services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;

-- Recreate with type casting
CREATE POLICY "Users can access services from their business"
  ON public.services FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage services from their business"
  ON public.services FOR ALL
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 3. Fix other tables' RLS policies if needed (they should already be correct, but let's ensure)
-- Customers
DROP POLICY IF EXISTS "Users can access customers from their business" ON public.customers;
DROP POLICY IF EXISTS "Users can manage customers from their business" ON public.customers;

CREATE POLICY "Users can access customers from their business"
  ON public.customers FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage customers from their business"
  ON public.customers FOR ALL
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Pets
DROP POLICY IF EXISTS "Users can access pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;

CREATE POLICY "Users can access pets from their business"
  ON public.pets FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage pets from their business"
  ON public.pets FOR ALL
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Appointments
DROP POLICY IF EXISTS "Users can access appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;

CREATE POLICY "Users can access appointments from their business"
  ON public.appointments FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage appointments from their business"
  ON public.appointments FOR ALL
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Employees
DROP POLICY IF EXISTS "Users can access employees from their business" ON public.employees;
DROP POLICY IF EXISTS "Users can manage employees from their business" ON public.employees;

CREATE POLICY "Users can access employees from their business"
  ON public.employees FOR SELECT
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage employees from their business"
  ON public.employees FOR ALL
  USING (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id::text IN (
      SELECT business_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
