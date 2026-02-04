-- ============================================
-- Align pets and services RLS with clients/inventory
-- ============================================
-- Add is_super_admin to USING and WITH CHECK so super admins can insert
-- into any business (same pattern as 20260203120000_ensure_insert_policies).

-- 1. Pets: drop and recreate manage policy with is_super_admin
DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;
CREATE POLICY "Users can manage pets from their business"
  ON public.pets
  FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- 2. Services: drop and recreate manage policy with is_super_admin
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;
CREATE POLICY "Users can manage services from their business"
  ON public.services
  FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );
