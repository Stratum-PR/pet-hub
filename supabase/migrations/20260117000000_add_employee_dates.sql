-- Add hire_date and last_date fields to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS hire_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_date TIMESTAMP WITH TIME ZONE;
