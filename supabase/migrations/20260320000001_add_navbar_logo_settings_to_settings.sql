-- Persist navbar logo presentation settings.
-- These are used to improve readability for wordmarks in the sidebar header.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS navbar_logo_mode TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS navbar_logo_size_px INTEGER;

