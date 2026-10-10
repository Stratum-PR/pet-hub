-- READ-ONLY (a single SELECT; db-backup.mjs runs it with default_transaction_read_only=on).
-- A comparable summary of a Grumi database: run on the source when the backup is taken and on the restored
-- copy, then diff the two. `schema|` and `acl|` lines must match exactly; `rows|` lines can differ slightly
-- on a live database (each dump file is its own snapshot).

\pset footer off
\pset tuples_only on
\pset format unaligned
SET search_path = '';

WITH fp(section, item, value) AS (
  SELECT 'schema', 'tables:' || n.nspname, count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth', 'storage') AND c.relkind IN ('r', 'p')
  GROUP BY n.nspname

  UNION ALL
  SELECT 'schema', 'policies:' || schemaname,
         count(*)::text || ' md5=' || md5(string_agg(tablename || policyname || cmd || coalesce(qual, '') || coalesce(with_check, ''), '|' ORDER BY tablename, policyname))
  FROM pg_policies WHERE schemaname IN ('public', 'auth', 'storage') GROUP BY schemaname

  UNION ALL
  SELECT 'schema', 'functions:public',
         count(*)::text || ' md5=' || md5(string_agg(pg_get_functiondef(p.oid), '|' ORDER BY p.oid::regprocedure::text))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')

  UNION ALL
  SELECT 'schema', 'triggers:' || n.nspname,
         count(*)::text || ' md5=' || md5(string_agg(pg_get_triggerdef(t.oid), '|' ORDER BY c.relname, t.tgname))
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth', 'storage') AND NOT t.tgisinternal
  GROUP BY n.nspname

  UNION ALL
  SELECT 'schema', 'rls-enabled:public', count(*) FILTER (WHERE c.relrowsecurity)::text || '/' || count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')

  UNION ALL
  SELECT 'schema', 'migrations:history',
         (xpath('/row/v/text()', query_to_xml(
           'SELECT count(*)::text || '' latest='' || coalesce(max(version), ''-'') || '' md5='' || md5(string_agg(version || coalesce(name, '''') || coalesce(statements::text, ''''), ''|'' ORDER BY version)) AS v FROM supabase_migrations.schema_migrations',
           false, true, '')))[1]::text
  WHERE to_regclass('supabase_migrations.schema_migrations') IS NOT NULL

  UNION ALL
  SELECT 'schema', 'realtime-publication', coalesce(string_agg(schemaname || '.' || tablename, ',' ORDER BY schemaname, tablename), 'none')
  FROM pg_publication_tables WHERE pubname = 'supabase_realtime'

  UNION ALL
  -- ACL entries are sorted: a restore can list the same grants in a different order.
  SELECT 'acl', 'public:functions',
         md5(string_agg(p.oid::regprocedure::text || '=' || coalesce(array_to_string(ARRAY(SELECT x::text FROM unnest(p.proacl) x ORDER BY 1), ','), 'default'), '|' ORDER BY p.oid::regprocedure::text))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')

  UNION ALL
  SELECT 'acl', 'public:relations',
         md5(string_agg(c.oid::regclass::text || '=' || coalesce(array_to_string(ARRAY(SELECT x::text FROM unnest(c.relacl) x ORDER BY 1), ','), 'default'), '|' ORDER BY c.oid::regclass::text))
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')

  UNION ALL
  -- Key privilege check, readable without decoding the md5s.
  SELECT 'acl', 'authenticated can execute set_profile_business_id',
         has_function_privilege('authenticated', 'public.set_profile_business_id(uuid,uuid)', 'execute')::text
  WHERE to_regprocedure('public.set_profile_business_id(uuid,uuid)') IS NOT NULL

  UNION ALL
  SELECT 'rows', n.nspname || '.' || c.relname,
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth', 'storage') AND c.relkind IN ('r', 'p') AND has_table_privilege(c.oid, 'SELECT')
)
SELECT section || '|' || item || '|' || value FROM fp ORDER BY section, item;
