-- ============================================
-- FIX PRODUCTION SCHEMA - RUN THIS IN PRODUCTION
-- ============================================
-- Copy and paste this entire script into Supabase SQL Editor
-- This will add missing columns to match the expected schema

-- 1. Add business_id to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN business_id UUID;
    
    -- Set default business_id for existing records
    UPDATE public.clients 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
    
    -- Add foreign key if businesses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'businesses') THEN
      ALTER TABLE public.clients 
      ADD CONSTRAINT clients_business_id_fkey 
      FOREIGN KEY (business_id) 
      REFERENCES public.businesses(id) 
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 2. Add business_id to services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.services 
    ADD COLUMN business_id UUID;
    
    -- Set default business_id for existing records
    UPDATE public.services 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
    
    -- Add foreign key if businesses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'businesses') THEN
      ALTER TABLE public.services 
      ADD CONSTRAINT services_business_id_fkey 
      FOREIGN KEY (business_id) 
      REFERENCES public.businesses(id) 
      ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON public.clients(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);

-- Verify the columns were added
SELECT 
  'clients.business_id' as column_check,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'business_id'
  ) as exists
UNION ALL
SELECT 
  'services.business_id' as column_check,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services' 
    AND column_name = 'business_id'
  ) as exists;
