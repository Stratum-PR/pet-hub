-- Fix: Function Search Path Mutable (Supabase security linter)
-- public.set_transaction_number had no fixed search_path, which is a security/reliability risk.
-- This migration sets search_path so the function always resolves names in public, pg_catalog
-- regardless of the caller's search_path.
--
-- If this migration fails with "function does not exist" or "ambiguous", get the exact
-- signature in Supabase SQL Editor:
--   SELECT pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public' AND p.proname = 'set_transaction_number';
-- Then replace the empty parentheses below with (args) e.g. (p_business_id uuid).

ALTER FUNCTION public.set_transaction_number()
  SET search_path = public, pg_catalog;
