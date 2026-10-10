-- Rollback for 20261008120000_lock_profile_identity_columns.sql (P0-01).
-- Removes the profile identity lock. This REOPENS the profile takeover: use only if the lock breaks a
-- legitimate flow, and re-apply a fixed version as soon as possible.
--
-- Deliberately NOT rolled back: the REVOKE on set_profile_business_id(uuid, uuid). It was already the
-- intended state (20261006120000); granting it back would reopen the same takeover through the API.
--
-- After running this on production, also delete the row from supabase_migrations.schema_migrations
-- (version '20261008120000') so the migration can be re-applied later.

DROP TRIGGER IF EXISTS profiles_lock_identity_columns ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_lock_identity_columns();
