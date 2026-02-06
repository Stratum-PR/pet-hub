-- Ensure every business-scoped table has a DEFAULT gen_random_uuid() on its `id` column.
-- This prevents "null value in column id" errors when the client doesn't send an id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  tbl TEXT;
  v_data_type TEXT;
BEGIN
  -- All tables that should have a UUID id default
  FOREACH tbl IN ARRAY ARRAY[
    'clients', 'customers', 'pets', 'services', 'employees', 'appointments',
    'time_entries', 'inventory', 'breeds', 'business_settings'
  ]
  LOOP
    -- Only alter if the table and column exist
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'id'
    ) THEN
      SELECT data_type
        INTO v_data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'id';

      IF v_data_type = 'uuid' THEN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()',
          tbl
        );
      ELSE
        -- TEXT or other type – cast to text
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text)',
          tbl
        );
      END IF;

      RAISE NOTICE 'Set id default for public.% (type: %)', tbl, v_data_type;
    ELSE
      RAISE NOTICE 'Skipping % – table or id column not found', tbl;
    END IF;
  END LOOP;
END $$;
