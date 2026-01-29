BEGIN;

-- Remove the UNIQUE constraint on sku column
-- SKU should only be unique per business, not globally
-- The composite unique index (business_id, sku) already handles this correctly

-- Drop the unique constraint if it exists
DO $$
BEGIN
  -- Check if there's a unique constraint on sku
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'inventory_sku_key' 
    AND conrelid = 'public.inventory'::regclass
  ) THEN
    ALTER TABLE public.inventory DROP CONSTRAINT inventory_sku_key;
  END IF;
END $$;

-- Ensure the composite unique index exists (should already exist from previous migration)
CREATE UNIQUE INDEX IF NOT EXISTS inventory_business_sku_idx
  ON public.inventory (business_id, sku);

COMMIT;
