-- Add category and cost columns to services table
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS cost NUMERIC;
