-- ============================================
-- EMERGENCY FIX: PROFILES RLS POLICY
-- This MUST be run first - users need to read their own profile
-- ============================================

-- Disable RLS temporarily to fix policies (only if needed)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read/update their own profile" ON public.profiles;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create the most permissive policy for users to read their own profile
-- This is critical - without this, nothing works
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Super admins can read all profiles (but this requires reading profiles, so it might fail)
-- We'll create it but it may not work until the first policy works
CREATE POLICY "Super admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );
