-- ============================================
-- USER SETUP SCRIPT
-- ============================================
-- Run this AFTER creating users in Supabase Auth
-- This script links users to the demo business and sets up admin access

-- ============================================
-- STEP 1: LINK YOUR ADMIN ACCOUNT TO DEMO BUSINESS
-- ============================================
-- Replace 'admin@stratumpr.com' with your actual email
UPDATE public.profiles 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE email = 'admin@stratumpr.com';

-- Make yourself super admin
UPDATE public.profiles 
SET is_super_admin = true 
WHERE email = 'admin@stratumpr.com';

-- ============================================
-- STEP 2: SET UP DEMO ACCOUNT
-- ============================================
-- Link demo account to demo business (if demo user exists)
UPDATE public.profiles 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE email = 'demo@pawsomegrooming.com';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify setup:

-- Check your profile
SELECT id, email, is_super_admin, business_id 
FROM public.profiles 
WHERE email = 'admin@stratumpr.com';

-- Check demo business exists
SELECT id, name, email, subscription_tier, subscription_status 
FROM public.businesses 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Check all profiles linked to demo business
SELECT p.email, p.is_super_admin, b.name as business_name
FROM public.profiles p
LEFT JOIN public.businesses b ON p.business_id = b.id
WHERE p.business_id = '00000000-0000-0000-0000-000000000001';
