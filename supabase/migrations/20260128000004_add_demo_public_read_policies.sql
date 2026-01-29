BEGIN;

-- Add public read-only policies for demo business data
-- This allows anonymous users to view demo data when accessing /demo routes
-- Note: These policies work alongside existing policies (PostgreSQL RLS uses OR logic)
-- Demo business ID: 00000000-0000-0000-0000-000000000001

-- Drop existing demo policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Public read for demo customers" ON public.customers;
DROP POLICY IF EXISTS "Public read for demo pets" ON public.pets;
DROP POLICY IF EXISTS "Public read for demo appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public read for demo employees" ON public.employees;
DROP POLICY IF EXISTS "Public read for demo services" ON public.services;
DROP POLICY IF EXISTS "Public read for demo inventory" ON public.inventory;

-- Customers: Allow anonymous read for demo business
-- Handle both UUID and TEXT business_id types
CREATE POLICY "Public read for demo customers"
  ON public.customers
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Pets: Allow anonymous read for demo business
CREATE POLICY "Public read for demo pets"
  ON public.pets
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Appointments: Allow anonymous read for demo business
CREATE POLICY "Public read for demo appointments"
  ON public.appointments
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Employees: Allow anonymous read for demo business
CREATE POLICY "Public read for demo employees"
  ON public.employees
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Services: Allow anonymous read for demo business
-- Services might have TEXT business_id, so handle both
CREATE POLICY "Public read for demo services"
  ON public.services
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Inventory: Allow anonymous read for demo business
CREATE POLICY "Public read for demo inventory"
  ON public.inventory
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

COMMIT;
