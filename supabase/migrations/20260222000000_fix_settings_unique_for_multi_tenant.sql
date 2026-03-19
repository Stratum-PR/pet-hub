-- Fix settings not persisting per business: original table had UNIQUE(key) so only one row per key globally.
-- Allow each business to have its own settings by making the unique constraint on (business_id, key).

-- Drop the old unique constraint on key (PostgreSQL names it {table}_{column}_key)
ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_key_key;

-- Remove duplicate (business_id, key) rows if any, keeping the latest updated_at per (business_id, key)
DELETE FROM public.settings a
USING public.settings b
WHERE a.id < b.id
  AND a.key = b.key
  AND (a.business_id IS NOT NULL AND b.business_id IS NOT NULL AND a.business_id = b.business_id
       OR a.business_id IS NULL AND b.business_id IS NULL);

-- Add unique on (business_id, key) so each business can have its own value per key
ALTER TABLE public.settings
  ADD CONSTRAINT settings_business_id_key_key UNIQUE (business_id, key);
