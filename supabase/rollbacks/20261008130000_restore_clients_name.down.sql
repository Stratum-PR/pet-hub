-- Rollback for 20261008130000_restore_clients_name.sql (P0-06).
-- WARNING: this breaks client self-registration again (Register.tsx writes clients.name) and drops any names
-- saved since the migration. Use only if the column itself causes a problem.
--
-- After running this on production, also delete the row from supabase_migrations.schema_migrations
-- (version '20261008130000'), or run: npx supabase migration repair --status reverted 20261008130000

ALTER TABLE public.clients DROP COLUMN IF EXISTS name;
NOTIFY pgrst, 'reload schema';
