-- Fix breed data consistency
-- Update breeds in pets table to match exact breed names from the application's breed lists

BEGIN;

-- Fix common breed mismatches
UPDATE public.pets
SET breed = CASE
  -- Poodle variations
  WHEN LOWER(breed) = 'poodle' THEN 'Poodle (Standard)'
  WHEN LOWER(breed) LIKE 'poodle%' AND breed != 'Poodle (Standard)' AND breed != 'Poodle (Miniature)' AND breed != 'Poodle (Toy)' THEN 'Poodle (Standard)'
  -- Ensure exact matches for known breeds
  WHEN breed = 'Yorkshire Terrier' THEN 'Yorkshire Terrier'
  WHEN breed = 'German Shepherd' THEN 'German Shepherd'
  WHEN breed = 'Shih Tzu' THEN 'Shih Tzu'
  WHEN breed = 'French Bulldog' THEN 'French Bulldog'
  ELSE breed
END
WHERE breed IS NOT NULL;

COMMIT;
