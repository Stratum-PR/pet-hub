-- ============================================
-- RLS Auth InitPlan fix (Supabase Performance Advisor)
-- ============================================
-- Replace auth.uid() with (SELECT auth.uid()) in all RLS policies so the
-- value is evaluated once per query instead of per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================

-- Helper: use (SELECT auth.uid()) in policy expressions below.

-- ---------- PROFILES ----------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Super admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- BUSINESSES ----------
DROP POLICY IF EXISTS "Users can read their own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own business" ON public.businesses;
DROP POLICY IF EXISTS "Super admins can access all businesses" ON public.businesses;

CREATE POLICY "Users can read their own business"
  ON public.businesses FOR SELECT
  USING (
    id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can update their own business"
  ON public.businesses FOR UPDATE
  USING (
    id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "Super admins can access all businesses"
  ON public.businesses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- ADMIN_IMPERSONATION_TOKENS ----------
DROP POLICY IF EXISTS "Super admins can manage impersonation tokens" ON public.admin_impersonation_tokens;

CREATE POLICY "Super admins can manage impersonation tokens"
  ON public.admin_impersonation_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- CUSTOMERS ----------
DROP POLICY IF EXISTS "Users can access customers from their business" ON public.customers;
DROP POLICY IF EXISTS "Users can manage customers from their business" ON public.customers;

CREATE POLICY "Users can access customers from their business"
  ON public.customers FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage customers from their business"
  ON public.customers FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- CLIENTS (if table exists; may have "Clients can view own record" from Dashboard) ----------
DROP POLICY IF EXISTS "Clients can view own record" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients in their business" ON public.clients;

CREATE POLICY "Users can view clients in their business"
  ON public.clients FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- PETS ----------
DROP POLICY IF EXISTS "Users can access pets from their business" ON public.pets;
DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;

CREATE POLICY "Users can access pets from their business"
  ON public.pets FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage pets from their business"
  ON public.pets FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- SERVICES ----------
DROP POLICY IF EXISTS "Users can access services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;

CREATE POLICY "Users can access services from their business"
  ON public.services FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage services from their business"
  ON public.services FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- APPOINTMENTS ----------
DROP POLICY IF EXISTS "Users can access appointments from their business" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;

CREATE POLICY "Users can access appointments from their business"
  ON public.appointments FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage appointments from their business"
  ON public.appointments FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- EMPLOYEES ----------
DROP POLICY IF EXISTS "Users can access employees from their business" ON public.employees;
DROP POLICY IF EXISTS "Users can manage employees from their business" ON public.employees;

CREATE POLICY "Users can access employees from their business"
  ON public.employees FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage employees from their business"
  ON public.employees FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- TIME_ENTRIES ----------
DROP POLICY IF EXISTS "Users can access time_entries from their business" ON public.time_entries;
DROP POLICY IF EXISTS "Users can manage time_entries from their business" ON public.time_entries;

CREATE POLICY "Users can access time_entries from their business"
  ON public.time_entries FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage time_entries from their business"
  ON public.time_entries FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- SETTINGS ----------
DROP POLICY IF EXISTS "Users can read settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can update settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can insert settings for their business" ON public.settings;

CREATE POLICY "Users can read settings from their business"
  ON public.settings FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can update settings from their business"
  ON public.settings FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can insert settings for their business"
  ON public.settings FOR INSERT
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- INVENTORY ----------
DROP POLICY IF EXISTS "Users can access inventory from their business" ON public.inventory;
DROP POLICY IF EXISTS "Users can manage inventory from their business" ON public.inventory;

CREATE POLICY "Users can access inventory from their business"
  ON public.inventory FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "Users can manage inventory from their business"
  ON public.inventory FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ---------- SUBSCRIPTIONS ----------
DROP POLICY IF EXISTS "Users can read subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert subscriptions for their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admins can access all subscriptions" ON public.subscriptions;

CREATE POLICY "Users can read subscriptions from their business"
  ON public.subscriptions FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can insert subscriptions for their business"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Users can update subscriptions from their business"
  ON public.subscriptions FOR UPDATE
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

CREATE POLICY "Users can delete subscriptions from their business"
  ON public.subscriptions FOR DELETE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins can access all subscriptions"
  ON public.subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_super_admin = true
    )
  );

-- ---------- EMPLOYEE_INVITATIONS ----------
DROP POLICY IF EXISTS "Managers and super admins can update employee invitations" ON public.employee_invitations;

CREATE POLICY "Managers and super admins can update employee invitations"
  ON public.employee_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND (
        p.is_super_admin = true
        OR (p.business_id = employee_invitations.business_id AND p.role IN ('manager', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND (
        p.is_super_admin = true
        OR (p.business_id = employee_invitations.business_id AND p.role IN ('manager', 'super_admin'))
      )
    )
  );
