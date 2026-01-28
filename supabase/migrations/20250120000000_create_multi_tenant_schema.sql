-- ============================================
-- MULTI-TENANT SAAS PLATFORM MIGRATION
-- ============================================
-- This migration transforms the app into a multi-tenant SaaS platform
-- with proper Row Level Security (RLS) and business isolation

-- ============================================
-- 1. CREATE PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Super admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- 2. CREATE BUSINESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  website TEXT,
  logo_url TEXT,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
CREATE POLICY "Users can read their own business"
  ON public.businesses FOR SELECT
  USING (
    id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can update their own business"
  ON public.businesses FOR UPDATE
  USING (
    id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Super admins can access all businesses"
  ON public.businesses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- 3. CREATE ADMIN IMPERSONATION TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_impersonation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_impersonation_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only super admins can create/read tokens
CREATE POLICY "Super admins can manage impersonation tokens"
  ON public.admin_impersonation_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- 4. MIGRATE EXISTING TABLES TO MULTI-TENANT
-- ============================================

-- Add business_id to clients table (rename to customers)
-- First, create new customers table with business_id
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy for customers
CREATE POLICY "Users can access customers from their business"
  ON public.customers FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage customers from their business"
  ON public.customers FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Add business_id to pets table
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;

-- Update pets RLS policies
DROP POLICY IF EXISTS "Allow all operations on pets" ON public.pets;

CREATE POLICY "Users can access pets from their business"
  ON public.pets FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage pets from their business"
  ON public.pets FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Add business_id to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Update services RLS policies
DROP POLICY IF EXISTS "Allow all operations on services" ON public.services;

CREATE POLICY "Users can access services from their business"
  ON public.services FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage services from their business"
  ON public.services FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Add business_id to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT;

-- Rename scheduled_date to appointment_date and add start_time/end_time
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS total_price NUMERIC;

-- Migrate scheduled_date to appointment_date and start_time
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'scheduled_date') THEN
    UPDATE public.appointments
    SET appointment_date = scheduled_date::DATE,
        start_time = scheduled_date::TIME
    WHERE appointment_date IS NULL;
  END IF;
END $$;

-- Update appointments RLS policies
DROP POLICY IF EXISTS "Allow all operations on appointments" ON public.appointments;

CREATE POLICY "Users can access appointments from their business"
  ON public.appointments FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage appointments from their business"
  ON public.appointments FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Add business_id to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Update employees RLS policies
DROP POLICY IF EXISTS "Allow all operations on employees" ON public.employees;

CREATE POLICY "Users can access employees from their business"
  ON public.employees FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage employees from their business"
  ON public.employees FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Add business_id to time_entries (via employee relationship, but add direct for performance)
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Update time_entries RLS policies
DROP POLICY IF EXISTS "Allow all operations on time_entries" ON public.time_entries;

CREATE POLICY "Users can access time_entries from their business"
  ON public.time_entries FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Users can manage time_entries from their business"
  ON public.time_entries FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- 5. CREATE DATABASE FUNCTIONS
-- ============================================

-- Function: generate_impersonation_token
CREATE OR REPLACE FUNCTION public.generate_impersonation_token(target_business_id UUID)
RETURNS TABLE(token TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token TEXT;
  token_expires_at TIMESTAMP WITH TIME ZONE;
  current_admin_id UUID;
BEGIN
  -- Get current user ID
  current_admin_id := auth.uid();
  
  -- Verify user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_admin_id AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can generate impersonation tokens';
  END IF;
  
  -- Generate secure random token (32 characters)
  new_token := encode(gen_random_bytes(16), 'hex');
  
  -- Set expiration to 1 hour from now
  token_expires_at := now() + INTERVAL '1 hour';
  
  -- Insert token
  INSERT INTO public.admin_impersonation_tokens (admin_id, business_id, token, expires_at)
  VALUES (current_admin_id, target_business_id, new_token, token_expires_at);
  
  -- Return token and expiration
  RETURN QUERY SELECT new_token, token_expires_at;
END;
$$;

-- Function: use_impersonation_token
CREATE OR REPLACE FUNCTION public.use_impersonation_token(impersonation_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
  business_uuid UUID;
BEGIN
  -- Find the token
  SELECT * INTO token_record
  FROM public.admin_impersonation_tokens
  WHERE token = impersonation_token;
  
  -- Check if token exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid impersonation token';
  END IF;
  
  -- Check if token is already used
  IF token_record.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Impersonation token has already been used';
  END IF;
  
  -- Check if token is expired
  IF token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Impersonation token has expired';
  END IF;
  
  -- Mark token as used
  UPDATE public.admin_impersonation_tokens
  SET used_at = now()
  WHERE id = token_record.id;
  
  -- Return business_id
  RETURN token_record.business_id;
END;
$$;

-- ============================================
-- 6. CREATE TRIGGERS
-- ============================================

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for businesses updated_at
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for customers updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_pets_business_id ON public.pets(business_id);
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON public.pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON public.appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON public.appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON public.appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_employees_business_id ON public.employees(business_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_business_id ON public.time_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_tokens_token ON public.admin_impersonation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_impersonation_tokens_expires_at ON public.admin_impersonation_tokens(expires_at);

-- ============================================
-- 8. CREATE FUNCTION TO AUTO-CREATE PROFILE
-- ============================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

-- Trigger to call function on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
