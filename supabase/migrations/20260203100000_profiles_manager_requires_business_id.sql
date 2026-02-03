-- ============================================
-- Optional hardening: manager role must have business_id
-- ============================================
-- Ensures every profile with role = 'manager' has a non-null business_id.
-- Safe for existing data: fix any inconsistent rows before adding the constraint.

-- 1. Fix any profile that is manager but has no business_id (should not exist if signup flow is correct)
UPDATE public.profiles
SET role = 'client'
WHERE role = 'manager' AND business_id IS NULL;

-- 2. Add check constraint: managers must have business_id
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_manager_has_business_id;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_manager_has_business_id
  CHECK (role IS DISTINCT FROM 'manager' OR business_id IS NOT NULL);
