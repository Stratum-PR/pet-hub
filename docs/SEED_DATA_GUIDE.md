# Seed Data Guide

This guide explains how to populate your Supabase database with sample data for the Demo and Pet Esthetic businesses.

## Prerequisites

1. Make sure you've run the main migration: `supabase/migrations/20250120000000_create_multi_tenant_schema.sql`
2. Make sure you have created the following users in Supabase Auth:
   - `demo@pawsomegrooming.com` (password: `DemoPassword123!`)
   - `g.rodriguez@stratumpr.com` (your password)
   - `tech@stratumpr.com` (your password, for super admin)

## Step 1: Link Users to Businesses

First, link the users to their businesses. Run this in Supabase SQL Editor:

```sql
-- Link demo user to demo business
UPDATE public.profiles 
SET business_id = '00000000-0000-0000-0000-000000000001' 
WHERE email = 'demo@pawsomegrooming.com';

-- Link g.rodriguez to Pet Esthetic business
UPDATE public.profiles 
SET business_id = '00000000-0000-0000-0000-000000000002' 
WHERE email = 'g.rodriguez@stratumpr.com';

-- Make tech@stratumpr.com a super admin
UPDATE public.profiles 
SET is_super_admin = true 
WHERE email = 'tech@stratumpr.com';
```

## Step 2: Seed Demo Business Data

Run the entire contents of `supabase/seed_demo_data.sql` in Supabase SQL Editor.

This will:
- Update the demo business name to "Demo"
- Create 5 services (in Spanish)
- Create 4 customers (Puerto Rican names)
- Create 5 pets
- Create 3 appointments (today and tomorrow)
- Create 2 employees

## Step 3: Seed Pet Esthetic Business Data

Run the entire contents of `supabase/seed_pet_esthetic.sql` in Supabase SQL Editor.

This will:
- Create/update the Pet Esthetic business
- Create 7 services
- Create 7 customers (Puerto Rican names)
- Create 7 pets
- Create 5 appointments
- Create employees

## Step 4: Verify Data

After running the seed scripts, verify the data:

```sql
-- Check demo business data
SELECT COUNT(*) as customers FROM customers WHERE business_id = '00000000-0000-0000-0000-000000000001';
SELECT COUNT(*) as pets FROM pets WHERE business_id = '00000000-0000-0000-0000-000000000001';
SELECT COUNT(*) as services FROM services WHERE business_id = '00000000-0000-0000-0000-000000000001';
SELECT COUNT(*) as appointments FROM appointments WHERE business_id = '00000000-0000-0000-0000-000000000001';

-- Check Pet Esthetic business data
SELECT COUNT(*) as customers FROM customers WHERE business_id = '00000000-0000-0000-0000-000000000002';
SELECT COUNT(*) as pets FROM pets WHERE business_id = '00000000-0000-0000-0000-000000000002';
SELECT COUNT(*) as services FROM services WHERE business_id = '00000000-0000-0000-0000-000000000002';
SELECT COUNT(*) as appointments FROM appointments WHERE business_id = '00000000-0000-0000-0000-000000000002';
```

## Troubleshooting

### If you get "relation does not exist" errors:
- Make sure you've run the main migration first
- Check that all tables exist: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`

### If data doesn't show up after seeding:
- Check that the `business_id` in the seed scripts matches the business IDs in your database
- Verify that RLS policies allow reading the data
- Check browser console for any errors

### If settings don't save:
- The settings table might need a `business_id` column. Run this migration:
```sql
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Update existing settings to have business_id (if any exist)
-- You may need to manually assign them or delete and recreate
```
