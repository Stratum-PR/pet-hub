-- Fix infinite recursion in profiles RLS: policies must not SELECT from profiles
-- when evaluating access to profiles. Use a SECURITY DEFINER helper that runs
-- as the function owner (bypasses RLS) to answer "is current user super admin?".

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Replace profiles SELECT/UPDATE policies so they do not query profiles again
DROP POLICY IF EXISTS "Profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;

CREATE POLICY "Profiles select"
  ON public.profiles FOR SELECT
  USING (
    (SELECT auth.uid()) = id
    OR public.is_super_admin()
  );

CREATE POLICY "Profiles update"
  ON public.profiles FOR UPDATE
  USING (
    (SELECT auth.uid()) = id
    OR public.is_super_admin()
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR public.is_super_admin()
  );
