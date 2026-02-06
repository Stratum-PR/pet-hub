-- ============================================
-- Ensure public.clients.id has a DEFAULT UUID
-- ============================================
-- Some environments (especially older/prod) may have clients.id as NOT NULL without a default,
-- causing inserts to fail unless the client provides an id.
-- This migration makes inserts work by ensuring a default exists.

-- gen_random_uuid() is provided by pgcrypto (enabled by default on Supabase).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_data_type TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'id'
  ) THEN
    SELECT data_type
      INTO v_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'id';

    IF v_data_type = 'uuid' THEN
      EXECUTE 'ALTER TABLE public.clients ALTER COLUMN id SET DEFAULT gen_random_uuid()';
    ELSE
      -- If id is text/varchar in an older schema, default to UUID text.
      EXECUTE 'ALTER TABLE public.clients ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text)';
    END IF;
  END IF;
END $$;

