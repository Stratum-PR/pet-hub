-- Add color column to services table for appointment calendar color coding
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS color TEXT;

-- Set default colors for existing services based on category or name
UPDATE public.services
SET color = CASE
  WHEN LOWER(name) LIKE '%haircut%' OR LOWER(name) LIKE '%cut%' THEN '#7DD3FC' -- Blue
  WHEN LOWER(name) LIKE '%bath%' THEN '#86EFAC' -- Green
  WHEN LOWER(name) LIKE '%grooming%' OR LOWER(name) LIKE '%full%' THEN '#F9A8D4' -- Pink
  WHEN LOWER(name) LIKE '%nail%' THEN '#FDE68A' -- Yellow
  ELSE '#7DD3FC' -- Default to blue
END
WHERE color IS NULL;
