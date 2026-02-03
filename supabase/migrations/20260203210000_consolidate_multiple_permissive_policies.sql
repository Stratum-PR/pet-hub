-- ============================================
-- Consolidate multiple permissive RLS policies (Supabase CSV 5)
-- ============================================
-- One policy per (table, action) so the linter no longer reports
-- "Multiple Permissive Policies" for the same role and action.
-- ============================================

-- ---------- BUSINESSES ----------
DROP POLICY IF EXISTS "Anyone can view public businesses" ON public.businesses;
DROP POLICY IF EXISTS "Super admins can access all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Super admins can view all businesses" ON public.businesses;
DROP POLICY IF EXISTS "Super admins can update any business" ON public.businesses;
DROP POLICY IF EXISTS "Super admins can delete businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can read their own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own business" ON public.businesses;
DROP POLICY IF EXISTS "Managers can create business" ON public.businesses;

CREATE POLICY "Businesses select"
  ON public.businesses FOR SELECT
  USING (
    id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Businesses insert"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Businesses update"
  ON public.businesses FOR UPDATE
  USING (
    id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Businesses delete"
  ON public.businesses FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true));

-- ---------- CLIENTS ----------
DROP POLICY IF EXISTS "Public read for demo clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients in their business" ON public.clients;
DROP POLICY IF EXISTS "Users can manage clients from their business" ON public.clients;
DROP POLICY IF EXISTS "Business staff can view clients" ON public.clients;
DROP POLICY IF EXISTS "Managers can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can update clients" ON public.clients;

CREATE POLICY "Clients select"
  ON public.clients FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid OR business_id::text = '00000000-0000-0000-0000-000000000001'))
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Clients insert"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Clients update"
  ON public.clients FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Clients delete"
  ON public.clients FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- CUSTOMERS ----------
DROP POLICY IF EXISTS "Users can access customers from their business" ON public.customers;
DROP POLICY IF EXISTS "Users can manage customers from their business" ON public.customers;

CREATE POLICY "Customers all"
  ON public.customers FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- EMPLOYEE_INVITATIONS ----------
DROP POLICY IF EXISTS "Managers can view invitations" ON public.employee_invitations;
DROP POLICY IF EXISTS "View invitation by token" ON public.employee_invitations;

CREATE POLICY "Employee invitations select"
  ON public.employee_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND (p.is_super_admin = true OR (p.business_id = employee_invitations.business_id AND p.role IN ('manager', 'super_admin')))
    )
  );

-- ---------- EMPLOYEES ----------
DROP POLICY IF EXISTS "Public read for demo employees" ON public.employees;
DROP POLICY IF EXISTS "Users can access employees from their business" ON public.employees;
DROP POLICY IF EXISTS "Users can manage employees from their business" ON public.employees;
DROP POLICY IF EXISTS "Business members can view employees" ON public.employees;
DROP POLICY IF EXISTS "Managers can delete employees" ON public.employees;
DROP POLICY IF EXISTS "Super admins full access employees" ON public.employees;
DROP POLICY IF EXISTS "Staff can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Staff can update employees" ON public.employees;

CREATE POLICY "Employees select"
  ON public.employees FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid OR business_id::text = '00000000-0000-0000-0000-000000000001'))
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Employees insert"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Employees update"
  ON public.employees FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Employees delete"
  ON public.employees FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- INVENTORY ----------
DROP POLICY IF EXISTS "Public read for demo inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can access inventory from their business" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage inventory from their business" ON public.inventory;
DROP POLICY IF EXISTS "Business members can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Managers can delete inventory" ON public.inventory;
DROP POLICY IF EXISTS "Super admins full access inventory" ON public.inventory;
DROP POLICY IF EXISTS "Staff can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Staff can update inventory" ON public.inventory;

CREATE POLICY "Inventory select"
  ON public.inventory FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid OR business_id::text = '00000000-0000-0000-0000-000000000001'))
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Inventory insert"
  ON public.inventory FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Inventory update"
  ON public.inventory FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Inventory delete"
  ON public.inventory FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- PETS ----------
DROP POLICY IF EXISTS "Public read for demo pets" ON public.pets;
DROP POLICY IF EXISTS "Users can access pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Business members can view pets" ON public.pets;
DROP POLICY IF EXISTS "Managers can delete pets" ON public.pets;
DROP POLICY IF EXISTS "Super admins full access pets" ON public.pets;
DROP POLICY IF EXISTS "Staff can insert pets" ON public.pets;
DROP POLICY IF EXISTS "Staff can update pets" ON public.pets;

CREATE POLICY "Pets select"
  ON public.pets FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid OR business_id::text = '00000000-0000-0000-0000-000000000001'))
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Pets insert"
  ON public.pets FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Pets update"
  ON public.pets FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Pets delete"
  ON public.pets FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- PROFILES ----------
DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Business members can view colleagues" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_super_admin" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles select"
  ON public.profiles FOR SELECT
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Profiles update"
  ON public.profiles FOR UPDATE
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- Keep System can insert profiles if it exists (for handle_new_user trigger)
-- Don't drop it; if it was dropped earlier, 20260203200000 recreated it.

-- ---------- SERVICES ----------
DROP POLICY IF EXISTS "Public read for demo services" ON public.services;
DROP POLICY IF EXISTS "Users can access services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;
DROP POLICY IF EXISTS "Business members can view services" ON public.services;
DROP POLICY IF EXISTS "Managers can delete services" ON public.services;
DROP POLICY IF EXISTS "Super admins full access services" ON public.services;
DROP POLICY IF EXISTS "Staff can insert services" ON public.services;
DROP POLICY IF EXISTS "Staff can update services" ON public.services;

CREATE POLICY "Services select"
  ON public.services FOR SELECT
  USING (
    ((SELECT auth.uid()) IS NULL AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid OR business_id::text = '00000000-0000-0000-0000-000000000001'))
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Services insert"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Services update"
  ON public.services FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Services delete"
  ON public.services FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- SUBSCRIPTIONS ----------
DROP POLICY IF EXISTS "Super admins can access all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can read subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert subscriptions for their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete subscriptions from their business" ON public.subscriptions;

CREATE POLICY "Subscriptions select"
  ON public.subscriptions FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Subscriptions insert"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Subscriptions update"
  ON public.subscriptions FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Subscriptions delete"
  ON public.subscriptions FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

-- ---------- TIME_ENTRIES ----------
DROP POLICY IF EXISTS "Users can access time_entries from their business" ON public.time_entries;
DROP POLICY IF EXISTS "Users can manage time_entries from their business" ON public.time_entries;
DROP POLICY IF EXISTS "Business members can view time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Managers can delete time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Super admins full access time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Staff can insert time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Staff can update time_entries" ON public.time_entries;

CREATE POLICY "Time entries select"
  ON public.time_entries FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Time entries insert"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Time entries update"
  ON public.time_entries FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );

CREATE POLICY "Time entries delete"
  ON public.time_entries FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_super_admin = true)
  );
