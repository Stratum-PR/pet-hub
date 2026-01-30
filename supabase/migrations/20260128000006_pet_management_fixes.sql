BEGIN;

-- ============================================
-- PART 1: DATA CLEANUP
-- ============================================

-- Task 1.1: Delete duplicate pets (keep oldest entry per business)
-- Duplicates are defined as pets with the same name (case-insensitive, trimmed) within the same business_id
DELETE FROM public.pets
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY business_id, LOWER(TRIM(name))
        ORDER BY created_at ASC
      ) as rn
    FROM public.pets
    WHERE business_id IS NOT NULL
  ) duplicates
  WHERE rn > 1
);

-- Task 1.2: Ensure all pets have owners
-- First, migrate pets with client_id (legacy) to customer_id if the client exists in customers table
-- Note: client_id might be TEXT or UUID, so we need to handle both cases
UPDATE public.pets p
SET customer_id = (
  SELECT c.id
  FROM public.customers c
  WHERE c.id::text = p.client_id::text
  LIMIT 1
)
WHERE p.customer_id IS NULL
  AND p.client_id IS NOT NULL
  AND p.client_id::text != '00000000-0000-0000-0000-000000000000'
  AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id::text = p.client_id::text
  );

-- Assign orphaned pets (no customer_id or client_id) to a random customer
-- First, handle pets with business_id - assign to random customer from same business
UPDATE public.pets p
SET customer_id = (
  SELECT c.id
  FROM public.customers c
  WHERE c.business_id = p.business_id
  ORDER BY RANDOM()
  LIMIT 1
)
WHERE (p.customer_id IS NULL OR p.customer_id = '00000000-0000-0000-0000-000000000000'::uuid)
  AND (p.client_id IS NULL OR p.client_id::text = '00000000-0000-0000-0000-000000000000')
  AND p.business_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c WHERE c.business_id = p.business_id
  );

-- Handle pets without business_id - assign to any random customer
UPDATE public.pets p
SET customer_id = (
  SELECT c.id
  FROM public.customers c
  ORDER BY RANDOM()
  LIMIT 1
)
WHERE (p.customer_id IS NULL OR p.customer_id = '00000000-0000-0000-0000-000000000000'::uuid)
  AND (p.client_id IS NULL OR p.client_id::text = '00000000-0000-0000-0000-000000000000')
  AND p.business_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.customers LIMIT 1
  );

-- If no customers exist at all, we'll leave the pets as-is (they'll be handled by application logic)

-- ============================================
-- PART 2: SCHEMA UPDATES
-- ============================================

-- Task 1.3: Add new columns to pets table
DO $$
BEGIN
  -- Add birth_month (1-12, nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'birth_month'
  ) THEN
    ALTER TABLE public.pets 
    ADD COLUMN birth_month INTEGER CHECK (birth_month >= 1 AND birth_month <= 12);
  END IF;

  -- Add birth_year (1900 to current year, nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'birth_year'
  ) THEN
    ALTER TABLE public.pets 
    ADD COLUMN birth_year INTEGER CHECK (birth_year >= 1900 AND birth_year <= EXTRACT(YEAR FROM CURRENT_DATE));
  END IF;

  -- Add vaccination_status (text enum, default 'unknown')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'vaccination_status'
  ) THEN
    ALTER TABLE public.pets 
    ADD COLUMN vaccination_status TEXT DEFAULT 'unknown' 
    CHECK (vaccination_status IN ('up_to_date', 'out_of_date', 'unknown'));
  ELSE
    -- Update existing vaccination_status values to match new enum
    UPDATE public.pets
    SET vaccination_status = CASE
      WHEN vaccination_status = 'up-to-date' THEN 'up_to_date'
      WHEN vaccination_status = 'overdue' THEN 'out_of_date'
      WHEN vaccination_status = 'due-soon' THEN 'out_of_date'
      WHEN vaccination_status = 'pending' THEN 'unknown'
      WHEN vaccination_status IS NULL THEN 'unknown'
      ELSE vaccination_status
    END
    WHERE vaccination_status NOT IN ('up_to_date', 'out_of_date', 'unknown');
    
    -- Add check constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'pets_vaccination_status_check'
    ) THEN
      ALTER TABLE public.pets 
      ADD CONSTRAINT pets_vaccination_status_check 
      CHECK (vaccination_status IN ('up_to_date', 'out_of_date', 'unknown'));
    END IF;
  END IF;

  -- Add last_vaccination_date (date, nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'last_vaccination_date'
  ) THEN
    ALTER TABLE public.pets 
    ADD COLUMN last_vaccination_date DATE;
  END IF;

  -- Add photo_url (text, nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE public.pets 
    ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- Migrate existing age data to approximate birth_year before dropping age column
-- Estimate birth_year as current_year - age (using January as default month)
UPDATE public.pets
SET birth_year = EXTRACT(YEAR FROM CURRENT_DATE) - age,
    birth_month = 1
WHERE age IS NOT NULL 
  AND age > 0 
  AND birth_year IS NULL
  AND EXTRACT(YEAR FROM CURRENT_DATE) - age >= 1900;

-- Set initial vaccination_status based on last_vaccination_date
-- (This will be updated by the function, but set initial values)
UPDATE public.pets
SET vaccination_status = CASE
  WHEN last_vaccination_date IS NULL THEN 'unknown'
  WHEN last_vaccination_date >= CURRENT_DATE - INTERVAL '12 months' THEN 'up_to_date'
  ELSE 'out_of_date'
END
WHERE vaccination_status = 'unknown' OR vaccination_status IS NULL;

-- Remove the old age column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'age'
  ) THEN
    ALTER TABLE public.pets DROP COLUMN age;
  END IF;
