-- Ensure RLS on clients table with business-scoped policies (idempotent).
-- The app uses the "clients" table; this migration aligns it with other business-scoped tables.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;
    DROP POLICY IF EXISTS "Users can manage clients in their business" ON public.clients;
    DROP POLICY IF EXISTS "Users can access clients from their business" ON public.clients;

    CREATE POLICY "Users can access clients from their business"
      ON public.clients FOR SELECT
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );

    CREATE POLICY "Users can manage clients from their business"
      ON public.clients FOR ALL
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      )
      WITH CHECK (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );
  END IF;
END $$;
