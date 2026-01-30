-- Backfill missing customer_id in appointments table
-- Derive customer_id from pet's customer_id

BEGIN;

-- Update appointments that have pet_id but missing customer_id
UPDATE public.appointments a
SET customer_id = (
  SELECT p.customer_id 
  FROM public.pets p 
  WHERE p.id = a.pet_id 
  LIMIT 1
)
WHERE a.customer_id IS NULL 
  AND a.pet_id IS NOT NULL;

-- Also ensure business_id is set from pet if missing
UPDATE public.appointments a
SET business_id = (
  SELECT p.business_id 
  FROM public.pets p 
  WHERE p.id = a.pet_id 
  LIMIT 1
)
WHERE a.business_id IS NULL 
  AND a.pet_id IS NOT NULL;

COMMIT;
