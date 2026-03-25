-- App updates set updated_at on transactions; PostgREST errors if the column is missing from the table.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.transactions
      ADD COLUMN updated_at timestamptz DEFAULT now();

    UPDATE public.transactions
    SET updated_at = created_at
    WHERE updated_at IS NULL;

    COMMENT ON COLUMN public.transactions.updated_at IS 'Last modification time (set by the app on UPDATE).';
  END IF;
END $$;
