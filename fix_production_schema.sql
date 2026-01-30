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
    
    -- Set default business_id for existing records (CRITICAL for multi-tenancy)
    UPDATE public.clients 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
    
    -- Make business_id NOT NULL after backfilling
    ALTER TABLE public.clients 
    ALTER COLUMN business_id SET NOT NULL;
    
    -- Add foreign key if businesses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'businesses') THEN
      ALTER TABLE public.clients 
      ADD CONSTRAINT clients_business_id_fkey 
      FOREIGN KEY (business_id) 
      REFERENCES public.businesses(id) 
      ON DELETE CASCADE;
    END IF;
  ELSE
    -- Column exists but might have NULL values - backfill them
    UPDATE public.clients 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
    
    -- Make sure it's NOT NULL
    ALTER TABLE public.clients 
    ALTER COLUMN business_id SET NOT NULL;
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
    
    -- Set default business_id for existing records (CRITICAL for multi-tenancy)
    UPDATE public.services 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
    
    -- Make business_id NOT NULL after backfilling
    ALTER TABLE public.services 
    ALTER COLUMN business_id SET NOT NULL;
    
    -- Add foreign key if businesses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'businesses') THEN
      ALTER TABLE public.services 
      ADD CONSTRAINT services_business_id_fkey 
      FOREIGN KEY (business_id) 
      REFERENCES public.businesses(id) 
      ON DELETE CASCADE;
    END IF;
  ELSE
    -- Column exists but might have NULL values - backfill them
    UPDATE public.services 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
    
    -- Make sure it's NOT NULL
    ALTER TABLE public.services 
    ALTER COLUMN business_id SET NOT NULL;
  END IF;
END $$;

-- 3. Ensure pets table has business_id and it's populated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'business_id'
  ) THEN
    -- Backfill business_id from client if NULL
    UPDATE public.pets p
    SET business_id = (
      SELECT c.business_id 
      FROM public.clients c 
      WHERE c.id = p.client_id
      LIMIT 1
    )
    WHERE p.business_id IS NULL AND p.client_id IS NOT NULL;
    
    -- Set default if still NULL
    UPDATE public.pets 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 4. Ensure appointments table has business_id and it's populated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'business_id'
  ) THEN
    -- Backfill business_id from client if NULL
    UPDATE public.appointments a
    SET business_id = (
      SELECT c.business_id 
      FROM public.clients c 
      WHERE c.id = a.client_id
      LIMIT 1
    )
    WHERE a.business_id IS NULL AND a.client_id IS NOT NULL;
    
    -- Backfill from pet if still NULL
    UPDATE public.appointments a
    SET business_id = (
      SELECT p.business_id 
      FROM public.pets p 
      WHERE p.id = a.pet_id::uuid
      LIMIT 1
    )
    WHERE a.business_id IS NULL AND a.pet_id IS NOT NULL;
    
    -- Set default if still NULL
    UPDATE public.appointments 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 5. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON public.clients(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_pets_business_id ON public.pets(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON public.appointments(business_id);

-- 6. Verify the columns were added and populated
SELECT 
  'clients.business_id' as column_check,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'business_id'
  ) as column_exists,
  COUNT(*) FILTER (WHERE business_id IS NOT NULL) as records_with_business_id,
  COUNT(*) as total_records
FROM public.clients
UNION ALL
SELECT 
  'services.business_id' as column_check,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services' 
    AND column_name = 'business_id'
  ) as column_exists,
  COUNT(*) FILTER (WHERE business_id IS NOT NULL) as records_with_business_id,
  COUNT(*) as total_records
FROM public.services;
