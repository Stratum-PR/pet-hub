-- P0-06: client self-registration is broken in production. Register.tsx (main and dev) saves the client's
-- global record with `name`, and send-appointment-reminder selects it, but production's clients table no
-- longer has the column (it was dropped there directly, not by a repo migration). PostgREST rejects the
-- insert (PGRST204), so signups end with an auth account and no client record, and reminders are skipped.
--
-- Expand-only: an optional column, nothing reads it as required. No backfill (an UPDATE on every client
-- would also bump updated_at); first_name/last_name remain the source of truth.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.clients.name IS
  'Full display name as typed at signup (Register.tsx). Optional; first_name/last_name are authoritative.';

-- Make PostgREST see the column right away.
NOTIFY pgrst, 'reload schema';
