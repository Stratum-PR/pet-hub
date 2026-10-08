-- Phase 0 production checks (P0-02 exploitation, P0-01 pre-check, P0-05 migration history).
-- READ-ONLY: a single SELECT. Paste the whole file into Dashboard → SQL Editor and Run.
-- One row per check; `details` is JSON. Emails are masked (ab***@domain) so the result can be shared.
-- Export: "Download CSV" (or copy the rows) and paste it back to the session.

WITH
mask AS (
  SELECT p.id, left(p.email, 2) || '***@' || split_part(p.email, '@', 2) AS email_masked
  FROM public.profiles p
),
-- P0-02 signal 1: managers with none of the marks of a real manager signup
-- (complete_manager_signup sets businesses.owner_id = user, creates an admin staff row for them, links profiles.staff_id).
suspicious_managers AS (
  SELECT p.id, m.email_masked, p.role, p.business_id, b.name AS business_name,
         p.created_at AS profile_created, b.created_at AS business_created, p.updated_at AS profile_updated,
         (b.owner_id = p.id) AS is_owner,
         EXISTS (SELECT 1 FROM public.staff s WHERE s.business_id = p.business_id AND (s.user_id = p.id OR s.id = p.staff_id)) AS has_staff_row,
         u.raw_user_meta_data ->> 'role' AS signup_role,
         u.last_sign_in_at
  FROM public.profiles p
  JOIN mask m ON m.id = p.id
  JOIN public.businesses b ON b.id = p.business_id
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'manager'
    AND b.owner_id IS DISTINCT FROM p.id
    AND NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.business_id = p.business_id AND (s.user_id = p.id OR s.id = p.staff_id))
),
-- P0-02 signal 2: employees whose business doesn't match their staff row (or who have none).
suspicious_employees AS (
  SELECT p.id, m.email_masked, p.business_id, s.business_id AS staff_business, p.staff_id,
         p.created_at, p.updated_at
  FROM public.profiles p
  JOIN mask m ON m.id = p.id
  LEFT JOIN public.staff s ON s.id = p.staff_id
  WHERE p.role = 'employee' AND (s.id IS NULL OR s.business_id IS DISTINCT FROM p.business_id)
),
-- P0-02 signal 3: clients attached to a business (clients sign up with no business).
clients_with_business AS (
  SELECT p.id, m.email_masked, p.business_id, p.created_at, p.updated_at
  FROM public.profiles p JOIN mask m ON m.id = p.id
  WHERE p.role = 'client' AND p.business_id IS NOT NULL
),
-- P0-02 signal 4: profiles whose role is not what they signed up with (staff invites and admin changes are legitimate).
role_differs_from_signup AS (
  SELECT p.id, m.email_masked, p.role, u.raw_user_meta_data ->> 'role' AS signup_role, p.business_id,
         EXISTS (SELECT 1 FROM public.staff_invites si WHERE lower(si.email) = lower(p.email)) AS had_staff_invite,
         p.created_at, p.updated_at
  FROM public.profiles p
  JOIN mask m ON m.id = p.id
  JOIN auth.users u ON u.id = p.id
  WHERE p.is_super_admin IS NOT TRUE
    AND p.role IS DISTINCT FROM coalesce(nullif(u.raw_user_meta_data ->> 'role', ''), 'client')
)
SELECT 'P0-02.1 managers with no owner/staff link' AS check, count(*)::text AS result,
       coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.profile_updated DESC), '[]') AS details
FROM suspicious_managers x
UNION ALL
SELECT 'P0-02.2 employees with mismatched staff business', count(*)::text,
       coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC), '[]')
FROM suspicious_employees x
UNION ALL
SELECT 'P0-02.3 clients attached to a business', count(*)::text,
       coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC), '[]')
FROM clients_with_business x
UNION ALL
SELECT 'P0-02.4 role differs from signup role', count(*)::text,
       coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC), '[]')
FROM role_differs_from_signup x
UNION ALL
SELECT 'P0-02.5 profiles by role', count(*)::text,
       (SELECT jsonb_object_agg(coalesce(role, 'null'), n) FROM (SELECT role, count(*) n FROM public.profiles GROUP BY role) r)
FROM public.profiles
UNION ALL
SELECT 'P0-02.6 super admins (SECURITY_RISKS S-1c)', count(*)::text,
       coalesce(jsonb_agg(jsonb_build_object('email', m.email_masked, 'role', p.role, 'created_at', p.created_at) ORDER BY p.created_at), '[]')
FROM public.profiles p JOIN mask m ON m.id = p.id
WHERE p.is_super_admin IS TRUE
UNION ALL
-- P0-01 pre-check: which hole is open in production today.
SELECT 'P0-01 set_profile_business_id callable by API roles',
       (has_function_privilege('anon', 'public.set_profile_business_id(uuid,uuid)', 'execute')
        OR has_function_privilege('authenticated', 'public.set_profile_business_id(uuid,uuid)', 'execute'))::text,
       jsonb_build_object(
         'anon', has_function_privilege('anon', 'public.set_profile_business_id(uuid,uuid)', 'execute'),
         'authenticated', has_function_privilege('authenticated', 'public.set_profile_business_id(uuid,uuid)', 'execute'))
UNION ALL
SELECT 'P0-01 identity-lock trigger present', (count(*) > 0)::text,
       coalesce(jsonb_agg(jsonb_build_object('trigger', tgname, 'tgtype', tgtype)), '[]')
FROM pg_trigger WHERE tgname = 'profiles_lock_identity_columns'
UNION ALL
SELECT 'P0-01 profiles policies', count(*)::text,
       jsonb_agg(jsonb_build_object('name', policyname, 'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check) ORDER BY policyname)
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
UNION ALL
SELECT 'P0-01 profiles triggers', count(*)::text,
       jsonb_agg(jsonb_build_object('name', t.tgname, 'function', p.proname) ORDER BY t.tgname)
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.profiles'::regclass AND NOT t.tgisinternal
UNION ALL
-- P0-05: objects both main's and dev's code use that the schema snapshot says production lacks.
-- Register.tsx inserts clients.name (client signup) and send-appointment-reminder selects it.
SELECT 'P0-05 clients.name exists (client signup + reminders need it)',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name')::text,
       (SELECT jsonb_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name LIKE '%name%')
UNION ALL
SELECT 'P0-05 dispatch_staff_missing_email_reminders exists (staffBirthdayDispatch.ts)',
       EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'dispatch_staff_missing_email_reminders')::text,
       NULL::jsonb
UNION ALL
-- Client accounts created without a client record: the footprint of the broken signup.
SELECT 'P0-05 client profiles with no clients row (failed signups)', count(*)::text,
       jsonb_build_object('since_2026_04_01', count(*) FILTER (WHERE p.created_at >= '2026-04-01'),
                          'newest', max(p.created_at))
FROM public.profiles p
WHERE p.role = 'client' AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.profile_id = p.id)
UNION ALL
-- P0-05: production's recorded migration history.
SELECT 'P0-05 migration history', count(*)::text,
       jsonb_agg(jsonb_build_object('version', version, 'name', name) ORDER BY version)
FROM supabase_migrations.schema_migrations;
