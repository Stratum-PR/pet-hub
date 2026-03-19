-- Add separate business logo URLs for light/dark mode.
-- Keeps the existing `business_logo_url` for backward compatibility.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_logo_url_light TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_logo_url_dark TEXT;

