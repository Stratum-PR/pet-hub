-- Demo tenant: allow SELECT on fixed demo business rows for both anonymous and authenticated sessions.
-- Previous policies used auth.uid() IS NULL only, so logged-in users on /demo saw empty data.
-- Adds public.clients (app table); older migration targeted public.customers only.

BEGIN;

-- clients
DROP POLICY IF EXISTS "Demo workspace read clients" ON public.clients;
CREATE POLICY "Demo workspace read clients"
  ON public.clients
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

-- pets: replace anon-only policy name with unified read
DROP POLICY IF EXISTS "Public read for demo pets" ON public.pets;
DROP POLICY IF EXISTS "Demo workspace read pets" ON public.pets;
CREATE POLICY "Demo workspace read pets"
  ON public.pets
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Public read for demo appointments" ON public.appointments;
DROP POLICY IF EXISTS "Demo workspace read appointments" ON public.appointments;
CREATE POLICY "Demo workspace read appointments"
  ON public.appointments
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Public read for demo employees" ON public.employees;
DROP POLICY IF EXISTS "Demo workspace read employees" ON public.employees;
CREATE POLICY "Demo workspace read employees"
  ON public.employees
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Public read for demo services" ON public.services;
DROP POLICY IF EXISTS "Demo workspace read services" ON public.services;
CREATE POLICY "Demo workspace read services"
  ON public.services
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Public read for demo inventory" ON public.inventory;
DROP POLICY IF EXISTS "Demo workspace read inventory" ON public.inventory;
CREATE POLICY "Demo workspace read inventory"
  ON public.inventory
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Public read for demo customers" ON public.customers;
DROP POLICY IF EXISTS "Demo workspace read customers" ON public.customers;
CREATE POLICY "Demo workspace read customers"
  ON public.customers
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

COMMIT;