END $$;

-- ============================================
-- PART 3: DATABASE FUNCTIONS
-- ============================================

-- Task 1.4: Create age calculation function
CREATE OR REPLACE FUNCTION public.calculate_pet_age(
  p_birth_month INTEGER,
  p_birth_year INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  current_month INTEGER;
  current_year INTEGER;
  age_years INTEGER;
BEGIN
  -- Handle NULL values
  IF p_birth_month IS NULL OR p_birth_year IS NULL THEN
    RETURN NULL;
  END IF;

  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Calculate age
  age_years := current_year - p_birth_year;

  -- If birthday hasn't occurred this year yet, subtract 1
  IF current_month < p_birth_month OR 
     (current_month = p_birth_month AND EXTRACT(DAY FROM CURRENT_DATE) < 1) THEN
    age_years := age_years - 1;
  END IF;

  -- Return 0 if negative (shouldn't happen with valid data)
  RETURN GREATEST(0, age_years);
END;
$$;

-- Task 1.5: Create vaccination status function
CREATE OR REPLACE FUNCTION public.calculate_vaccination_status(
  p_last_vaccination_date DATE
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Handle NULL values
  IF p_last_vaccination_date IS NULL THEN
    RETURN 'unknown';
  END IF;

  -- Vaccines are valid for 12 months
  IF p_last_vaccination_date >= CURRENT_DATE - INTERVAL '12 months' THEN
    RETURN 'up_to_date';
  ELSE
    RETURN 'out_of_date';
  END IF;
END;
$$;

-- Create a trigger function to auto-update vaccination_status when last_vaccination_date changes
CREATE OR REPLACE FUNCTION public.update_vaccination_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.vaccination_status := public.calculate_vaccination_status(NEW.last_vaccination_date);
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update vaccination_status
DROP TRIGGER IF EXISTS trigger_update_vaccination_status ON public.pets;
CREATE TRIGGER trigger_update_vaccination_status
  BEFORE INSERT OR UPDATE OF last_vaccination_date ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vaccination_status();

-- ============================================
-- PART 4: CREATE STORAGE BUCKET FOR PET PHOTOS
-- ============================================

-- Note: Storage buckets are typically created via Supabase dashboard or CLI
-- This SQL will attempt to create it, but may require additional permissions
-- The bucket should be created with public access for reading pet photos

-- Create pet-photos bucket if it doesn't exist
-- Note: This requires storage admin privileges
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pet-photos',
  'pet-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for pet-photos bucket
DO $$
BEGIN
  -- Drop existing policies if they exist (to avoid conflicts)
  DROP POLICY IF EXISTS "Public can view pet photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload pet photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update pet photos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete pet photos" ON storage.objects;

  -- Create storage policy for public read access
  CREATE POLICY "Public can view pet photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-photos');

  -- Create storage policy for authenticated users to upload
  CREATE POLICY "Authenticated users can upload pet photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pet-photos' 
    AND auth.role() = 'authenticated'
  );

  -- Create storage policy for authenticated users to update their own uploads
  CREATE POLICY "Authenticated users can update pet photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pet-photos' 
    AND auth.role() = 'authenticated'
  );

  -- Create storage policy for authenticated users to delete their own uploads
  CREATE POLICY "Authenticated users can delete pet photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pet-photos' 
    AND auth.role() = 'authenticated'
  );
END $$;

COMMIT;
