-- ============================================
-- One-time backfill: profile.role for existing accounts
-- ============================================
-- Run once to align role with current data.
-- super_admin if is_super_admin; manager if business_id set; else client.
-- Note: Profiles with business_id are set to 'manager'; if some are actually
-- employees, fix manually or via employees table.

UPDATE public.profiles
SET role = CASE
  WHEN is_super_admin = true THEN 'super_admin'
  WHEN business_id IS NOT NULL THEN 'manager'
  ELSE 'client'
END
WHERE role IS NULL
   OR role NOT IN ('super_admin', 'manager', 'employee', 'client');
