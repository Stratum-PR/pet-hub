# Multi-Tenant SaaS Platform Implementation Guide

This document outlines the complete implementation of the multi-tenant SaaS platform for pet grooming businesses.

## ✅ Completed Components

### 1. Database Schema
- ✅ Migration file: `supabase/migrations/20250120000000_create_multi_tenant_schema.sql`
- ✅ All tables created: profiles, businesses, customers, pets, services, appointments, admin_impersonation_tokens
- ✅ RLS policies implemented for all tables
- ✅ Database functions: `generate_impersonation_token`, `use_impersonation_token`
- ✅ Indexes for performance
- ✅ Auto-profile creation trigger

### 2. Authentication System
- ✅ Auth helpers: `src/lib/auth.ts`
- ✅ Auth context: `src/contexts/AuthContext.tsx`
- ✅ Protected route component: `src/components/ProtectedRoute.tsx`
- ✅ Business ID hook: `src/hooks/useBusinessId.ts`

### 3. Public Pages
- ✅ Landing page: `src/pages/Landing.tsx`
- ✅ Pricing page: `src/pages/Pricing.tsx`
- ✅ Login page: `src/pages/Login.tsx`
- ✅ Signup success page: `src/pages/SignupSuccess.tsx`

### 4. Admin Portal
- ✅ Admin dashboard: `src/pages/AdminDashboard.tsx`
- ✅ Business detail page: `src/pages/AdminBusinessDetail.tsx`
- ✅ Impersonation handler: `src/pages/ImpersonateHandler.tsx`
- ✅ Impersonation banner: `src/components/ImpersonationBanner.tsx`

### 5. Business Portal Structure
- ✅ Business layout: `src/components/BusinessLayout.tsx`
- ✅ Business dashboard: `src/pages/BusinessDashboard.tsx`
- ⚠️ Other business pages need to be migrated (see below)

### 6. Routing
- ✅ Updated `src/App.tsx` with new route structure
- ✅ Public routes configured
- ✅ Protected business routes configured
- ✅ Protected admin routes configured

### 7. Seed Data
- ✅ Seed script: `supabase/seed.sql`

### 8. API Routes Documentation
- ✅ `API_ROUTES.md` with Supabase Edge Functions examples

## 🔧 Setup Instructions

### Step 1: Run Database Migration

1. Connect to your Supabase project
2. Go to SQL Editor
3. Run the migration file: `supabase/migrations/20250120000000_create_multi_tenant_schema.sql`
4. Verify all tables and policies are created

### Step 2: Set Up Environment Variables

Create `.env.local` file:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
VITE_STRIPE_PRICE_BASIC=price_...
VITE_STRIPE_PRICE_PRO=price_...
VITE_STRIPE_PRICE_ENTERPRISE=price_...

# App
VITE_APP_URL=http://localhost:8080
```

### Step 3: Set Up Stripe

1. Create Stripe account
2. Create three products with prices:
   - Basic: $29/month
   - Pro: $79/month
   - Enterprise: $199/month
3. Copy the Price IDs to `.env.local`
4. Set up webhook endpoint in Stripe Dashboard:
   - URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Step 4: Set Up Supabase Edge Functions

See `API_ROUTES.md` for detailed instructions. You need to create:
1. `/functions/checkout` - Stripe checkout session creation
2. `/functions/stripe-webhook` - Stripe webhook handler
3. `/functions/admin-impersonate` - Admin impersonation token generation

### Step 5: Set Up Resend

1. Create Resend account
2. Get API key
3. Add to Edge Function environment variables: `RESEND_API_KEY`
4. Update webhook handler to send welcome emails

### Step 6: Create Demo Account

1. Create user in Supabase Auth UI:
   - Email: `demo@pawsomegrooming.com`
   - Password: `DemoPassword123!`
   - Confirm email
2. Run seed script: `supabase/seed.sql`
3. Link profile to business:
   ```sql
   UPDATE public.profiles 
   SET business_id = '00000000-0000-0000-0000-000000000001' 
   WHERE email = 'demo@pawsomegrooming.com';
   ```

### Step 7: Make Yourself Super Admin

Run in Supabase SQL Editor:
```sql
UPDATE public.profiles 
SET is_super_admin = true 
WHERE email = 'your-email@example.com';
```

## 📋 Remaining Tasks

### 1. Migrate Existing Business Pages

The following pages need to be updated to use `business_id` filtering:

- [ ] `src/pages/Appointments.tsx` → `/app/appointments`
- [ ] `src/pages/Clients.tsx` → `/app/customers` (rename clients to customers)
- [ ] `src/pages/Pets.tsx` → `/app/pets`
- [ ] `src/pages/Services.tsx` → `/app/services`
- [ ] Create `/app/settings` page
- [ ] Create `/app/reports` page

**Migration Pattern:**
1. Use `useBusinessId()` hook to get active business_id
2. Filter all queries by `business_id`
3. Update table names (clients → customers)
4. Update field names (name → first_name + last_name for customers)

### 2. Update Existing Hooks

Update `src/hooks/useSupabaseData.ts` to:
- Accept `businessId` parameter
- Filter all queries by `business_id`
- Create new hooks: `useCustomers`, `useBusinessServices`, etc.

### 3. Update TypeScript Types

Update `src/types/index.ts` to match new schema:
- Rename `Client` to `Customer` with `first_name`, `last_name`
- Add `business_id` to all types
- Update `Appointment` to use `appointment_date`, `start_time`, `end_time`
- Add new types: `Profile`, `Business`

### 4. Complete Stripe Integration

- [ ] Implement Stripe embedded checkout in Pricing page
- [ ] Test checkout flow end-to-end
- [ ] Verify webhook creates accounts correctly
- [ ] Test subscription updates

### 5. Complete Email Integration

- [ ] Create welcome email template in Resend
- [ ] Send email after checkout completion
- [ ] Include email confirmation link from Supabase
- [ ] Test email delivery

### 6. Testing

- [ ] Test complete signup flow
- [ ] Test business portal features
- [ ] Test admin impersonation
- [ ] Verify RLS prevents cross-business data access
- [ ] Test demo account login

## 🔐 Security Checklist

- [x] RLS policies on all tables
- [x] Super admin checks for admin routes
- [x] Impersonation tokens expire after 1 hour
- [x] Impersonation tokens can only be used once
- [x] Service role key only used server-side
- [ ] Stripe webhook signature verification
- [ ] Input validation on all forms
- [ ] SQL injection prevention (using Supabase client)

## 📝 Notes

### Current Architecture

- **Frontend**: Vite + React + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **API Routes**: Supabase Edge Functions (Deno)
- **Payments**: Stripe
- **Email**: Resend

### Multi-Tenancy Strategy

- Row-level isolation using `business_id` column
- RLS policies enforce data access
- Impersonation allows admins to view business data
- All queries must filter by `business_id`

### Migration from Single-Tenant

The existing app was single-tenant. To migrate:
1. All existing data needs a `business_id` assigned
2. Tables renamed: `clients` → `customers`
3. Fields updated: `name` → `first_name` + `last_name`
4. All hooks updated to filter by `business_id`

## 🚀 Next Steps

1. Run the database migration
2. Set up environment variables
3. Create Stripe products and prices
4. Deploy Supabase Edge Functions
5. Test the complete flow
6. Migrate existing pages one by one
7. Update all hooks to use business_id
8. Test thoroughly
9. Deploy to production

## 📞 Support

If you encounter issues:
1. Check Supabase logs for database errors
2. Check browser console for frontend errors
3. Verify RLS policies are working correctly
4. Test with demo account first
5. Verify environment variables are set correctly
