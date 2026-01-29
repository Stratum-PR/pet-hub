BEGIN;

-- ============================================
-- ENSURE ALL BUSINESS_ID COLUMNS EXIST
-- ============================================
-- This migration ensures that all tables have business_id columns
-- and handles any schema drift issues

-- 1. Ensure pets.business_id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.pets 
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
    
    -- Backfill with demo business for existing rows
    UPDATE public.pets 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 2. Ensure services.business_id exists (and is UUID, not TEXT)
DO $$
BEGIN
  -- Check if column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services' 
    AND column_name = 'business_id'
  ) THEN
    -- Add as UUID
    ALTER TABLE public.services 
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
    
    -- Backfill with demo business
    UPDATE public.services 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  ELSE
    -- Check if it's TEXT and needs conversion
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'services' 
      AND column_name = 'business_id'
      AND data_type = 'text'
    ) THEN
      -- Convert TEXT to UUID (this should have been done in previous migration, but ensure it)
      ALTER TABLE public.services 
      ALTER COLUMN business_id TYPE UUID USING business_id::uuid;
      
      -- Add FK constraint if missing
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'services_business_id_fkey'
      ) THEN
        ALTER TABLE public.services 
        ADD CONSTRAINT services_business_id_fkey
        FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;

-- 3. Ensure appointments.business_id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.appointments 
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
    
    -- Backfill: try to get business_id from pet -> customer -> business
    UPDATE public.appointments a
    SET business_id = (
      SELECT p.business_id 
      FROM public.pets p 
      WHERE p.id = a.pet_id 
      LIMIT 1
    )
    WHERE a.business_id IS NULL;
    
    -- If still NULL, use demo business
    UPDATE public.appointments 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 4. Ensure customers table exists (not clients)
-- If clients table exists but customers doesn't, we need to handle migration
DO $$
BEGIN
  -- Check if customers table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'customers'
  ) THEN
    -- If clients exists, create customers from it
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'clients'
    ) THEN
      -- Create customers table with business_id
      CREATE TABLE public.customers (
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
      
      -- Migrate data from clients (split name into first_name/last_name)
      INSERT INTO public.customers (id, business_id, first_name, last_name, email, phone, address, notes, created_at, updated_at)
      SELECT 
        id,
        '00000000-0000-0000-0000-000000000001'::uuid as business_id,
        SPLIT_PART(name, ' ', 1) as first_name,
        COALESCE(SUBSTRING(name FROM POSITION(' ' IN name) + 1), '') as last_name,
        email,
        phone,
        address,
        notes,
        created_at,
        updated_at
      FROM public.clients;
    ELSE
      -- Create empty customers table
      CREATE TABLE public.customers (
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
    END IF;
    
    -- Enable RLS
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policies
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
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
  END IF;
END $$;

-- 5. Refresh PostgREST schema cache
-- Note: This requires superuser privileges, so it may fail in some environments
-- The cache will refresh automatically, but we can try to force it
NOTIFY pgrst, 'reload schema';

COMMIT;
