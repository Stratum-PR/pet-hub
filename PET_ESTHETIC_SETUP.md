# Pet Esthetic Business Setup Guide

## ✅ What's Been Done

1. **"View Demo" Button Added**: The login page now has a "View Demo" button that automatically logs you in with the demo account credentials.

2. **Impersonation Fixed**: The admin portal now correctly uses Supabase RPC functions to generate impersonation tokens, allowing super admins to access any business portal.

3. **Pet Esthetic Seed Script Created**: A complete seed script (`supabase/seed_pet_esthetic.sql`) has been created with:
   - Business information for "Pet Esthetic"
   - 6 customers with placeholder data
   - 7 pets linked to customers
   - 7 services (Bath & Brush, Full Service Groom, Nail Trim, etc.)
   - 5 appointments (today, tomorrow, and next week)
   - 3 employees (if employees table exists)

## 📋 Next Steps

### Step 1: Run the Pet Esthetic Seed Script

1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Open the file `supabase/seed_pet_esthetic.sql`
3. Copy and paste the entire script into the SQL Editor
4. Click **"Run"**

This will:
- Create the "Pet Esthetic" business
- Link `g.rodriguez@stratumpr.com` to the business (if the user exists in auth.users)
- Create all placeholder data (customers, pets, services, appointments, employees)

### Step 2: Verify the Setup

After running the seed script, verify everything was created:

```sql
-- Check business
SELECT id, name, email, subscription_tier 
FROM public.businesses 
WHERE name = 'Pet Esthetic';

-- Check data counts
SELECT 
  (SELECT COUNT(*) FROM public.customers WHERE business_id = '00000000-0000-0000-0000-000000000002') as customers,
  (SELECT COUNT(*) FROM public.pets WHERE business_id = '00000000-0000-0000-0000-000000000002') as pets,
  (SELECT COUNT(*) FROM public.services WHERE business_id = '00000000-0000-0000-0000-000000000002') as services,
  (SELECT COUNT(*) FROM public.appointments WHERE business_id = '00000000-0000-0000-0000-000000000002') as appointments;
```

### Step 3: Test the Features

1. **Test "View Demo" Button**:
   - Go to `/login`
   - Click "View Demo" button
   - Should automatically log in and redirect to `/app`

2. **Test Super Admin Portal**:
   - Log in as `tech@stratumpr.com` (super admin)
   - Should see both businesses:
     - "Pawsome Grooming Demo"
     - "Pet Esthetic"
   - Click "View Details" on "Pet Esthetic"
   - Click "Login as Business" button
   - Should open the business dashboard in a new tab with impersonation banner

3. **Test Business Portal**:
   - Log in as `g.rodriguez@stratumpr.com`
   - Should see the Pet Esthetic dashboard with all the placeholder data

## 🔍 What the Seed Script Creates

### Business: Pet Esthetic
- **Email**: g.rodriguez@stratumpr.com
- **Location**: San Juan, PR
- **Tier**: Pro
- **Status**: Active

### Customers (6)
1. Maria Gonzalez
2. Carlos Martinez
3. Ana Rivera (has 2 pets)
4. Jose Torres
5. Carmen Lopez (VIP customer)
6. Roberto Sanchez

### Pets (7)
1. Luna (Yorkshire Terrier) - Maria's pet
2. Max (German Shepherd) - Carlos's pet
3. Bella (Shih Tzu) - Ana's pet
4. Rocky (French Bulldog) - Ana's pet
5. Coco (Poodle) - Jose's pet
6. Princess (Maltese) - Carmen's pet
7. Tiger (Persian Cat) - Roberto's pet

### Services (7)
1. Bath & Brush - $45.00
2. Full Service Groom - $75.00
3. Nail Trim Only - $18.00
4. Teeth Cleaning - $25.00
5. De-shedding Treatment - $55.00
6. Puppy First Groom - $50.00
7. Spa Package - $95.00

### Appointments (5)
- 2 appointments today
- 2 appointments tomorrow
- 1 appointment next week

### Employees (3)
- Maria Rodriguez (Senior Groomer)
- Juan Perez (Groomer)
- Sofia Martinez (Junior Groomer)

## 🐛 Troubleshooting

### User Not Linked to Business
If `g.rodriguez@stratumpr.com` is not linked after running the script:

```sql
-- Check if user exists
SELECT id, email FROM auth.users WHERE email = 'g.rodriguez@stratumpr.com';

-- Manually link (replace USER_ID with the ID from above)
UPDATE public.profiles 
SET business_id = '00000000-0000-0000-0000-000000000002'
WHERE email = 'g.rodriguez@stratumpr.com';
```

### Business Not Showing in Admin Dashboard
- Make sure you're logged in as a super admin (`tech@stratumpr.com`)
- Check that the business was created:
  ```sql
  SELECT * FROM public.businesses WHERE name = 'Pet Esthetic';
  ```

### Impersonation Not Working
- Make sure you're a super admin
- Check browser console for errors
- Verify the RPC function exists:
  ```sql
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_schema = 'public' AND routine_name = 'generate_impersonation_token';
  ```

## 📝 Notes

- The business ID for Pet Esthetic is: `00000000-0000-0000-0000-000000000002`
- All data is linked to this business ID
- The seed script uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times
- If you need to reset the data, delete the business and run the script again
