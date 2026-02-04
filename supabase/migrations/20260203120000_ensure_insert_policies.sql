-- ============================================
-- Ensure INSERT/UPDATE/DELETE allowed for business-scoped tables
-- ============================================
-- When profile.business_id is set (or resolved from slug), inserts must succeed.
-- This adds explicit INSERT/UPDATE/DELETE policies where missing (e.g. clients
-- may only have had SELECT from fix_production_schema_mismatch).

-- Helper: same check used for USING and WITH CHECK
-- business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
-- OR super_admin

-- 1. Clients: ensure manage policy exists (INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Users can manage clients in their business" ON public.clients;
CREATE POLICY "Users can manage clients in their business"
  ON public.clients
  FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- 2. Inventory: add WITH CHECK so INSERT is explicitly allowed
DROP POLICY IF EXISTS "Users can manage inventory from their business" ON public.inventory;
CREATE POLICY "Users can manage inventory from their business"
  ON public.inventory
  FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- 3. Breeds: global reference table - allow SELECT to all, INSERT/UPDATE/DELETE to authenticated (or restrict to super_admin if preferred)
-- Only add if breeds has RLS and we want app to be able to insert breeds
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'breeds') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'breeds') THEN
      ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow read breeds"
        ON public.breeds FOR SELECT USING (true);
      CREATE POLICY "Allow insert update delete breeds for authenticated"
        ON public.breeds FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;
