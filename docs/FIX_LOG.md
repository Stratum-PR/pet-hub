# Grumi fix log

One entry per change unit from [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), newest last. Each entry records what changed, the gate results before and after, how to roll back, and the production steps. Production steps are run by a person (Jovaniel), never by an agent session.

**Tags.** When a unit reaches production, tag the commit that was applied: `git tag fix/<unit ID>` (e.g. `fix/P0-01`), and write the backup ID in its entry. A unit that is only committed or merged has no tag. `npm run check` runs the typecheck and lint ratchets and vitest.

**How the gates are measured** (until P1-03/P1-05 add proper scripts):

| Gate | Command |
|---|---|
| Typecheck | `npm run typecheck:ratchet` (fails on any error not in `scripts/typecheck-baseline.json`); counts from `npx tsc -p tsconfig.app.json --noEmit`, and the same with `--strictNullChecks` |
| `as any` | `grep -roE '\bas any\b' src supabase/functions scripts --include=*.ts --include=*.tsx --include=*.mjs \| wc -l` |
| Lint | `npm run lint:ratchet` (fails on any problem not in `scripts/lint-baseline.json`); counts from `npx eslint .` (`.test-env/` is ignored since P1-05) |
| Unit tests | `npx vitest run` (projects `unit` = Node, `*.test.ts`; `dom` = jsdom, `*.test.tsx`). Since P1-06 no environment variable is needed on Windows. |
| Build | `npm run build`; size of the largest `dist/assets/main-*.js` |
| Security | `npm run test:security` on the local stack (`npm run test:env:up` / `test:env:reset`) |
| Payments | `npm run test:payments` on the local stack |
| Smoke E2E | `npm run test:e2e` on the local stack (since P1-07; first time: `npx playwright install chromium`). Reports "N passed" including known-failing tests marked `test.fail()` |

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

---

## 2026-10-08 · P1-06 · Vitest config (jsdom + setup) and the Windows SWC fix

**Status:** done on `remediation` (local only; no production impact).

**Problem.** (1) On Windows, `vite`, `vitest` and `vite build` failed with "Failed to load native binding" unless `SWC_NATIVE_BINDING_CACHE` was set by hand: `@swc/core` 1.16 unpacks its native addon into `%LOCALAPPDATA%swc` on first load, and that folder's permissions are rejected. (2) Tests ran only in Node, so component tests were impossible (`document is not defined`).

**Change.**
- `scripts/vite-swc-cache.ts`: defaults `SWC_NATIVE_BINDING_CACHE` to `node_modules/.cache/swc-native` (an explicit value still wins). Imported by `vite.config.ts`, which now loads `@vitejs/plugin-react-swc` lazily: Vite bundles the config and hoists package imports above local code, so a plain import ran too late. The config function is `async` and typed `Promise<UserConfig>`; nothing else in the config changed.
- Vitest projects: `unit` (Node, `src/**/*.test.ts`, the existing 102 tests) and `dom` (jsdom, `src/**/*.test.tsx`, setup `src/test/setup-dom.ts` with jest-dom matchers and cleanup).
- Dev dependencies: `jsdom@26.1.0`, `@testing-library/react@16.3.0`, `@testing-library/dom@10.4.0`, `@testing-library/jest-dom@6.6.3`. The lockfile diff is additions only (npm 10.9.2 dropped the `libc` tags of 40 optional native packages; they were restored so Linux CI keeps installing only the matching binaries).
- `src/components/ui/button.test.tsx`: first component test (2 cases), proves the `dom` project works.

**Gates** (all run **without** `SWC_NATIVE_BINDING_CACHE`).

| Gate | Before | After |
|---|---|---|
| `vitest run` without the env var | fails to start | **104/104** (102 unit + 2 dom) |
| Typecheck app / node config | 82 / 0 | 82 / 0 |
| Lint | 422 (345/77) | 422 (345/77), 0 new |
| Build | OK, 4,016,416 bytes (with env var) | OK, 4,016,416 bytes (without) |
| Dev server | needed env var | serves and transforms TSX without it |
| `test:security` / `test:payments` | 23/23 / 24/24 | 23/23 / 24/24 |

**Rollback.** Revert the commit (no database or production change).

---

## 2026-10-08 · P1-03 (stage 1) · Typecheck scripts and ratchet

**Status:** done on `remediation`. Stage 2 (fixing errors) not started; see docs/REMEDIATION_STATUS.md.

