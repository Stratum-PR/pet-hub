# Grumi fix log

One entry per change unit from [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), newest last. Each entry records what changed, the gate results before and after, how to roll back, and the production steps. Production steps are run by a person (Jovaniel), never by an agent session.

**How the gates are measured** (until P1-03/P1-05 add proper scripts):

| Gate | Command |
|---|---|
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` (count of `error TS`) and the same with `--strictNullChecks` |
| `as any` | `grep -roE '\bas any\b' src supabase/functions scripts --include=*.ts --include=*.tsx --include=*.mjs \| wc -l` |
| Lint | `npx eslint . --ignore-pattern ".test-env/**"` (`.test-env/` is the test stack's copy of the functions and isn't in the ESLint ignore list yet) |
| Unit tests | `npx vitest run` (on Windows set `SWC_NATIVE_BINDING_CACHE=<repo>/node_modules/.cache/swc-native`) |
| Build | `npm run build`; size of the largest `dist/assets/main-*.js` |
| Security | `npm run test:security` on the local stack (`npm run test:env:up` / `test:env:reset`) |
| Payments | `npm run test:payments` on the local stack |

---

## 2026-10-08 · P0-01 · Lock profile identity columns

**Status:** gates green on the local stack; committed on `remediation`. **Not applied to production.** Manual UI walkthrough: pending (Jovaniel).

**Problem.** The "Profiles update" policy lets any signed-in user update their own `profiles` row, including `role`, `business_id` and `staff_id`. A self-registered client could set `role = 'manager'` and any business's id (discoverable from its public booking slug) and then read and write that business's data. Two more paths to the same takeover:
- the "System can insert profiles" policy allows inserting your own row with any role or business;
- `set_profile_business_id(uuid, uuid)` is SECURITY DEFINER with no caller check. `20261006120000` revokes it from the API, but the local stack (built from a snapshot with no GRANT/REVOKE) still exposed it, and production's state is unverified (see P0-02).

**Change.**
- `supabase/migrations/20261008120000_lock_profile_identity_columns.sql`
  - Trigger `profiles_lock_identity_columns`, `BEFORE INSERT OR UPDATE` on `public.profiles`. For the `authenticated`/`anon` roles, unless the caller is a super admin:
    - UPDATE may not change `role`, `business_id` or `staff_id`;
    - INSERT may only create `role = 'client'` with no `business_id`, `staff_id` or `is_super_admin`.
  - `REVOKE ALL ON FUNCTION set_profile_business_id(uuid, uuid) FROM PUBLIC, anon, authenticated` (repeats `20261006120000`; idempotent).
  - Signup, invites and admin tools are unaffected: they run as SECURITY DEFINER functions (`handle_new_user`, `complete_manager_signup`, `admin_set_profile_role`) or with the service role (`accept-employee-invitation`, `support-begin-user-session`).
- `supabase/rollbacks/20261008120000_lock_profile_identity_columns.down.sql` (new folder).
- `scripts/test-env-security.mjs`, `npm run test:security`, `node scripts/test-env.mjs test security`, and a CI step in `.github/workflows/payments-test-env.yml`.

**Compatibility with `main` (shared database).** Expand-only. `main` and `dev` make the same profile writes (`AccountSettings` preference toggle, `Register.tsx` `{ role: 'client', full_name }`, the service-role invite function) and the same 2-argument `complete_manager_signup` call; all are covered by passing checks. Neither calls `set_profile_business_id` directly. One behavior change: a person with a pending staff invite who registers through the *client* form now gets an ignored error instead of being silently turned into a client.

**Gates.**

| Gate | Before | After |
|---|---|---|
| Typecheck | 82 errors (125 with `strictNullChecks`) | 82 (125), identical list |
| `as any` | 230 | 230 |
| Lint | 422 (345 errors, 77 warnings) | 422 (345, 77), 0 new |
| Unit tests | 102/102 | 102/102 |
| Build | OK, `main-*.js` 4,016,416 bytes | OK, 4,016,416 bytes |
| `test:security` | 14/21 (7 attacks/regressions open) | **21/21** |
| `test:payments` | 24/24 | 24/24 |
| Smoke E2E | does not exist yet (P1-07) | — |

Rollback tested on the local stack: apply → roll back (15/21; the RPC stays closed by design) → re-apply (21/21); both the migration and the rollback are idempotent.

**Notes for later units.**
- The local stack has no function privileges from production (the snapshot has no GRANT/REVOKE). P1-01 must capture privileges too.
- Super admins bypass this lock by design; who becomes a super admin is SECURITY_RISKS S-1.
- `complete_manager_signup(text)` (1-argument overload) assigns the `void` result of `set_profile_business_id` to a variable and is broken; neither frontend calls it. Removal is P2-06.

**Production steps (Jovaniel runs these; in this order).**
1. P0-02: run the exploitation check and review the results together **before** applying.
2. P0-04: take the backup and note its file name here: `__________`.
3. Apply in the Supabase SQL editor: paste the whole migration file and run it. **Do not use `supabase db push`**: production's migration history is incomplete (SECURITY_RISKS S-9), so `db push` would try to apply many old migrations.
4. Record it in the history, from the repo with the CLI linked to the project: `npx supabase migration repair --status applied 20261008120000`.
5. Verify in the SQL editor (read-only):
   ```sql
   select tgname, tgtype from pg_trigger where tgname = 'profiles_lock_identity_columns';  -- 1 row, tgtype 23
   select has_function_privilege('authenticated', 'public.set_profile_business_id(uuid,uuid)', 'execute');  -- false
   select has_function_privilege('anon', 'public.set_profile_business_id(uuid,uuid)', 'execute');           -- false
   ```
6. Smoke test on the **dev page with the QA business** (single-database rule 4): client sign-up, manager sign-up, employee invite, change your name in Account settings. Then open the production app and log in as a manager.
7. Watch for errors mentioning `profile_identity_columns_are_read_only` for 24 hours.

No frontend deploy is needed: no app code changed.

**Rollback (production).** Run `supabase/rollbacks/20261008120000_lock_profile_identity_columns.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261008120000`. This reopens the takeover; use it only if the lock breaks a legitimate flow.

**Tag:** `fix/P0-01` once applied to production.

---

## 2026-10-08 · P0-04 · Production backup procedure

**Status:** procedure and scripts rehearsed end to end on the local stacks; committed on `remediation`. **No production backup taken yet** (Jovaniel runs it, before P0-01 is applied).

**Problem.** The free plan has no downloadable backups, and a plain `supabase db dump` is not a complete backup of this project. The rehearsal showed a restore from the three standard dump files:
- loses the `auth.users` triggers (`on_auth_user_created` → `handle_new_user`, `on_auth_user_email_updated`): new signups would get no profile;
- loses the migration history (`supabase_migrations` is excluded);
- loses storage/auth RLS policies (bucket policies);
- **re-opens `set_profile_business_id` to `anon`/`authenticated`**: functions are re-created under the new project's default privileges, which pg_dump's REVOKE/GRANT lines don't undo;
- fails outright on two Supabase-managed objects (`GRANT SET ON PARAMETER log_min_messages`, `storage.buckets_vectors`/`vector_indexes`) that `postgres` may not write.

**Change.**
- `scripts/db-backup.mjs` (`npm run db:backup`): roles/schema/data dumps + `extras.sql` + `fingerprint.txt` + `manifest.json` (sha256). Read-only against the source (`default_transaction_read_only=on` for its own queries), connection string only from `GRUMI_DB_URL` (never on a command line or in output), refuses a backup folder inside the repo, runs the CLI without a shell.
- `scripts/db-backup/capture-extras.sql`: migration history, app triggers and policies on `auth`/`storage`, exact API-role privileges on every `public` function/table/sequence/column, all schema-qualified.
- `scripts/db-backup/fingerprint.sql`: counts and hashes of tables, policies, functions, triggers, RLS flags, realtime publication, migration history, privileges (order-normalized), and rows per table.
- `scripts/db-restore-check.mjs` (`npm run db:restore-check -- <folder>`): verifies checksums, restores into a throwaway local stack (`grumi-restore`, ports 55520-55529; takes no connection string), compares fingerprints; fails on any schema/privilege difference.
- `docs/BACKUP_RESTORE.md`: how to take, store, verify and restore a backup, including storage files.

**Rehearsal (local test stack as the source, with a storage bucket + policy + file and a realtime table added to mimic production).**

| Check | Result |
|---|---|
| Restore into an empty project, one transaction | ✓ committed |
| Schema, policies (public 183, storage 1), functions (71), triggers (public 27, auth 2, storage 7), RLS 54/54, privileges, publication, migration history | ✓ 0 differences |
| Rows | ✓ 302 rows across 91 tables, all equal |
| Restored DB through the API | ✓ signup creates a client profile; profile takeover blocked; `set_profile_business_id` not callable; data readable |
| Storage file download → upload into the restored project | ✓ sha256 identical |
| Tampered backup file / invalid URL / folder inside the repo | ✓ all rejected |

Not rehearsed against the hosted project (by rule): the Session pooler connection and `storage cp --project-ref`. The first production run will show whether they need adjusting.

**Gates.** No app or schema change: lint 422 → 422 (0 new; the new scripts have 0 problems), unit 102/102, `test:security` 21/21, `test:payments` 24/24 after a stack reset.

**Production steps (Jovaniel).** Follow `docs/BACKUP_RESTORE.md` → "Take a backup": `npm run db:backup` with the Session pooler string, copy the storage buckets, `npm run db:restore-check -- <folder>`, and record the backup ID in the P0-01 entry above. Paste me the output of both scripts (they print no secrets) if anything fails.

**Rollback.** Nothing to roll back: the scripts only read production.

---

## 2026-10-08 · P0-06 · Restore `clients.name` (client signup broken)

**Status:** gates green on the local stack; committed on `remediation`. **Not applied to production.** Found by P0-05; decision (Jovaniel, 2026-10-08): add the column back as optional.

**Problem.** `Register.tsx` (both `main` and `dev`) saves the client's global record with `clients.name`, and the `send-appointment-reminder` Edge Function selects it. Production's `clients` has `first_name`/`last_name` but no `name`: it was dropped directly in production (no repo migration drops it). PostgREST rejects the insert (`PGRST204 Could not find the 'name' column of 'clients'`), so a client signup creates the auth account and profile, then fails with no client record; the reminder's client lookup fails, so it skips every reminder as `no_client_email`.

**Change.**
- `supabase/migrations/20261008130000_restore_clients_name.sql`: `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS name text` (nullable, commented), then `NOTIFY pgrst, 'reload schema'`. No backfill (it would bump every client's `updated_at`).
- `supabase/rollbacks/20261008130000_restore_clients_name.down.sql`.
- `scripts/test-env-security.mjs`: `Register.tsx`'s exact clients insert, and the reminder's exact lookup.

**Compatibility with `main`.** Expand-only, and it fixes `main`'s signup without a deploy.

**Gates.**

| Gate | Before | After |
|---|---|---|
| Typecheck | 82 (125 strict) | 82 |
| `as any` | 230 | 230 |
| Lint | 422 (345/77) | 422 (345/77), 0 new |
| Unit tests | 102/102 | 102/102 |
| Build | 4,016,416 bytes | 4,016,416 bytes |
| `test:security` | 21/23 | **23/23** |
| `test:payments` | 24/24 | 24/24 |

Rollback tested: apply → roll back (21/23) → re-apply (23/23); the migration is idempotent.

**Follow-up (not in this unit).** Reminders greet `Hola ${client.name}`; clients created before this fix have no `name`, so they'd get "Hola " without a name. Small Edge Function change for later: fall back to `first_name`. Needs an Edge Function deploy, so it goes with the next functions release.

**Production steps (Jovaniel; after the P0-02 results and the P0-04 backup, can go with P0-01).**
1. Confirm the problem: in `scripts/prod-checks/p0-checks.sql`'s results, `P0-05 clients.name exists` is `false`. Note `P0-05 client profiles with no clients row` (people whose signup failed).
2. SQL editor: paste and run the migration file. Then `npx supabase migration repair --status applied 20261008130000`.
3. Verify: `select column_name, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'name';` returns `name | YES`.
4. Smoke test: on the production app, register a client with your own `+p006` email. It should finish without an error, and a `clients` row with that email should exist. Then delete that test account (Authentication → Users).
5. Decide what to do about the people in step 1's count. They have accounts but no client record; the next sign-in may or may not repair it. Look at it together.

**Rollback (production).** Run the `.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261008130000`. This breaks client signup again.

**Tag:** `fix/P0-06` once applied to production.
