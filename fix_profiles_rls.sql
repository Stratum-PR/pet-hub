-- ============================================
-- FIX PROFILES RLS POLICY
-- Users MUST be able to read their own profile
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.profiles;

-- Create policies that allow users to read/update their own profile
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Super admins can read all profiles
CREATE POLICY "Super admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );
