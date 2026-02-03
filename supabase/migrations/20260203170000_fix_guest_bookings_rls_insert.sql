-- ============================================
-- Fix guest_bookings RLS: remove permissive INSERT policy
-- ============================================
-- Lint: "RLS Policy Always True" on public.guest_bookings
-- The policy "Anyone can create guest booking" used WITH CHECK (true),
-- allowing unrestricted inserts. Replace with business-scoped INSERT.
-- ============================================

-- Only run if the table exists (it may have been created via Dashboard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'guest_bookings'
  ) THEN
    -- Remove the permissive policy
    DROP POLICY IF EXISTS "Anyone can create guest booking" ON public.guest_bookings;

    -- Ensure RLS is enabled
    ALTER TABLE public.guest_bookings ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;

-- Add restrictive INSERT policy only if table has business_id (multi-tenant pattern)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guest_bookings' AND column_name = 'business_id'
  ) THEN
    -- Authenticated users: can insert only for a business they belong to (or super_admin)
    DROP POLICY IF EXISTS "Users can create guest bookings for their business" ON public.guest_bookings;
    CREATE POLICY "Users can create guest bookings for their business"
      ON public.guest_bookings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        business_id IN (
          SELECT business_id FROM public.profiles WHERE id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = (SELECT auth.uid()) AND is_super_admin = true
        )
      );
  END IF;
  -- If table has no business_id, no new policy is added here. Add one manually to match your
  -- schema (e.g. WITH CHECK (user_id = auth.uid())) and ensure anon is not allowed unless intended.
END;
$$;
