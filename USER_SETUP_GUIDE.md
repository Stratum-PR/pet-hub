# User Setup Guide

## Problem: Can't Log In

You need to create users in Supabase Auth first, then link them to the demo business.

## Step-by-Step Setup

### Step 1: Create Users in Supabase Auth

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Users**
4. Click **"Add user"** or **"Create new user"**

#### Create Your Admin Account:
- **Email**: `admin@stratumpr.com`
- **Password**: (choose a secure password)
- **Auto Confirm User**: ✅ Check this box (so you don't need email confirmation)
- Click **"Create user"**

#### Create Demo Account (optional):
- **Email**: `demo@pawsomegrooming.com`
- **Password**: `DemoPassword123!`
- **Auto Confirm User**: ✅ Check this box
- Click **"Create user"**

### Step 2: Run the Setup SQL Script

1. Go to **SQL Editor** in Supabase Dashboard
2. Open the file `supabase/setup_users.sql`
3. Copy and paste it into SQL Editor
4. **IMPORTANT**: Make sure the email in the script matches your actual email (`admin@stratumpr.com`)
5. Click **"Run"**

This script will:
- Link your admin account to the demo business
- Make you a super admin
- Link the demo account to the demo business

### Step 3: Verify Setup

Run these queries in SQL Editor to verify:

```sql
-- Check your profile
SELECT id, email, is_super_admin, business_id 
FROM public.profiles 
WHERE email = 'admin@stratumpr.com';

-- Should show:
-- is_super_admin: true
-- business_id: 00000000-0000-0000-0000-000000000001
```

### Step 4: Test Login

1. Go to `http://localhost:8080/login`
2. Enter your credentials:
   - **Email**: `admin@stratumpr.com`
   - **Password**: (the password you set in Step 1)
3. Click **"Sign In"**

You should be redirected to `/admin` (since you're a super admin).

## Troubleshooting

### "Invalid login credentials"
- Make sure the user exists in Supabase Auth (Step 1)
- Check that the email/password are correct
- Verify the user is "Confirmed" in Supabase Auth

### "Profile not found" or blank screen
- Make sure you ran the SQL migration first
- Verify the profile was created (check with the verification query)
- The trigger should auto-create profiles, but you can manually create:

```sql
-- If profile doesn't exist, get the user ID from auth.users first:
SELECT id, email FROM auth.users WHERE email = 'admin@stratumpr.com';

-- Then create profile (replace USER_ID_HERE with actual ID):
INSERT INTO public.profiles (id, email, is_super_admin, business_id)
VALUES (
  'USER_ID_HERE',
  'admin@stratumpr.com',
  true,
  '00000000-0000-0000-0000-000000000001'
);
```

### Can't access business dashboard
- Make sure `business_id` is set in your profile
- Run the setup_users.sql script again

## Quick Setup Commands

If you want to do everything in SQL (after creating users in Auth UI):

```sql
-- 1. Get your user ID
SELECT id, email FROM auth.users WHERE email = 'admin@stratumpr.com';

-- 2. Create/update your profile (replace USER_ID with result from above)
INSERT INTO public.profiles (id, email, is_super_admin, business_id)
VALUES (
  'USER_ID_FROM_STEP_1',
  'admin@stratumpr.com',
  true,
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO UPDATE
SET is_super_admin = true,
    business_id = '00000000-0000-0000-0000-000000000001';
```

## Next Steps After Login

Once you're logged in:
1. As super admin, you'll see the Admin Dashboard
2. You can see all businesses (currently just the demo one)
3. You can click on a business and "Login as Business" to see their dashboard
4. All your existing data (7 clients, 9 pets, etc.) should appear in the demo business
