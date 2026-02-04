-- ============================================
-- Fix manager profile: set business_id so RLS allows inserts
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor after replacing the placeholders.
-- Get the manager's user ID from auth.users or profiles (id = auth user id).
-- Get the business UUID from the businesses table (id).

-- 1. Optional: Find the manager and business (run as reference, then use the IDs below)
-- SELECT id, email, full_name, role, business_id FROM public.profiles WHERE full_name ILIKE '%Jovaniel%' OR email ILIKE '%jovaniel%';
-- SELECT id, name, slug FROM public.businesses LIMIT 20;

-- 2. Set profile.business_id for the manager (replace the UUIDs)
-- Replace <MANAGER_USER_UUID> with the profile.id (same as auth.users.id) of the manager.
-- Replace <BUSINESS_UUID> with the businesses.id they should manage.
UPDATE public.profiles
SET business_id = '<BUSINESS_UUID>'::uuid,
    role = 'manager',
    updated_at = now()
WHERE id = '<MANAGER_USER_UUID>'::uuid;

-- 3. Verify (run after the UPDATE)
-- SELECT id, email, full_name, role, business_id FROM public.profiles WHERE id = '<MANAGER_USER_UUID>'::uuid;
