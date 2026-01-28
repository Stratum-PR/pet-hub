-- Add business_id column to settings table for multi-tenant support
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_settings_business_id ON public.settings(business_id);

-- Update RLS policy to filter by business_id
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.settings;

-- Create new RLS policies that filter by business_id
CREATE POLICY "Users can read settings from their business"
ON public.settings FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can update settings from their business"
ON public.settings FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can insert settings for their business"
ON public.settings FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  )
);