**Change.** `npm run typecheck` (app + node configs; fails today, 82 errors), `npm run typecheck:ratchet` (`scripts/typecheck-ratchet.mjs` + `scripts/typecheck-baseline.json`: fails on any error not in the baseline, keyed by file + code + message so line moves don't count; `--update` only shrinks it), `npm run check` (ratchet + vitest).

**Gates.** Ratchet: 82 known, none new; a deliberately added error is caught (exit 1). `npm run check` passes (104/104). Lint 0 problems in the new script. No app code changed.

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-03 (stage 2) · Fix the type-only TypeScript errors (82 → 43)

**Status:** done on `remediation`. Decision (Jovaniel): fix only errors that can't change runtime behavior now; real bugs get their own units after P1-07; the duplicate data hooks are fixed in P3-03.

**Change** (types and casts only; 14 files):
- `ValidationResult` (businessValidation, transactionValidation) and `UpdateTransactionResult`: the success variant gets `error?: undefined`. With `strictNullChecks` off TypeScript can't narrow these unions, so every `result.error` was an error (≈20 errors); this keeps narrowing correct once strict mode is on.
- `window.setTimeout`/`setInterval` handles typed `number` (they were typed as Node's `Timeout`).
- Supabase rows whose generated types are missing or wrong: `as unknown as X` / `as never` instead of single casts (useStaff, useTimeKiosk, useTransactions, ClientPortalPublicPage, AccountSettings, demoManagerBirthdaySync).
- `Service.is_active?` added to `src/types/index.ts` (the column exists; TransactionCreate filters on it).
- `BusinessLayout`: the query's `.then()` returns a native Promise at runtime (postgrest-js `then` wraps an async function), so `.catch` works; cast to `Promise<void>` for the type.
- `translations.ts`: removed the second, identical copy of `employeeManagement.statusActiveShort`/`statusInactiveShort`.

**Proof of no behavior change.** With every edit except the translations dedupe, `npm run build` produced a **byte-identical** bundle (sha256 of all 12 JS/CSS/HTML files). The dedupe changes only the main chunk (−136 bytes: exactly the duplicate pair), plus `index.html` and `index.es-*.js`, which differ only in the main chunk's file name.

**Gates.**

| Gate | Before | After |
|---|---|---|
| TypeScript errors (ratchet baseline) | 82 | **43** |
| With `strictNullChecks` | 125 | 104 |
| `as any` | 230 | 230 |
| Lint | 422 (345/77) | 422 (345/77) |
| vitest | 104/104 | 104/104 |
| Build | 4,016,416 bytes | 4,016,280 bytes |
| `test:security` / `test:payments` | 23/23 / 24/24 | 23/23 / 24/24 |

**Remaining 43, by where they get fixed.**
- **P3-03 (data hook merge), 30:** `useSupabaseData` 10, `useBusinessData` 8, `Index.tsx` 8, `Pets.tsx` 2, `Clients.tsx` 2.
- **P3-01/P3-02 (orphan and legacy files), 5:** `DaycareCalendarView` 2, `KioskManagerAccess` 1, `BusinessServices` 2.
- **Likely real bugs, own units after P1-07, 8:** `Admin.tsx` service handlers return nothing where callers expect the saved record (3); `TimeKiosk` compares with a `'clocking'` state that doesn't exist, so "processing" never shows (1); `Landing` passes `showRegisterAccountButton` that `LoginForm` doesn't accept (1); `Register.tsx:933` passes `className` to a component without props (1); `staffBirthdayDispatch` calls an RPC production doesn't have (1); `qrCode.ts` uses `String.replaceAll`, missing on the Safari 12/13.0 the build targets (1).

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-05 · Lint ratchet

**Status:** done on `remediation`.

**Change.** `scripts/lint-ratchet.mjs` + `scripts/lint-baseline.json` (`npm run lint:ratchet`): fails on any ESLint problem not in the baseline, keyed by file + rule + message (no line numbers); `--update` only shrinks it. `.test-env` added to the ESLint ignores (the test stack's copy of the functions added 6 problems whenever it had run). `npm run check` = typecheck ratchet + lint ratchet + vitest.

**Gates.** Baseline 422 (345 errors, 77 warnings), unchanged. A deliberate new `any` fails the ratchet (exit 1), which is the plan's "done" condition (CI wiring is P1-04). `npm run check` passes.

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-09 · PR template and tags

**Status:** done on `remediation`.

**Change.** `.github/pull_request_template.md` with the §2 gate checklist (before → after table, database/Edge Function checklist including §9 rule 1, FIX_LOG and tag steps). Tag convention at the top of this file: `fix/<unit ID>` once a unit is applied to production.

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-07 · Smoke E2E with Playwright (9 flows)

**Status:** done on `remediation`. 8 flows green; flow 5 (checkout) and one extra check (4b) are **known-failing** on real bugs found by this unit (E2E-1, E2E-2), marked `test.fail()` so the suite stays green and each fix flips its test. CI wiring is P1-04.

**Change.**
- `@playwright/test` 1.56.1 (dev dependency; Chromium only). `package-lock.json` gets only the 4 Playwright entries: local npm (10 and 11 on Windows) rewrites the lockfile's `libc`/`peer` fields, so the entries were spliced into the existing file and checked with `npm ci --dry-run`.
- `playwright.config.ts`: runs the real app (Vite dev server on port 55440) with `VITE_SUPABASE_URL`/`_PUBLISHABLE_KEY` pointed at the local test stack; one worker, in order; locale `es-PR`, time zone `America/Puerto_Rico`; HTML report in `reports/e2e`, traces on failure in `test-results/` (both ignored).
- `npm run test:e2e` → `node scripts/test-env.mjs e2e`: reads the stack's URL and keys from `supabase status` (like `test:security`) and runs Playwright. The seed refuses any API that isn't the local stack.
- `e2e/seed.ts` (global setup, a fresh business per run): the manager signs up through the real `complete_manager_signup` RPC (pro tier; business, subscription, profile and owner staff row come from production code), plus a service, two clients (one linked to a portal login), pets, two hourly employees with kiosk PINs, a 6-digit kiosk manager PIN, three appointments shaped like the ones `BookingFormDialog` writes, and two closed 4 h shifts. Credentials are generated per run and written only to the ignored `test-results/e2e-seed.json`.
- The seed also writes **global reference data the local stack lacks** (the snapshot has schema, no data): `feature_catalog`/`feature_rollout`/`feature_visibility_rules` rows that show the appointment book, transactions, payments, inventory and booking settings to managers on `pro`, and three `breeds` (the pet form requires a breed). Local stack only.
- `e2e/fixtures.ts`: login through the real form, dismisses the cookie banner ("Rechazar todas") whenever it appears, date pickers, a service-role client for DB checks.
- `tsconfig.node.json` now includes `playwright.config.ts` and `e2e/`, so the typecheck gate covers the suite (strict).

**The flows** (`e2e/01…09-*.spec.ts`):

| # | Flow | Checks |
|---|---|---|
| 1 | Manager login → dashboard | URL `/<slug>/dashboard`, user menu, "Personal Activo 3" |
| 2 | Create client + pet | inline client form, pet with species + breed; still on the card after reload |
| 3 | Book an appointment | "Nueva cita": existing client, service, groomer, tomorrow 11 AM, total $45.00; calendar block + history row |
| 4 | Edit / cancel | reschedule 2 PM → 3 PM through "Editar / reprogramar" (browser clock pinned to 08:00), then "Cancelar cita" → "Cancelada" |
| 4b | **known issue E2E-2** | same dialog at 20:00 must open on the appointment's date |
| 5 | **known issue E2E-1** — checkout | "Cobrar": $45.00 + 10.5% + 1% = $50.18, cash, "Pagado"; TXN row Paid/Cash; appointment "Pagado". Passes in full with E2E-1 patched locally |
| 6 | Kiosk clock-in/out | PIN → off-schedule warning → "Ponchar" → "Salir"; one closed `time_entries` row in the DB |
| 7 | Payroll totals | "Cálculo de pagos": Eli $12.00 × 8.00 h = $96.00; TOTALS 8.00 / $96.00 |
| 8 | Client portal | portal login sees own name, pet and appointment, not another client's pet |
| 9 | Public booking | `/<slug>/reservar` request (service, any groomer, day +2 10 AM) → "Solicitud enviada"; manager sees it under "Solicitudes en línea 1" with $45.00 |

**Scope note, flow 8.** The plan says "client portal booking", but the portal has no booking action (`booking_source = 'portal'` exists in the schema and nothing writes it); clients book through `/<slug>/reservar`, which flow 9 covers. Flow 8 covers what the portal does today. If portal booking is meant to exist, that's a feature, not a remediation unit.

**Findings (real bugs; each gets its own unit unless noted).**
- **E2E-1 (high, `dev` only).** `/transactions/new`, "Cobrar" on any appointment and the header Quick charge crash the whole app ("App failed to start": ``cannot add `postgres_changes` callbacks … after `subscribe()` ``). `useInventory` opens channel `inventory-rt-<business>`; `Index` and `QuickChargeDialog`/`TransactionCreate` both mount it, and since `9ca7835` (2026-10-06, realtime-js 2.93.2 → 2.117.2) `supabase.channel()` returns the existing, already-subscribed channel for the same topic. `8543663` (2026-10-07) then put "Cobrar" on every appointment. `main` still locks 2.93.2, so production is probably unaffected (not verified). `useTransactions` and both appointment hooks use the same fixed-name pattern, so they carry the same risk if two instances ever mount together (not observed in these flows). Fix: unique channel name per hook instance. Flips flow 5.
- **E2E-2 (medium, data).** `EditAppointmentDialog` starts `selectedDate` at "now". On the first open after page load, its auto-jump effect runs in the same commit as the initialization, sees the stale date, and when today has no bookable slot left (evenings, or an appointment earlier today) queues "tomorrow" after the real date. The dialog then shows the wrong date, and saving reschedules the appointment. Flips 4b.
- **E2E-3 (low).** `/<slug>/appointments` and `/<slug>/calendar` render a blank page when the feature is hidden: `<Navigate to="dashboard">` is relative, so it goes to `/appointments/dashboard`, which matches nothing.
- **E2E-4 (low, check with Genesis).** Transaction numbers look global: this business's first sale was TXN-00009 on a stack with other businesses' sales, which leaks the platform's sale count across tenants.
- **E2E-5 (low, UX).** The portal lists appointments raw ("2026-10-13 10:00:00 · scheduled", no pet, English status); the edit dialog is in English; online requests show species as "Unknown".
- **Production config is unknown to the repo.** Feature visibility for every business comes from the `feature_rollout`/`feature_visibility_rules` rows, which exist only in production. With the migrations' last-known values (`development` tier), ordinary managers would not see the appointment book. P1-01 should capture this reference data (and `breeds`) along with the schema.

**Gates.**

| Gate | Before | After |
|---|---|---|
| TypeScript errors (ratchet) | 43 | 43 (now also covers `e2e/`, 0 there) |
| Lint | 422 | 422 |
| vitest | 104/104 | 104/104 |
| Build (main chunk) | 4,016,280 bytes | 4,016,280 bytes (no app code changed) |
| `test:security` / `test:payments` | 23/23 / 24/24 | 23/23 / 24/24 |
| Smoke E2E | — | **10 passed** (8 green + 2 known-failing), 3 fresh runs in a row plus 1 in `CI=1` mode (own server, retries on, none used) |

**Rollback.** Revert the commit (removes the dev dependency and the `e2e/` folder). The seed's rows live only on the local test stack (`npm run test:env:reset` wipes them).

---

## 2026-10-08 · E2E-1 · Realtime channel crash on Cobrar / Quick charge / Nueva transacción

**Status:** done on `remediation`. Frontend only: reaches users with the next deploy of `dev` (dev.grumi.pet is affected today). Nothing to run in production.

**Problem** (found by P1-07). Four hooks subscribe a realtime channel with a fixed name: `useInventory` (`inventory-rt-<business>`), `useTransactions` (`transactions-rt-…`), `useSupabaseData.useAppointments` (`appointments-rt-…`) and `useBusinessData.useAppointments` (`appointments-rt-biz-…`). Since `9ca7835` (realtime-js 2.117.2), `supabase.channel()` returns the existing channel for a topic that's already open, and `.on()` on it throws once it's subscribed. Any screen that mounts a second copy crashed the whole app ("App failed to start"):
- "Cobrar" on an appointment and the header "Cobrar": `QuickChargeDialog` → second `useInventory` (and `useTransactions` over Dashboard, Clients, Pets, Reports).
- `/transactions/new`: `TransactionCreate` → second `useInventory` and second `useSupabaseData.useAppointments`.

**Change.**
- `src/lib/realtimeChannel.ts`: `uniqueChannelName(base)` appends a per-subscription counter.
- The four hooks call it inside the subscribing effect (one line each). Each instance gets its own channel and removes it on cleanup, as before; the subscription filters are unchanged.

**Tests.**
- New `src/hooks/realtimeChannels.test.tsx` (dom): a fake Supabase client that reuses channels by topic and throws like realtime-js 2.117; mounting each of the 4 hooks twice. Before: 4/4 fail with the production error. After: 4/4 pass.
- E2E: flow 5 (checkout) loses its known-issue marker; new 5b (`/transactions/new` opens) and 5c (header "Cobrar" over the dashboard). With the four hook files reverted, 5 and 5b fail; with the fix, all pass.

**Gates.**

| Gate | Before | After |
|---|---|---|
| TypeScript errors (ratchet) | 43 | 43 |
| Lint | 422 | 422 |
| vitest | 104/104 | 108/108 |
| Build (main chunk) | 4,016,280 bytes | 4,016,367 bytes (+87: the helper) |
| `test:security` / `test:payments` | 23/23 / 24/24 | 23/23 / 24/24 |
| Smoke E2E | 10 passed (8 green + 2 known-failing) | 12 passed (11 green + 1 known-failing: 4b, E2E-2), twice |

**Rollback.** Revert the commit (the crash comes back on `dev`).

---

## 2026-10-08 · E2E-2 · Edit dialog opened on the wrong date (saving rescheduled)

**Status:** done on `remediation`. Frontend only: ships with the next `dev` deploy; nothing to run in production.

**Problem** (found by P1-07). `EditAppointmentDialog` keeps `selectedDate` in state, starting at "now". When it opens, the init effect sets the appointment's date and time, but the auto-jump effect (move to the next day with a free slot) and the slot-fallback effect run in the same commit and still see the old state. Two ways it went wrong:
- **First open after page load, in the evening:** the stale "now" has no bookable slot left, so auto-jump queued "tomorrow" after the init's real date. The dialog showed tomorrow, and saving even a notes-only change moved the appointment there.
- **Appointment earlier today** (any open): its own slots are past, so auto-jump always moved it to tomorrow.

**Change** (`src/components/EditAppointmentDialog.tsx`, +20 lines):
- The init effect records the date/time it set (`pendingInitRef`); auto-jump and slot fallback skip while state hasn't caught up, and the slot-fallback effect clears the marker once both values have landed (also cleared on close).
- Auto-jump never moves an existing appointment off its own day by itself. The user can still pick any day; past-slot rules are unchanged.

**Tests** (E2E, browser clock pinned so they don't depend on when CI runs):
- 4b (20:00, first open): opens on the appointment's date with its 2 PM slot selected; a notes-only save keeps it at 2 PM on that day. Now uses its own seeded appointment (`inspect`, day +4): as a known-failing test it had shared flow 4's appointment, which flow 4 moves and cancels, so it was failing for the wrong reason too.
- 4c (20:00, appointment at 9 AM today): opens on today.
- With the dialog change reverted, 4b and 4c fail; with it, both pass. Flow 4 (reschedule + cancel at 08:00) unchanged and green.

**Gates.**

| Gate | Before | After |
|---|---|---|
| TypeScript errors (ratchet) | 43 | 43 |
| Lint | 422 | 422 |
| vitest | 108/108 | 108/108 |
| Build (main chunk) | 4,016,367 bytes | 4,016,637 bytes |
| `test:security` / `test:payments` | 23/23 / 24/24 | 23/23 / 24/24 |
| Smoke E2E | 12 passed (11 green + 1 known-failing) | **13 passed, 0 known-failing**, twice |

**Rollback.** Revert the commit.

---

## 2026-10-08 · E2E-3 · Blank page when a hidden feature's route is opened

**Status:** done on `remediation`. Frontend only; ships with the next `dev` deploy.

**Problem** (found by P1-07). In `Index.tsx`, a route whose feature is hidden redirects with `<Navigate to="dashboard">`. React Router v6 resolves that relative to the route, so `/<slug>/appointments` went to `/<slug>/appointments/dashboard`, which matches nothing: an empty page with only the header. Confirmed for a manager on a plan without the features: `/appointments`, `/calendar`, `/appt-book` (and `/appt-book/*`), `/inventory`, `/payment`. The transaction routes already used `"../dashboard"` and worked; `/transactions` only worked by falling through to the detail route's guard.

**Change** (`src/pages/Index.tsx`, 8 lines): every gated route redirects with `"../dashboard"` (parent-relative, like the transaction routes); the employee redirect on `dashboard` uses `"../clients"` (employees were already sent to clients by another guard, so no visible change there). The index route's `"dashboard"` is correct as is.

**Tests.**
- Seed: a second business on `basic` (the seeded visibility rules show these features to `pro` only) and a login for employee Eli, linked to his staff row the way an accepted invite links it.
- E2E 10: the basic-plan manager opens 8 gated paths and lands on `/<slug>/dashboard` each time. Fails before the change (`…/appointments/dashboard`), passes after.
- E2E 10b: an employee opening `/dashboard` lands on `/clients`.

**Gates.** tsc 43 · lint 422 · vitest 108/108 · build OK (main 4,016,661 bytes) · `test:security` 23/23 · `test:payments` 24/24 · smoke E2E **15/15**, twice.

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-03 bug · QR code generation fails on Safari 12 / iOS 12

**Status:** done on `remediation`. Frontend only; ships with the next `dev` deploy.

**Problem** (one of P1-03's 8 "likely real bugs"). `escapeXml` in `src/lib/qrCode.ts` used `String.prototype.replaceAll`. The build targets `safari12`/`ios12`, which don't have it (added in Safari 13.1), and Vite/esbuild lowers syntax but doesn't polyfill methods. On those devices, generating a business portal QR code (SVG or PNG) threw `value.replaceAll is not a function`. It's the only `replaceAll` in `src`.

**Change.** `.replace(/x/g, …)` for the five escapes; same output.

**Tests.** New `src/lib/qrCode.test.ts`: deletes `String.prototype.replaceAll` (as on Safari 12) and generates a branded QR whose logo URL needs escaping. Fails before (`TypeError`), passes after.

**Gates.** tsc **43 → 42** (baseline updated) · lint 422 · vitest 109/109 · build OK (main 4,016,651 bytes) · `test:security` 23/23 · `test:payments` 24/24 · smoke E2E 15/15.

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-03 follow-up · The other "likely real bugs", checked one by one

**Status:** done on `remediation`. Of P1-03's 8 "likely real bugs", only the QR code one was a user-visible bug (fixed above). The rest, after reading the code:

| Item | Verdict | Action |
|---|---|---|
| `TimeKiosk` compares `state === 'clocking'` (no such state) | Dead line: the clock button already shows "processing" and is disabled while `loading` | Line removed. No visible change |
| `Landing` passes `showRegisterAccountButton` to `LoginForm` | `LoginForm` never had the prop; only passed on localhost (registration is localhost-only), and `LoginForm` already links to sign-up | Prop removed. No visible change |
| `Register.tsx:933` `className` on the species icon | Type only: lucide icons accept `className`; the option type said `ComponentType` with no props | Type is `ComponentType<{ className?: string }>` |
| `Admin.tsx` service handlers (3 errors) | **Not reachable:** `src/pages/Admin.tsx` is imported nowhere (no route, no lazy import); `/admin` renders `AdminDashboard` | Moved to P3-01 (orphan files); delete it there |
| `staffBirthdayDispatch` calls `dispatch_staff_missing_email_reminders` | The function's migration (`20260328103000`) never reached production (P0-05) or the local stack; the call fails quietly (warning) on every run | **Decision for Jovaniel** (OWNER_ACTIONS C5): turn the feature on (re-issue the migration with a security test, apply in production) or remove the call |

**Gates.** tsc **42 → 39** (baseline updated) · lint 422 · vitest 109/109 · build OK (main 4,016,581 bytes) · `test:security` 23/23 · `test:payments` 24/24 · smoke E2E 15/15 (flow 6 exercises the kiosk).

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-11 · Repo hygiene

**Status:** done on `remediation`.

**Change.**
- `.env`: already untracked before this unit (only `.env.example` is in git, and `.gitignore` covers `.env*`). Nothing to do.
- `supabase/.temp/` (8 CLI link files: project ref, pooler host, service versions): untracked with `git rm --cached`; the local copies stay (the CLI link needs them) and `.gitignore` already lists the folder. Checked first: `pooler-url` holds no password, so nothing secret was in history.
- `types/database.types.ts` deleted: UTF-16, imported nowhere (the app uses `src/integrations/supabase/types.ts`), and ESLint couldn't parse it.

**Done-when check.** `git ls-files` lists no `.env`, `supabase/.temp/` or `database.types.ts`.

**Gates.** tsc 39 · lint **422 → 421** (the file's parse error; baseline updated) · vitest 109/109 · build byte-size unchanged (4,016,581) · `test:security` 23/23 · `test:payments` 24/24 · smoke E2E 15/15.

**Note for teammates.** After pulling this, git deletes nothing locally (the files were only untracked), but anyone who checks out a commit *before* it gets the old `.temp` files back; harmless.

**Rollback.** Revert the commit.

---

## 2026-10-08 · P1-08 · Security suite: confirmed issues as known-failing checks

**Status:** done on `remediation`. No app or schema change.

**Change** (`scripts/test-env-security.mjs`).
- `known(label, blocked)`: an attack that still works is reported as `○ known issue` without failing the run. Once a fix blocks it, the run **fails** with "now BLOCKED: move it from known() to check()", so a fixed hole becomes a permanent regression check and nothing stays "expected" silently.
- The summary prints `N known issue(s) open`.
- New section, run as a real employee login against fresh rows in a new business: 9 attacks.

| Attack (employee in their own business) | Today | Fixed by |
|---|---|---|
| Read a coworker's kiosk PIN | **works** | P2-02 |
| Raise their own hourly rate | **works** | P2-03 |
| Give themselves admin access | blocked (trigger `staff_enforce_access_role_mutations`) | → regular check |
| Change a coworker's pay rate | **works** | P2-01 staff |
| Change the business's plan (`subscription_tier`) | **works** | P2-01 businesses / SECURITY_RISKS S-7 |
| Delete an appointment / a pet / a client | **works** (3) | P2-01 appointments / pets / clients |
| Delete a coworker's staff row | **works** | P2-01 staff |

Note for P2-01: whether employees should be allowed to delete clients, pets or appointments is a product rule; the tests assume "no" (managers only). If the decision is different, change the test with the policy.

**Gates.** `test:security` 24 checks ✓ + **8 known issues open** (exit 0) · `test:payments` 24/24 · lint 421 (script clean) · smoke E2E 15/15 ×3.
- Also in this commit: E2E 10 gets a 2-minute budget (8 full page loads); one run had hit the 60 s default while the stack was busy right after the security suite.

**Rollback.** Revert the commit.

---

## 2026-10-09 · P1-04 · CI on every push + machine-independent typecheck ratchet

**Status:** done on `remediation` (unit U00, branch `fix/U00-ci-every-push`, merged by the coordinator). No app or schema change.

**Change.**
- New `.github/workflows/ci.yml` (no secrets, no path filters): runs on pushes to `dev`, `main`, `remediation`, `fix/**`, on PRs to `dev`/`main`, and by hand. Concurrency per ref with cancel-in-progress.
  - Job `check`: `npm ci`, `npm run check` (typecheck ratchet + lint ratchet + vitest), `npm run build` with placeholder Supabase env.
  - Job `db-tests` (40 min budget): local test stack (`test:env:up`), `test:payments`, `test:security`, `npx playwright install --with-deps chromium`, `test:e2e`. Each suite still runs if an earlier one failed (as long as the stack is up); logs are tee'd, results/failures shown as annotations, logs + Playwright report uploaded as artifacts, stack always torn down.
- `scripts/typecheck-ratchet.mjs`: TypeScript writes absolute paths into some messages (`import("C:/Users/…/src/types/index")`), so the Windows-written baseline failed on every other machine (1 "new" error on Linux/CI). Messages are now normalized to repo-relative form (`import("src/…")`) before keying and truncation; baseline keys are normalized when read, and old keys that were truncated inside a long absolute path match as prefixes (still counted per instance). `--update` writes normalized keys. Baseline file unchanged.

**Gates.** tsc 39 (ratchet now green on Linux; red before) · deliberate new error and a duplicate of the path-bearing error both fail it · lint 421 · vitest 109/109 · build OK (main 4,016,277 B) · CI run 37977573219: `check` ✓, `db-tests` ✓ (`test:payments` 24/24, `test:security` 24 ✓ + 8 known issues open, smoke E2E 15/15).
- Note: `payments-test-env.yml` is now redundant with `db-tests` (dev pushes touching payments run the suite twice). Left in place; owner's call.

**Rollback.** Revert the merge commit (deleting `ci.yml` removes CI; the old ratchet only works on the owner's PC).

---

## 2026-10-09 · P2-07 · Stop writing `profiles.role` from the client sign-up

**Status:** done on `remediation` (unit U01, branch `fix/U01-register-role`). Frontend only; no schema change.

**Problem.** After a client sign-up that returns a session, `Register.tsx` updated the user's profile with `{ role: 'client', full_name }` from the browser. The server already sets the role: `handle_new_user` (trigger `on_auth_user_created` on `auth.users`) creates every profile and gives a plain client sign-up (metadata has no `role`) the role `client`. Since P0-01, the lock trigger rejects any API change to `role`, so the browser write did nothing for clients. It also silently failed (and took the `full_name` in the same update with it) for a person with a pending staff invite, and, because super admins bypass the lock, it turned a `@stratumpr.com` account that registered through the client form into `role = 'client'`.

**Change.**
- `src/pages/Register.tsx`: the profile update after a client sign-up sends only `full_name`.
- `src/pages/Register.test.tsx` (new): drives the client form against a fake Supabase client and checks that no write and no `signUp` metadata carries `role` and that the profile still gets the typed name. Failed before the fix.

**Compatibility with `main`.** No database change. `main` still sends `role: 'client'`; the security suite keeps covering that write ("client signup's role write (unchanged value) still works").

**Gates.** tsc 39 (none new) · lint 421 (none new) · vitest 110/110 (+1) · build OK (main 4,016,263 B) · CI run 37979424683: `check` ✓, `db-tests` ✓ (`test:payments` 24/24, `test:security` all pass + 8 known issues open, smoke E2E 15/15).

**Rollback.** Revert the merge commit (frontend only; previous Vercel deployment for instant rollback).

**Tag:** `fix/P2-07` once deployed.

**Follow-up found.** Pressing Enter on step 1 or 2 of the client form submits the whole sign-up (the `<form onSubmit>` spans all three steps), so someone can register with no name and no pets. Candidate small unit.

---

## 2026-10-09 · P3-02 · Delete legacy pages Business{Customers,Pets,Services,Reports,Settings} and ClientPlaceholder

**Status:** done on `remediation` (unit U03, branch `fix/U03-legacy-pages`). No app, route or schema change.

**Change.** Deleted `src/pages/BusinessCustomers.tsx`, `BusinessPets.tsx`, `BusinessServices.tsx`, `BusinessReports.tsx`, `BusinessSettings.tsx`, `ClientPlaceholder.tsx` (1,728 lines). None was imported, routed, lazy-loaded or linked anywhere in `src/`, `e2e/` or `scripts/` (repo-wide search found only each file's own export); the main bundle is byte-identical, so they were never shipped. The live settings page `BusinessSettingsPage.tsx` is untouched. 54 translation keys are now unused (`businessServices.*`, `personalization.*`, `reports.*`, `serviceForm.*`, `services.*` and a few others; list in the unit report) — left in `translations.ts` for a separate cleanup. Ratchet baselines regenerated by the coordinator (keys now path-free).

**Gates.** tsc 39 → 37 · lint 421 → 404 · vitest 110/110 · build OK (main bundle unchanged) · CI run 37979636826: `check` ✓, `db-tests` ✓ (`test:payments` 24/24, `test:security` ✓ + 8 known issues open, smoke E2E 15/15).

**Rollback.** Revert the merge commit.

---

## 2026-10-09 · Reminder greeting · `send-appointment-reminder` greets with `first_name` when `name` is empty

**Status:** done on `remediation` (unit U05, branch `fix/U05-reminder-greeting`). **Not deployed to production** (Edge Function deploy, OWNER_ACTIONS Part D4).

**Problem.** Since P0-06, `clients.name` is an optional column and is empty for most clients (they have `first_name`/`last_name`). The reminder email's heading was `Hola ${esc(client?.name ?? "")}`, so it read "Hola " with nothing after it.

**Change.**
- `supabase/functions/send-appointment-reminder/greeting.ts` (new, pure): `reminderGreeting(client)` → `Hola <name>` if `name` is non-blank, else `Hola <first_name>` (first name only, as `notify-appointment` does), else `Hola,`; HTML-escaped with the same `esc` (moved here from index.ts).
- `index.ts`: client lookup selects `first_name, last_name` too; the `<h2>` uses `reminderGreeting(client)`. Nothing else in the email changed.
- `greeting.test.ts` (5 cases) + folder-local `vitest.config.ts`; run with `npx vitest run -c supabase/functions/send-appointment-reminder/vitest.config.ts` (not yet in the default `vitest run`; follow-up: add `supabase/functions/**/*.test.ts` to the root `unit` project and drop the folder config).

**Gates.** `npm run check`: typecheck 37 / lint 404, none new, vitest 110/110; reminder test 5/5; build OK; `deno check` of index.ts OK (supabase-js via `npm:`); CI run 37979653591: `check` ✓, `db-tests` ✓.

**Production step.** Needs P0-06 applied first (else the lookup fails on `name`). Then `npx supabase functions deploy send-appointment-reminder`.

**Rollback.** Redeploy the previous version: `git checkout <commit before merge> -- supabase/functions/send-appointment-reminder && npx supabase functions deploy send-appointment-reminder`. No DB change.

**Decision.** Greeting falls back to `first_name` only (no `last_name`), matching `notify-appointment`; no name → "Hola,".

---

## 2026-10-09 · P2-03 · Staff pay, job title and access columns are manager-only

**Status:** done on `remediation` (unit U04, branch `fix/U04-staff-column-privileges`). **Not applied to production** (OWNER_ACTIONS D5).

**Problem.** The "Employees update" policy lets any member of a business update any staff row of that business, so an employee could raise their own (or a coworker's) hourly rate, set a commission, or change their job title. `access_role` was already guarded by `staff_enforce_access_role_mutations`.

**Change.**
- `supabase/migrations/20261009110000_staff_lock_pay_and_role_columns.sql`: trigger `staff_lock_pay_and_role_columns`, `BEFORE UPDATE` on `public.staff`. For `authenticated`/`anon` callers, a change to `hourly_rate`, `commission_rate`, `compensation_type`, `role`, `job_title_id` or `access_role` requires `can_manage_staff_private(business_id)` (super admin, profile manager, or staff access_role admin/manager); otherwise `42501 staff_pay_and_role_columns_are_manager_only`. Unchanged values pass, so the manager form (which sends every field) still saves. The service role and SECURITY DEFINER functions are unaffected.
- `job_title_id` and `compensation_type` are locked beyond the plan's list: the job title feeds `role` (via `staff_sync_name_and_role_trigger`) and pay type changes how pay is calculated. No employee screen writes either.
- `pin` is deliberately **not** locked: employees change their own kiosk PIN in the self-service form (main and dev). P2-02 (U11) moves this to an own-PIN RPC, hashes PINs, then locks `pin`.
- `supabase/rollbacks/20261009110000_staff_lock_pay_and_role_columns.down.sql`.
- `scripts/test-env-security.mjs`: "own hourly rate" and "coworker's pay rate" moved from known() to check(); new checks for role, job title, commission rate and pay type; regression checks for the employee self-service save (incl. own PIN), the AccountSettings birthday save, unchanged values, a full manager save and the service role.

**Compatibility with `main` (shared database).** Expand-only. Neither frontend writes these columns as an employee (self-service and AccountSettings payloads checked on both branches).

**Gates.** tsc 37 · lint 404 · vitest 110/110 · build OK · red test-only run 37979599661 (attacks still worked) → green run 37980168857: `check` ✓, `db-tests` ✓ (`test:payments` 24/24, `test:security` all ✓ + **6 known issues open** (was 8), smoke E2E 15/15). Migration → rollback → migration verified on a scratch Postgres 16 with the real staff triggers/helpers; both scripts idempotent.

**Production steps (Jovaniel; OWNER_ACTIONS D5).**
1. Backup (A3) and note its folder name: `__________`.
2. Paste the whole migration file into the Supabase SQL editor and run it. **Never `supabase db push`.**
3. `npx supabase migration repair --status applied 20261009110000`.
4. Verify (read-only):
   `select tgname, tgtype, tgenabled from pg_trigger where tgname = 'staff_lock_pay_and_role_columns';` → 1 row, tgtype 19, 'O'
   `select has_function_privilege('authenticated', 'public.can_manage_staff_private(uuid)', 'execute');` → true
5. Smoke test on the dev page with the QA business: as a manager, edit an employee's pay rate, commission, job title and PIN; as an employee, change your own name/phone/PIN and save; save your birthday in Account settings. Then, on the production app, save an employee as a manager.
6. Watch for errors mentioning `staff_pay_and_role_columns_are_manager_only` for 24 h.

No frontend deploy is needed.

**Rollback (production).** Run `supabase/rollbacks/20261009110000_staff_lock_pay_and_role_columns.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261009110000`. This reopens "employee raises their own pay"; use only if the lock breaks a legitimate flow.

**Open for P2-01 staff (U08).** INSERT isn't covered: an employee can still insert a new staff row with any rate under "Employees insert".

**Tag:** `fix/P2-03` once applied to production.

---

## 2026-10-09 · P3-08 · README rewrite; cross-platform replacements for the PowerShell-only scripts

**Status:** done on `remediation` (unit U10, branch `fix/U10-readme-scripts`; package.json switch and old-script deletion by the coordinator). No app or schema change.

**Change.**
- `README.md` rewritten: what Grumi is, stack, prerequisites (Node 22, npm, Docker, Supabase CLI via npx), setup (`.env.example` names), everyday commands, the test stack and suites, CI (`check`, `db-tests`), the migration workflow (new files + rollback, expand-only; production by the owner via SQL editor + `migration repair`, never `supabase db push`), and where the docs live.
- New Node scripts that work on Windows, macOS and Linux: `scripts/kill-port.mjs <port>` (kills only listeners; netstat/taskkill on Windows, lsof or fuser elsewhere; same retries as the .ps1), `scripts/supabase-local.mjs start|stop|restart|status [--dry-run]`, `scripts/setup-env.mjs [--out <file>]`, `scripts/move-hero-background.mjs`. `scripts/kill-port-8080.mjs` now delegates to `kill-port.mjs` (kept: `dev-safari.mjs` calls it).
- package.json: `kill-vite`, `kill-preview`, `supabase:start|stop|restart`, `setup-env`, `move-hero-fallback` run these scripts; no script calls PowerShell any more. Deleted: `kill-port-4173.ps1`, `kill-port-8080.ps1/.sh`, `start-/stop-/restart-supabase.ps1`, `start-/stop-supabase.sh`, `setup-env.ps1`, `move-hero-background.ps1`.
- Developer-only behaviour changes: `supabase:stop` no longer force-kills every process named *supabase*/*postgres*/*kong* on the machine (it also killed unrelated local Postgres servers); `kill-vite` kills only listeners on 8080 (not connected browsers); `setup-env` writes UTF-8 without BOM.

**Gates.** tsc 37 · lint 404 · vitest 110/110 · build OK · CI run 37984178588: `check` ✓, `db-tests` ✓ · coordinator after merge: `npm run kill-preview` frees 4173, `supabase:restart -- --dry-run` prints stop → start. Not run on Windows or macOS (netstat parser tested on sample output only) — first Windows use: `npm run kill-preview` and `npm run supabase:start`.

**Rollback.** Revert the merge commit and the coordinator's follow-up commit.


---

## 2026-10-09 · P2-01 staff · One RLS policy set on `staff` (employees can't add or remove staff)

**Status:** done on `remediation` (unit U08, branch `fix/U08-staff-rls`). **Not applied to production** (OWNER_ACTIONS D6).

**Problem.** `staff` had 13 policies, most of them generic or duplicates. "Employees insert/update/delete" let any member of a business, employees included, add staff rows with any pay rate (the P2-03 trigger only covers UPDATE), edit coworkers' rows, and delete coworkers.

**Change.**
- `supabase/migrations/20261009120000_staff_rls_rewrite.sql`.
  - New shared helpers, SECURITY DEFINER, EXECUTE for authenticated and service_role only:
    - `is_business_member(b)`
    - `is_business_manager(b)`: same rule as `can_manage_staff_private`
    - `is_own_staff_row(id)`
  - Drops 11 policies by name.
  - Creates 5 policies, all TO authenticated:
    - select: member or own row
    - insert: manager
    - update: manager
    - update own row: own row, kept in a business the caller belongs to
    - delete: manager
  - Not touched: the demo-workspace read policies (P2-05) and both staff triggers. The P2-03 trigger still limits which columns an employee may change on their own row.
- `supabase/rollbacks/20261009120000_staff_rls_rewrite.down.sql`: recreates the 11 old policies verbatim from the production snapshot and drops the helpers.
- `scripts/test-env-security.mjs`:
  - "employee cannot delete a coworker" moved from known() to check().
  - New checks: an employee cannot add staff, edit a coworker, or move their own row to another business.
  - Regression checks for every legitimate path.
  - The P2-03 "coworker's pay rate" check now also accepts RLS's 0-row result; the rate must still be unchanged.

**Compatibility with `main` (shared database).** Expand-only for every flow either frontend uses. Only employee writes to other staff rows are blocked, and no screen on main or dev makes them.

**Gates.**
- tsc 37 · lint 404 · vitest 110/110 · build OK.
- Red test-only run 37984287777 → green run 37985608351: `check` ✓, `db-tests` ✓ (`test:payments` ✓, `test:security` all ✓ + **5 known issues open** (was 6), smoke E2E 15/15).
- Migration → rollback → migration verified on a scratch Postgres 16: policies and behavior identical after the rollback; both scripts are idempotent.

**Production steps (Jovaniel; OWNER_ACTIONS D6).**
1. Backup (A3) and note its folder name: `__________`.
2. Paste the whole migration file into the Supabase SQL editor and run it. **Never `supabase db push`.**
3. `npx supabase migration repair --status applied 20261009120000`.
4. Verify (read-only):
   - `select policyname, cmd from pg_policies where schemaname='public' and tablename='staff' order by 1;` → 7 rows: the 2 demo policies plus staff_delete_managers, staff_insert_managers, staff_select_business_members, staff_update_managers, staff_update_own_row.
   - `select has_function_privilege('authenticated','public.is_business_manager(uuid)','execute'), has_function_privilege('anon','public.is_business_manager(uuid)','execute');` → true, false.
5. Smoke test on the dev page with the QA business:
   - as a manager: add, edit (pay and PIN), reset the PIN of, and delete an employee; open the appointment book and payroll;
   - as an employee: open the staff page and save (including your own PIN), open schedules and the kiosk, save your birthday in Account settings;
   - open the public booking page and check the groomers;
   - then, on the production app, save an employee as a manager.
6. Watch for RLS errors on `staff` for 24 h.

No frontend deploy is needed.

**Rollback (production).** Run `supabase/rollbacks/20261009120000_staff_rls_rewrite.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261009120000`. This reopens "employees add, edit or delete staff rows". If a later migration's policy uses the new helpers, the rollback's DROP FUNCTION fails on purpose: roll that migration back first.

**Tag:** `fix/P2-01-staff` once applied to production.

**Note.** The worker loosened U04's "coworker's pay rate" check to accept RLS's 0-row result as well as the trigger's error; the assertion (rate unchanged) is the same. Accepted by the coordinator.

---

## 2026-10-09 · P4-01 · Lazy-load routes (main bundle 4.0 MB → 1.07 MB)

**Status:** done on `remediation` (unit U06, branch `fix/U06-lazy-routes`). The worker was stopped before reporting; the coordinator reviewed the diff and ran the gates (owner's choice 2026-10-09). Frontend only.

**Change.**
- `src/App.tsx`: every page except Landing (`/`), Login, NotFound, the redirect components and route guards is loaded with `React.lazy`; the whole business app (`Index` and everything it imports) is one lazy chunk until Index splits its own routes. `DemoLegacyRedirect` is lazy too (it imports Index). Routes are wrapped in one `Suspense`.
- `src/components/RouteFallback.tsx` (new): the same full-screen paw loader ProtectedRoute shows (fades in after ~0.12 s, so fast loads barely show it), label `common.loading`.
- Stale chunks after a redeploy: a failed chunk import reloads the page once (sessionStorage guard, 60 s window); a second failure reaches GlobalErrorBoundary as before.
- Visible change: a brief paw loader on the first visit to a page whose code isn't downloaded yet.

**Gates.** Main chunk **4,016,277 → 1,070,838 B** (gzip 1,158 → 314 kB), 41 JS chunks · tsc 37 · lint 404 · vitest 110/110 · build OK · `verify-discoverability` passes (15 routes) · CI run 37980434227: `check` ✓, `db-tests` ✓ (smoke E2E 15/15 incl. deep links and hidden-feature redirects). Not done: cold load on a throttled mobile profile.

**Rollback.** Revert the merge commit (frontend only; previous Vercel deployment for instant rollback).

**Follow-up.** `Index.tsx` still loads the whole business app as one ~chunk; splitting its inner routes is the next step if needed.

---

## 2026-10-09 · P3-01 · Delete orphan files (Appendix B, minus pages, plus Admin.tsx)

**Status:** done on `remediation` (unit U02, branch `fix/U02-orphan-files`; the first worker was stopped after 3 batches, a second worker finished from its pushed commits). Frontend only; nothing users or staff can see changes.

**Change.** Deleted 28 files that nothing imports, checked one by one (static, lazy and dynamic imports, scripts/, index.html, vite/vitest/playwright config, e2e/, test-env/, supabase/functions), in 6 batches:
- `src/pages/Admin.tsx`
- `src/components/`: CustomerList, DaycareCalendarView, EmployeePinSetupDialog, EnvDiagnostics, KioskManagerAccess, OnboardingModal, SidebarLogoPreview, ThemedFavicon, TimeEntryCard
- `src/components/ui/`: accordion, aspect-ratio, chart, context-menu, hover-card, menubar, navigation-menu, progress, resizable, scroll-area
- `src/hooks/`: useBusinessBySlug, useLocalStorage, useStaffServiceRates
- `src/lib/`: bookingAvailability, overtimeCalculation, payrollStaffSummaryFilter, timeRounding
- `src/data/calendarSampleData.ts`
Kept: `src/types/index.ts` (it is `@/types`, imported by 10+ files — Appendix B was wrong about it). Ratchet baselines regenerated by the coordinator.

**Gates.** tsc 37 → 31 · lint 404 → 400 · vitest 110/110 · build OK, main chunk 1,070,838 B (unchanged; orphans were never bundled) · CI run 37988832893: `check` ✓, `db-tests` ✓ (payments 24/24, security ✓ + 5 known issues open, smoke E2E 15/15).

**Rollback.** Revert the merge commit (deletions only).

**Follow-ups (not done; separate small units).** npm deps that now look unused: `react-resizable-panels`, `@radix-ui/react-{menubar,navigation-menu,progress,scroll-area,accordion,aspect-ratio,context-menu,hover-card}` (verify, then remove with a lockfile update). Translation keys now unused: `employeePinSetup.*`, most `kioskManager.*` (keep `kioskManager.cancel`), `clients.noBusinessClients`, `common.noEmail`, plus the 54 from P3-02.

---

## 2026-10-09 · CI infra · ATH simulator base image from public.ecr.aws

**Status:** done on `remediation` (unit U16, branch `fix/U16-ci-ecr-node`).

**Problem.** CI's `db-tests` kept failing in "Start test stack": Docker Hub returned 429/504 on `auth.docker.io` while building the ATH simulator image (`FROM node:22-alpine`) — e.g. run 37991559656 failed on all 3 attempts, before any test ran. It was the test stack's only Docker Hub pull; the Supabase images already come from `public.ecr.aws`.

**Change.** `test-env/ath-simulator/Dockerfile`: `FROM public.ecr.aws/docker/library/node:22-alpine` (same official image via AWS's mirror of Docker Official Images), with a one-line comment. No other Docker Hub pulls remain in docker-compose.yml, scripts/test-env*.mjs or the workflows.

**Gates.** `npm run check` ✓ · build ✓ · CI run 37995362579: `check` ✓, `db-tests` ✓ (payments 24/24, security 56 ✓ + 5 known issues open, smoke E2E 15/15).

**Rollback.** Revert the merge commit (restores `FROM node:22-alpine`).

**Note.** Cloud sessions still can't run the stack locally (the proxy returns 403 for ECR's CloudFront layer downloads); CI stays the DB/E2E gate.

---

## 2026-10-09 · P3-04 · Explicit column lists on `staff`, `profiles`, `businesses`

**Status:** done on `remediation` (unit U09, branch `fix/U09-explicit-columns`). Frontend only; no visible change.

**Change.**
- No `select('*')` or bare `.select()` left on these three tables in `src`.
- Column constants: `STAFF_PUBLIC_COLUMNS`, `STAFF_MANAGER_COLUMNS`, `StaffPublicRow` (useSupabaseData); `KIOSK_STAFF_COLUMNS` (useTimeKiosk); `STAFF_PIN_COLUMNS`, `BUSINESS_KIOSK_MANAGER_PIN_COLUMNS` (employeePin); `PROFILE_COLUMNS` (auth); `BUSINESS_COLUMNS` (businessSlug, re-exported by auth); `ADMIN_BUSINESS_LIST_COLUMNS` (AdminDashboard).
- The auth context, login routing and slug lookups no longer load `businesses.kiosk_manager_pin` (before, every signed-in user received it).
- New `src/lib/selectColumns.test.ts` (9 tests): every column constant names real columns in the production schema snapshot; public lists exclude `pin` / `kiosk_manager_pin`.

**Readers of `staff.pin` (input for P2-02 / U11).** `STAFF_MANAGER_COLUMNS` via `useEmployees()` (staff list/forms in EmployeeManagement; `Employees.tsx` matches `e.pin`) — **loaded for employees too, so every member still receives coworkers' PINs and the legacy SSN/bank columns**; `KIOSK_STAFF_COLUMNS` (`getEmployeeByPin`; TimeKiosk passes `employee.pin` to `clock_in_out` — could pass the typed PIN); `STAFF_PIN_COLUMNS` (`fetchEmployeePinsForBusiness`: uniqueness + manager-PIN prefix). `verifyPin` in useSupabaseData is dead code.

**Readers of `businesses.kiosk_manager_pin` (input for P2-04 / U12).** `generateUniqueEmployeePin` (reserved prefix), `TimeKiosk.tsx` lock gate and PIN entry (compares in the browser), `KioskManagerPinSettings.tsx` (compares "current PIN" in the browser). Writers: KioskManagerPinSettings, KioskManagerPinResetDialog.

**Gates.** tsc 31 → 29 (baseline tightened) · lint 400 · vitest 119/119 (+9) · build OK (main 1,071,654 B) · CI run 37996504085: `check` ✓, `db-tests` ✓ (payments, security + 5 known issues, smoke E2E all passed). Earlier runs 37989562779 / 37991559656 failed only on Docker Hub 429 (fixed by U16). No manual walkthrough; the no-change claim rests on tracing every consumer plus the schema test.

**Rollback.** Revert the merge commit (previous Vercel deployment for instant rollback).


---

## 2026-10-10 · P2-01 clients · Only managers can delete clients (decision 9)

**Status:** done on `remediation` (unit U13, branch `fix/U13-clients-no-employee-delete`). **Not applied to production** (OWNER_ACTIONS D7).

**Problem.** Three permissive DELETE policies on `clients` were OR-ed together. "Clients delete" allowed any member of the business, so every employee could delete any client of their business. Decision 9 (2026-10-09): employees may not delete clients; managers keep delete.

**Change.**
- `supabase/migrations/20261009150000_clients_delete_managers_only.sql`.
  - Requires 20261009120000 (`is_business_manager`).
  - Drops "Clients delete", `clients_delete_managers` and the FOR ALL "Managers can manage clients in their business".
  - Creates `clients_delete_business_managers`: FOR DELETE TO authenticated, `is_business_manager(business_id)` OR super admin. The super admin clause keeps delete on no-business (global portal) clients.
  - Splits the FOR ALL policy into "Managers can read/insert/update clients in their business", with identical expressions.
  - Every other policy is unchanged.
- `supabase/rollbacks/20261009150000_clients_delete_managers_only.down.sql`: recreates the 3 old policies verbatim from the production snapshot.
- `scripts/test-env-security.mjs`:
  - "employee cannot delete the business's clients" moved from known() to check().
  - New regression checks: employee read/add/edit; employee cannot delete a client they added; manager delete; cross-business manager blocked; staff access_role manager delete; super admin delete, with and without a business; portal reads and updates its own row.
- `src/pages/Clients.tsx`, `src/components/ClientProfileDialog.tsx`: the Delete button in the client profile is hidden for profile role employee (super admins excepted).

**Compatibility with `main` (shared database).**
- Expand-only for every flow either frontend uses except an employee's delete.
- On main/dev an employee still sees "Delete". Confirming it deletes nothing and shows no error. The client vanishes from the list until a reload.
- Managers, staff with access_role manager/admin, and super admins are unaffected.

**Gates.**
- tsc 29 · lint 400 · vitest 119/119 · build OK.
- Green run 38019670337 (attempt 2; attempt 1 hit the flaky E2E flow 4): `check` ✓, `db-tests` ✓ (`test:payments` 24/24, `test:security` all ✓ + **4 known issues open** (was 5), smoke E2E 15/15).
- Migration → rollback → migration verified on a scratch Postgres 16: policies and behavior identical after the rollback, both scripts idempotent, the only behavior change is employee DELETE.

**Production steps (Jovaniel; OWNER_ACTIONS D7).**
1. Confirm D6 (20261009120000, `is_business_manager`) is applied; the migration stops with an error otherwise.
2. Backup (A3) and note its folder name: `__________`.
3. Paste the whole migration file into the Supabase SQL editor and run it. **Never `supabase db push`.**
4. `npx supabase migration repair --status applied 20261009150000`.
5. Verify (read-only): `select policyname, cmd from pg_policies where schemaname='public' and tablename='clients' order by 1;`
   - Expect 15 rows.
   - Exactly one DELETE row: `clients_delete_business_managers`.
   - None of "Clients delete", `clients_delete_managers` or "Managers can manage clients in their business".
6. Smoke test on the dev page with the QA business:
   - as a manager: add, edit and delete a client;
   - as an employee: open Clients, add and edit a client, and check the profile has no Delete button;
   - as a client: open the portal and save the profile;
   - then, on the production app, edit a client as a manager.
7. Watch for RLS errors on `clients` for 24 h.

No frontend deploy is needed; the hidden button ships with the next remediation deploy.

**Rollback (production).** Run `supabase/rollbacks/20261009150000_clients_delete_managers_only.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261009150000`. This reopens "employees can delete any client of their business". The helpers belong to 20261009120000 and are not touched.

**Tag:** `fix/P2-01-clients` once applied to production.

**Notes.** E2E flow 4 (reschedule + cancel) failed on attempt 1 of the final run and passed on attempt 2 with the same code; it also failed in U07's runs — tracked as a flaky test to fix separately. UI hides Delete by profile role, so staff with profile role employee but access_role manager lose the button although the database still allows them.


---

## 2026-10-10 · P2-01 pets · Only managers can delete pets (decision 9)

**Status:** done on `remediation` (unit U14, branch `fix/U14-pets-no-employee-delete`). **Not applied to production** (OWNER_ACTIONS D8).

**Problem.** Four permissive DELETE policies on `pets` were OR-ed together. "Pets delete" allowed any profile linked to the business, so every employee could delete any pet of their business. Decision 9 (2026-10-09): employees may not delete pets; managers keep delete.

**Change.**
- `supabase/migrations/20261009160000_pets_delete_managers_only.sql`.
  - Requires 20261009120000 (`is_business_manager`).
  - Drops "Pets delete" and `pets_delete_managers`.
  - Creates `pets_delete_business_managers`: FOR DELETE TO authenticated, `is_business_manager(business_id)` OR super admin. The super admin clause keeps delete on no-business (global portal) pets.
  - Keeps "Managers can delete pets for their business" (profile role manager/super_admin only; includes appointment-linked pets) and "Clients can delete own pets" (portal) unchanged.
  - No FOR ALL policy on pets, so nothing to split. Every SELECT/INSERT/UPDATE policy is unchanged.
- `supabase/rollbacks/20261009160000_pets_delete_managers_only.down.sql`: recreates the 2 dropped policies verbatim from the production snapshot.
- `scripts/test-env-security.mjs`:
  - "employee cannot delete the business's pets" moved from known() to check().
  - New regression checks: employee read/add/edit; employee cannot delete a pet they added; manager delete; cross-business manager blocked; staff access_role manager delete; super admin delete, with and without a business; portal client adds, reads, edits and removes its own pet; portal client cannot delete a business's pet.
- `src/pages/Pets.tsx`, `src/components/PetProfileDialog.tsx`, `src/components/PetList.tsx`: the Delete button in the pet profile (and the unused card trash button) is hidden for profile role employee (super admins excepted).

**Compatibility with `main` (shared database).**
- Expand-only for every flow either frontend uses except an employee's delete.
- On main/dev an employee still sees "Delete". Confirming it deletes nothing and shows no error. The pet vanishes from the list until a reload.
- Managers, staff with access_role manager/admin, super admins and portal clients are unaffected.

**Gates.**
- tsc 29 · lint 400 · vitest 119/119 · build OK.
- Red test-only run 38020808230: only the 2 employee pet-delete checks failed.
- Green run 38021128236 (attempt 1): `check` ✓, `db-tests` ✓ (`test:payments` 24/24, `test:security` all ✓ + **3 known issues open** (was 4), smoke E2E 15/15).
- Migration → rollback → migration verified on a scratch Postgres 16: policies and behavior identical after the rollback, both scripts idempotent, the only behavior change is DELETE by non-manager business profiles.

**Production steps (Jovaniel; OWNER_ACTIONS D8).**
1. Confirm D6 (20261009120000, `is_business_manager`) is applied; the migration stops with an error otherwise. Apply after D7.
2. Backup (A3) and note its folder name: `__________`.
3. Paste the whole migration file into the Supabase SQL editor and run it. **Never `supabase db push`.**
4. `npx supabase migration repair --status applied 20261009160000`.
5. Verify (read-only): `select policyname, cmd from pg_policies where schemaname='public' and tablename='pets' order by 1;`
   - Expect 16 rows.
   - Exactly three DELETE rows: `pets_delete_business_managers`, "Managers can delete pets for their business", "Clients can delete own pets".
   - Neither "Pets delete" nor `pets_delete_managers`.
6. Smoke test on the dev page with the QA business:
   - as a manager: add, edit and delete a pet;
   - as an employee: open Pets, add and edit a pet, and check the pet profile has no Delete button;
   - as a client: open the portal, add, edit and remove a pet;
   - then, on the production app, edit a pet as a manager.
7. Watch for RLS errors on `pets` for 24 h.

No frontend deploy is needed; the hidden button ships with the next remediation deploy.

**Rollback (production).** Run `supabase/rollbacks/20261009160000_pets_delete_managers_only.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261009160000`. This reopens "employees can delete any pet of their business". The helpers belong to 20261009120000 and are not touched.

**Tag:** `fix/P2-01-pets` once applied to production.

**Notes.**
- The UI hides Delete by profile role, so staff with profile role employee but access_role manager lose the button although the database still allows them (same as clients).
- A profile with role client and a business_id set also loses delete on that business's pets; it keeps the old INSERT/UPDATE via "Pets insert/update" (not changed here).
- "Managers can delete pets for their business" still lets a manager delete a portal client's global pet that has an appointment at their business. This is old behavior, left as is.


---

## 2026-10-10 · U18 · Slow login destination lookup sent staff to the client portal

**Status:** done on `remediation` (unit U18, branch `fix/U18-login-slow-redirect`). Frontend only, so there's no production database step: it ships with the next `dev` deploy.

**Problem.** `LoginForm.handleLogin` raced the role-based post-login lookup (`resolveAuthenticatedDestination`) against a 6 s timer that answered `/portal`. On a slow network or a cold database, managers and employees landed on the client portal. CI showed it as an occasional failure in E2E flow 4.

**Change.**
- `src/components/LoginForm.tsx`: sign-in waits for the real destination and the button keeps its spinner. After a 30 s safety limit (`DESTINATION_LOOKUP_SAFETY_MS`) it shows the generic login error (`login.errorGeneric`) and re-enables the form instead of guessing a route.
- Unchanged: fast lookups, `postLoginNavigateTo`, and the `businessSlug` portal-link checks (revoked/unapproved).
- New `src/components/LoginForm.test.tsx` (fake timers) covers three cases: a manager whose lookup takes 7 s lands on their dashboard; a fast client still goes to `/portal`; a lookup that never answers shows an error and never navigates.

**Gates.**
- tsc 29 · lint 400 · vitest 122/122 · build OK.
- Red test-only commit `ee06bf4`: `check` failed on the 2 new assertions, which received `/portal`.
- Green run 38054885116: `check` ✓, `db-tests` ✓ (payments, security, smoke E2E).

**Notes.**
- A neutral fallback route (`/`) was rejected: for clients it would skip the `businessSlug` link checks.
- Past 30 s the user is already signed in, so the Login page's own redirect hook may still take them to the right page once the lookup finishes.
- This also removes one cause of the E2E flow 4 flake (U17 fixes the others).


---

## 2026-10-10 · U17 · E2E flows 4 and 7 made deterministic

**Status:** done on `remediation` (unit U17, branch `fix/U17-e2e-flakes`). Tests only. Flow 4 still has one app-side flake, fixed separately by U19.

**Problem.**
- Flow 4's retry started from what attempt 1 left behind (already moved to 3 PM or canceled), because the seed runs once per run, not once per attempt.
- Flow 4's cancel step raced the confirmation dialog with `isVisible()`, so the confirm click was usually skipped. It also reloaded before the status write finished.
- Flow 7 failed from 20:00 PR time: with no saved anchor, payroll anchors the pay period on the UTC date, which is already tomorrow by then.

**Change.**
- Flow 4: `resetEditAppointment()` puts the seeded 'edit' row back to how the seed wrote it (scheduled, 14:00–15:00, no notes) using the service-role `adminDb()`. Then the test waits for the confirmation dialog, clicks it, waits for it to close, and waits for the "Cita cancelada" toast before reloading.
- Flow 7: pins the browser clock to 12:00 PR on the seed's day.
- New `e2e/clock.ts` (`seedToday`, `pinBrowserClock`); flows 4/4b/4c use it too.
- Same assertions; retries unchanged.

**Gates.**
- tsc 29 · lint 400 · vitest 122/122 · build OK.
- CI on the branch: 38054885344 attempt 1, 38056128057, 38056472343, 38056795579 and 38057194260 green, with flows 4 and 7 passing on the first attempt.
- 38054885344 attempt 2 failed on flow 4 because of the app bug below.
- Merged with merge rule (c) waived once by the owner: `remediation` was red on this very test.

**Notes (app bugs found, not worked around).**
- **U19:** gated routes in `src/pages/Index.tsx` redirect to the dashboard before the feature rules and the business tier load, so a reload or deep link to `/appt-book` (or inventory, payment, transactions) can bounce to `/dashboard`. Proved in CI 38056795579 by delaying the feature rules on purpose.
- **U20 candidate:** payroll's default pay-schedule anchor uses the UTC date (`Payroll.tsx:149`, `useSupabaseData.ts:2098`). From 20:00 PR time, the current period starts tomorrow and today's shifts are hidden.


---

## 2026-10-10 · U20 · Payroll default pay-period anchor uses the local date, not UTC

**Status:** done on `remediation` (unit U20, branch `fix/U20-payroll-local-anchor`). Frontend only, so there's no production database step: it ships with the next `dev` deploy.

**Problem.** With no saved `pay_schedule_anchor_date`, Payroll (`Payroll.tsx:149`, `:154`) and `useSettings` (`useSupabaseData.ts:2098`) defaulted the anchor to the UTC date. In Puerto Rico (UTC−4) that's already tomorrow from 20:00, so between 20:00 and midnight the "current" pay period flipped back to the previous one (ending today). Found by U17 (E2E flow 7).

**Change.**
- New `src/lib/payrollAnchor.ts`:
  - `defaultPayScheduleAnchorISO` returns today's local calendar day, using date-fns `format(now, 'yyyy-MM-dd')`, which the app already uses for "today".
  - `resolvePayScheduleAnchorISO` returns the saved anchor, or that default when there isn't one.
- The three spots above now use it.
- Saved anchors, cadence and pay math are unchanged.
- New unit test `src/lib/payrollAnchor.test.ts`: TZ America/Puerto_Rico, clock pinned to 2026-10-10 21:00.

**Gates.**
- tsc 29 · lint 400 · vitest 127/127 · build OK.
- Red test-only run 38057815819 (only the new tests failed).
- Green run 38057951694: `check` ✓, `db-tests` ✓ (payments, security, smoke E2E incl. flows 4 and 7).

**Notes.**
- The same UTC-date default remains in:
  - `EmployeePayroll.tsx:44/49`;
  - `EmployeeTimesheet.tsx:88/93`;
  - `BusinessSettingsPage.tsx:140`. Saving the pay-schedule form there with the default after 20:00 PR stores tomorrow's date.
- Candidate unit U21 (one-line change each, using the new helper).
- Without a saved anchor, the default moves every day, so the current period always starts today. That's existing behavior, unchanged here.


---

## 2026-10-10 · U19 · Feature-gated pages bounced to the dashboard on reload

**Status:** done on `remediation` (unit U19, branch `fix/U19-feature-gate-loading`). Frontend only, so there's no production database step: it ships with the next `dev` deploy.

**Problem.** `Index.tsx` redirected feature-gated routes to `/<slug>/dashboard` whenever `isFeatureVisible()` was false. That's also the case while the `feature_rollout` / `feature_visibility_rules` queries are still loading. So a reload or deep link to appt-book, inventory, payment, transactions or settings account/booking could permanently bounce to the dashboard (or settings/business). Proven in U17's CI run 38056795579; it was the last cause of the E2E flow 4 flake. The broken relative redirect fixed by E2E-3 had hidden it before.

**Change.**
- New `src/lib/featureGate.ts`:
  - `resolveFeatureGate(visible, known)`: render / loading / redirect.
  - `useFeatureGatesKnown(rolloutLoaded)`: latched once the rules load; falls back after 10 s if they never load.
- In `Index.tsx`, gated routes show the existing paw loader while the rules are unknown.
- Once the rules are known, every redirect target is unchanged. Visible features (including the demo bypass) render right away.
- Unit tests in `src/lib/featureGate.test.tsx`.

**Gates.**
- tsc 29 · lint 400 · vitest 135/135 · build OK.
- Red test-only run 38057712425.
- Green: 38057827477 (×2) and 38058522206 (with U17), smoke E2E 15/15, flow 4 on the first attempt every time, flow 10 passing.

**Notes.**
- If the rules query errors, gates fall back to the old behavior after 10 s.
- Cleaner follow-up: `useFeatureRollout` exposes a settled/error flag to replace the timeout.
- The `gate()` wiring in Index isn't unit-tested directly (a router harness mirrors it).


---

## 2026-10-10 · U21 · Local-date default pay anchor on the employee and settings pages

**Status:** done on `remediation` (unit U21, branch `fix/U21-payroll-anchor-pages`). Frontend only, so there's no production database step: it ships with the next `dev` deploy.

**Problem.** EmployeePayroll, EmployeeTimesheet and BusinessSettingsPage still defaulted the pay-schedule anchor to the UTC date. From 20:00 PR time:
- the employee pages bucketed pay periods off tomorrow when no anchor was saved;
- the Business Settings pay-schedule form showed tomorrow as the default, so saving it then stored tomorrow's date.

Found by U20.

**Change.** Those defaults now use U20's `resolvePayScheduleAnchorISO` / `defaultPayScheduleAnchorISO`:
- `EmployeePayroll.tsx:45,50`;
- `EmployeeTimesheet.tsx:89,94`;
- `BusinessSettingsPage.tsx:141`.

Saved anchors, cadence and pay math are unchanged.

**Gates.**
- tsc 29 · lint 400 · vitest 135/135 (combined) · build OK.
- CI run 38058755289 green (check + db-tests incl. smoke E2E).
- No page test: it would need heavy mocking. Coverage comes from `src/lib/payrollAnchor.test.ts` plus a grep check (no `toISOString().slice(0, 10)` left in these pages).

**Notes.** The repo's security pre-commit hook flags `dangerouslySetInnerHTML` / `document.write` in `BusinessSettingsPage.tsx` (likely the QR print path). This predates U21 and isn't changed here; it's a candidate for a separate review.
