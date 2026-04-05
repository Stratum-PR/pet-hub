-- Run in Supabase Dashboard → SQL Editor after creating or altering tables.
-- PostgREST will pick up the new schema (fixes "Could not find the table ... in the schema cache").
NOTIFY pgrst, 'reload schema';
