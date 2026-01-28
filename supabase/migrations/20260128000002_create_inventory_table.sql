BEGIN;

-- Create inventory table for per-business product tracking
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Basic Product Info
  sku VARCHAR(100) UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  brand VARCHAR(100),

  -- Pricing
  cost_price DECIMAL(10, 2),
  retail_price DECIMAL(10, 2) NOT NULL,
  sale_price DECIMAL(10, 2),

  -- Inventory Tracking
  quantity_on_hand INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,

  -- Product Details
  unit_of_measure VARCHAR(50) DEFAULT 'unit',
  barcode VARCHAR(100),
  supplier VARCHAR(255),

  -- Notes
  notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure each business has at most one row per SKU
CREATE UNIQUE INDEX IF NOT EXISTS inventory_business_sku_idx
  ON public.inventory (business_id, sku);

-- Simple trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_inventory_updated_at_trigger'
  ) THEN
    CREATE TRIGGER set_inventory_updated_at_trigger
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.set_inventory_updated_at();
  END IF;
END;
$$;

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access inventory from their business
CREATE POLICY "Users can access inventory from their business"
  ON public.inventory
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage inventory from their business"
  ON public.inventory
  FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  );

COMMIT;

