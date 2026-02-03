-- ============================================
-- Remaining Supabase Performance/Security lints (CSV 4)
-- ============================================
-- 1. auth_rls_initplan: Fix policies that still use auth.uid() directly
--    (production/Dashboard policy names: Managers can create business, Owner can update business,
--     System can insert profiles, Users can view/update own profile, Public read for demo X,
--     Users can access/manage clients, Clients can view own appointments, guest_bookings)
-- 2. Replace auth.uid() with (SELECT auth.uid()) and auth.uid() IS NULL with (SELECT auth.uid()) IS NULL
-- 3. Consolidate multiple permissive policies on appointments (one per role+action where possible)
-- ============================================

-- ---------- BUSINESSES ----------
-- Drop Dashboard/production-named policies; our 20260203190000 already has (SELECT auth.uid()) versions.
-- Recreate "Managers can create business" for INSERT with (SELECT auth.uid()) if it was dropped.
DROP POLICY IF EXISTS "Managers can create business" ON public.businesses;
DROP POLICY IF EXISTS "Owner can update business" ON public.businesses;

CREATE POLICY "Managers can create business"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ---------- PROFILES ----------
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

-- "Users can view own profile" / "Users can update own profile" are dropped above.
-- Equivalent policies with (SELECT auth.uid()) already exist from 20260203190000:
-- "Users can read their own profile" (SELECT), "Users can update their own profile" (UPDATE).

-- ---------- CLIENTS ----------
DROP POLICY IF EXISTS "Public read for demo clients" ON public.clients;
DROP POLICY IF EXISTS "Users can access clients from their business" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients from their business" ON public.clients;

CREATE POLICY "Public read for demo clients"
  ON public.clients FOR SELECT
  USING (
    (SELECT auth.uid()) IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- SELECT: keep "Users can view clients in their business" from 20260203190000 (do not recreate "Users can access")

CREATE POLICY "Users can manage clients from their business"
  ON public.clients FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- DEMO POLICIES: (SELECT auth.uid()) IS NULL ----------
-- Pets
DROP POLICY IF EXISTS "Public read for demo pets" ON public.pets;
CREATE POLICY "Public read for demo pets"
  ON public.pets FOR SELECT
  USING (
    (SELECT auth.uid()) IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Services
DROP POLICY IF EXISTS "Public read for demo services" ON public.services;
CREATE POLICY "Public read for demo services"
  ON public.services FOR SELECT
  USING (
    (SELECT auth.uid()) IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Employees
DROP POLICY IF EXISTS "Public read for demo employees" ON public.employees;
CREATE POLICY "Public read for demo employees"
  ON public.employees FOR SELECT
  USING (
    (SELECT auth.uid()) IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Inventory
DROP POLICY IF EXISTS "Public read for demo inventory" ON public.inventory;
CREATE POLICY "Public read for demo inventory"
  ON public.inventory FOR SELECT
  USING (
    (SELECT auth.uid()) IS NULL
    AND (
      business_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR business_id::text = '00000000-0000-0000-0000-000000000001'
    )
  );

-- ---------- APPOINTMENTS: Fix auth + consolidate multiple permissive policies ----------
-- Drop all existing appointment policies so we can create consolidated ones
DROP POLICY IF EXISTS "Public read for demo appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business staff can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can access appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Managers can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;

-- Single SELECT: demo (anon) OR business access OR super_admin
CREATE POLICY "Appointments select"
  ON public.appointments FOR SELECT
  USING (
    (
      (SELECT auth.uid()) IS NULL
      AND (
        business_id = '00000000-0000-0000-0000-000000000001'::uuid
        OR business_id::text = '00000000-0000-0000-0000-000000000001'
      )
    )
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- Single INSERT: business staff (same as manage)
CREATE POLICY "Appointments insert"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- Single UPDATE: business staff
CREATE POLICY "Appointments update"
  ON public.appointments FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- Single DELETE: business staff
CREATE POLICY "Appointments delete"
  ON public.appointments FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- GUEST_BOOKINGS ----------
DROP POLICY IF EXISTS "Users can create guest bookings for their business" ON public.guest_bookings;

CREATE POLICY "Users can create guest bookings for their business"
  ON public.guest_bookings FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- BREEDS (if table exists): consolidate SELECT policies + fix auth ----------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'breeds'
  ) THEN
    DROP POLICY IF EXISTS "Public read for demo breeds" ON public.breeds;
    DROP POLICY IF EXISTS "Users can access breeds" ON public.breeds;
    CREATE POLICY "Breeds select"
      ON public.breeds FOR SELECT
      USING (true);
  END IF;
END;
$$;
