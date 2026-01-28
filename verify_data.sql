-- ============================================
-- VERIFICATION SCRIPT
-- Run this to check if data exists and users are linked
-- ============================================

-- 1. Check if businesses exist
SELECT 'BUSINESSES' as check_type, id, name, email, subscription_tier 
FROM public.businesses 
ORDER BY created_at;

-- 2. Check if profiles are linked to businesses
SELECT 'PROFILES' as check_type, 
       p.id, 
       p.email, 
       p.business_id, 
       p.is_super_admin,
       b.name as business_name
FROM public.profiles p
LEFT JOIN public.businesses b ON p.business_id = b.id
ORDER BY p.email;

-- 3. Check demo business data counts
SELECT 'DEMO DATA' as check_type,
       (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as customers,
       (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as pets,
       (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as services,
       (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as appointments,
       (SELECT COUNT(*) FROM public.employees WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text) as employees;

-- 4. Check Pet Esthetic business data counts
SELECT 'PET ESTHETIC DATA' as check_type,
       (SELECT COUNT(*) FROM public.customers WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as customers,
       (SELECT COUNT(*) FROM public.pets WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as pets,
       (SELECT COUNT(*) FROM public.services WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as services,
       (SELECT COUNT(*) FROM public.appointments WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as appointments,
       (SELECT COUNT(*) FROM public.employees WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text) as employees;

-- 5. Sample data from demo business
SELECT 'DEMO SAMPLE CUSTOMERS' as check_type, first_name, last_name, email, phone
FROM public.customers 
WHERE business_id::text = '00000000-0000-0000-0000-000000000001'::text
LIMIT 5;

-- 6. Sample data from Pet Esthetic business
SELECT 'PET ESTHETIC SAMPLE CUSTOMERS' as check_type, first_name, last_name, email, phone
FROM public.customers 
WHERE business_id::text = '00000000-0000-0000-0000-000000000002'::text
LIMIT 5;
