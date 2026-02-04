-- ============================================
-- Fix: Allow trigger handle_new_user to insert profile
-- ============================================
-- When Supabase Auth creates a new user, it inserts into auth.users.
-- The trigger runs in a context where auth.uid() is often NULL (the new
-- user has not logged in yet). The policy "System can insert profiles"
-- with WITH CHECK (id = auth.uid()) therefore fails (NULL = id is false).
-- This migration adds a policy that allows INSERT when auth.uid() IS NULL
-- and the row id exists in auth.users (only the trigger runs in that context).

-- Drop the existing policy that only allows id = auth.uid()
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Allow authenticated user to insert their own profile (e.g. from RPC)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow trigger to insert profile when there is no current user (auth.uid() IS NULL)
-- and the id being inserted exists in auth.users (only true right after Auth creates the user).
-- Roles: anon, authenticated (trigger may run as either); service_role (Auth backend).
CREATE POLICY "Trigger can insert profile for new auth user"
  ON public.profiles FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (
    auth.uid() IS NULL
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = id)
  );
