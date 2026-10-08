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
