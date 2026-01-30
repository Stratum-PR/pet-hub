-- Fix production schema mismatch
-- This migration adds missing columns and relationships to match the expected schema
-- It's idempotent and safe to run multiple times

-- 1. Add business_id to clients table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.clients 
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
    
    -- Set default business_id for existing records (use demo business)
    UPDATE public.clients 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 2. Add first_name and last_name to clients if they don't exist
-- If clients only has 'name', split it into first_name and last_name
DO $$
BEGIN
  -- Check if first_name doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'first_name'
  ) THEN
    -- Add first_name column
    ALTER TABLE public.clients 
    ADD COLUMN first_name TEXT;
    
    -- Add last_name column
    ALTER TABLE public.clients 
    ADD COLUMN last_name TEXT;
    
    -- If 'name' column exists, split it into first_name and last_name
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'clients' 
      AND column_name = 'name'
    ) THEN
      -- Split name into first_name and last_name
      UPDATE public.clients 
      SET 
        first_name = CASE 
          WHEN name ~ ' ' THEN SPLIT_PART(name, ' ', 1)
          ELSE name
        END,
        last_name = CASE 
          WHEN name ~ ' ' THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
          ELSE ''
        END
      WHERE first_name IS NULL OR last_name IS NULL;
      
      -- Make columns NOT NULL after migration
      ALTER TABLE public.clients 
      ALTER COLUMN first_name SET NOT NULL,
      ALTER COLUMN last_name SET NOT NULL;
    ELSE
      -- No name column, set defaults
      UPDATE public.clients 
      SET first_name = 'Sin nombre', last_name = ''
      WHERE first_name IS NULL;
      
      ALTER TABLE public.clients 
      ALTER COLUMN first_name SET NOT NULL,
      ALTER COLUMN last_name SET NOT NULL;
    END IF;
  END IF;
END $$;

-- 3. Add business_id to services table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services' 
    AND column_name = 'business_id'
  ) THEN
    ALTER TABLE public.services 
    ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
    
    -- Set default business_id for existing records
    UPDATE public.services 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 4. Add client_id to appointments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.appointments 
    ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
    
    -- Try to backfill client_id from pet -> client relationship
    UPDATE public.appointments a
    SET client_id = (
      SELECT p.client_id 
      FROM public.pets p 
      WHERE p.id = a.pet_id::uuid
      LIMIT 1
    )
    WHERE a.client_id IS NULL AND a.pet_id IS NOT NULL;
    
    -- If still NULL and customer_id exists, try to use that
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'appointments' 
      AND column_name = 'customer_id'
    ) THEN
      UPDATE public.appointments a
      SET client_id = a.customer_id
      WHERE a.client_id IS NULL AND a.customer_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- 5. Ensure foreign key constraint exists for appointments.client_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'appointments_client_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'appointments'
  ) THEN
    -- Add foreign key constraint if it doesn't exist
    ALTER TABLE public.appointments 
    ADD CONSTRAINT appointments_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES public.clients(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add business_id to appointments if it doesn't exist
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
    
    -- Try to backfill business_id from client or pet
    UPDATE public.appointments a
    SET business_id = (
      SELECT c.business_id 
      FROM public.clients c 
      WHERE c.id = a.client_id
      LIMIT 1
    )
    WHERE a.business_id IS NULL AND a.client_id IS NOT NULL;
    
    -- If still NULL, try from pet
    UPDATE public.appointments a
    SET business_id = (
      SELECT p.business_id 
      FROM public.pets p 
      WHERE p.id = a.pet_id::uuid
      LIMIT 1
    )
    WHERE a.business_id IS NULL AND a.pet_id IS NOT NULL;
    
    -- If still NULL, use default
    UPDATE public.appointments 
    SET business_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE business_id IS NULL;
  END IF;
END $$;

-- 7. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON public.clients(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON public.appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);

-- 8. Update RLS policies if they don't exist
DO $$
BEGIN
  -- Clients RLS policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'clients' 
    AND policyname = 'Users can view clients in their business'
  ) THEN
    CREATE POLICY "Users can view clients in their business" ON public.clients
      FOR SELECT USING (
        business_id IN (
          SELECT business_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
  
  -- Services RLS policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'services' 
    AND policyname = 'Users can view services in their business'
  ) THEN
    CREATE POLICY "Users can view services in their business" ON public.services
      FOR SELECT USING (
        business_id IN (
          SELECT business_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
  
  -- Appointments RLS policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'appointments' 
    AND policyname = 'Users can view appointments in their business'
  ) THEN
    CREATE POLICY "Users can view appointments in their business" ON public.appointments
      FOR SELECT USING (
        business_id IN (
          SELECT business_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
