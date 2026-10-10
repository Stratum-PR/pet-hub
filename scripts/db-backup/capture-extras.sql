-- READ-ONLY. Run against the database being backed up (psql -At). It prints SQL that restores what
-- `supabase db dump` leaves out, to be applied AFTER roles.sql + schema.sql + data.sql:
--   1. migration history (supabase_migrations is excluded from the dumps)
--   2. app triggers on auth/storage tables (e.g. on_auth_user_created -> handle_new_user)
--   3. RLS policies on auth/storage tables (e.g. pet-photos / business-logos bucket policies)
--   4. exact privileges of public functions, tables, views, sequences and columns. A restore re-creates
--      every function under the target's default privileges, which grant EXECUTE to anon/authenticated;
--      without this, a function revoked from the API (set_profile_business_id) becomes callable again.
-- Only SELECTs; nothing here changes the source database.

\pset footer off
\pset tuples_only on
\pset format unaligned

-- Empty search_path: every name below is printed schema-qualified, so the output works whatever search_path
-- the restore session has (schema.sql sets it to '').
SET search_path = '';

SELECT '-- Grumi post-restore extras, captured ' || now()::text || ' from ' || current_database();
SELECT 'SET check_function_bodies = off;';

-- 1. Migration history -------------------------------------------------------------------------
SELECT 'CREATE SCHEMA IF NOT EXISTS supabase_migrations;';
SELECT 'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY, statements text[], name text);';
SELECT format(
         'INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES (%L, %L, %L) ON CONFLICT (version) DO NOTHING;',
         version, statements, name)
FROM supabase_migrations.schema_migrations
WHERE to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
ORDER BY version;

-- 2. App triggers on auth/storage tables (trigger function lives in public) ------------------------
SELECT format('DROP TRIGGER IF EXISTS %I ON %s;', t.tgname, c.oid::regclass) || E'\n' || pg_get_triggerdef(t.oid) || ';'
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE n.nspname IN ('auth', 'storage') AND NOT t.tgisinternal AND pn.nspname = 'public'
ORDER BY 1;

-- 3. Policies on auth/storage tables ----------------------------------------------------------------
SELECT format('DROP POLICY IF EXISTS %I ON %I.%I;', policyname, schemaname, tablename) || E'\n'
       || format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s', policyname, schemaname, tablename, permissive, cmd,
                 (SELECT string_agg(CASE WHEN r = 'public' THEN 'PUBLIC' ELSE quote_ident(r) END, ', ') FROM unnest(roles) r))
       || coalesce(' USING (' || qual || ')', '')
       || coalesce(' WITH CHECK (' || with_check || ')', '')
       || ';'
FROM pg_policies
WHERE schemaname IN ('auth', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 4. Exact privileges for the API roles on public objects ---------------------------------------------
-- For each object: revoke everything from the API roles, then grant back exactly what the source has.
WITH api_roles AS (
  SELECT 0::oid AS oid, 'PUBLIC' AS name
  UNION ALL SELECT oid, quote_ident(rolname) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
),
objs AS (
  SELECT 'FUNCTION' AS kind, p.oid::regprocedure::text AS obj,
         coalesce(p.proacl, acldefault('f', p.proowner)) AS acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT CASE WHEN c.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, c.oid::regclass::text,
         coalesce(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 's' ELSE 'r' END::"char", c.relowner))
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
)
SELECT format('REVOKE ALL ON %s %s FROM PUBLIC, anon, authenticated, service_role;', o.kind, o.obj)
       || coalesce(E'\n' || (
            SELECT string_agg(format('GRANT %s ON %s %s TO %s;', a.privilege_type, o.kind, o.obj, r.name), E'\n' ORDER BY r.name, a.privilege_type)
            FROM aclexplode(o.acl) a JOIN api_roles r ON r.oid = a.grantee), '')
FROM objs o
ORDER BY o.kind, o.obj;

-- Column-level grants (none today; P2-03 may add some).
SELECT format('GRANT %s (%I) ON %s TO %s;', a.privilege_type, att.attname, c.oid::regclass,
              CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END)
FROM pg_attribute att
JOIN pg_class c ON c.oid = att.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(att.attacl) a
WHERE n.nspname = 'public' AND att.attacl IS NOT NULL AND NOT att.attisdropped
ORDER BY 1;
