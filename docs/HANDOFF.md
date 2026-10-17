# Handoff: Genesis's work on dev (updated 2026-10-10, night)

Read this at the start of a session with Genesis. It records how she works, what was built on `dev`, and what is still pending. Security decisions live in [SECURITY_RISKS.md](SECURITY_RISKS.md) and belong to Jovaniel (see "Not ours" below).

## How Genesis works

- **Branch:** work directly on `dev`. No separate work branches, no PRs. Never commit to `main`.
- **Checking changes:** Genesis runs the site on her Mac with `npm run dev` (http://localhost:8080). **Make no commits unless she says so** (since 2026-10-10): edit her local checkout (`~/pet-hub`) directly and she checks on localhost; commit/push only when asked. `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Localhost, dev.grumi.pet and grumi.pet all use the **same production Supabase project** (`ehjrykgwfwgckfpcjmka`).
- **Deploys (Vercel free plan, storage limit):** `scripts/vercel-ignore-build.sh` (vercel.json `ignoreCommand`) means:
  - pushes to `dev` do **not** deploy unless the commit message contains `[deploy]`; push a commit with `[deploy]` only when Genesis asks to "deploy dev";
  - `main` deploys when site files change (docs/database/test-only changes are skipped);
  - other branches never deploy.
- **Errors:** report problems to her in chat only; never write error messages into the website.
- **Troubleshooting steps:** give them in a single code block.
- **Production database:** never apply migrations, deploy Edge Functions or change cron without Genesis's OK in that session.
- Language: she writes in Spanish or English; the app UI is bilingual through `src/lib/translations.ts`.

## Done on dev this round (2026-10-10)

- Services page laid out like Pets (list view by default, compact tiles).
- Page transition: the tinted "curtain" was replaced by a 160 ms fade.
- Realtime crash fix brought over from `remediation` (E2E-1, unique channel names).
- **Admin portal** (`/admin`) rebuilt with a sidebar (`src/components/admin/AdminLayout.tsx`):
  - **Resumen** (`src/pages/admin/AdminOverview.tsx`): client-businesses growth chart + "Necesita atención" (past due, trials ending ≤7 days, no activity 30+ days).
  - **Negocios** (`AdminBusinesses.tsx`): search/filters, list, users panel per business with **Entrar como** (support sign-in; the old header "Soporte" menu was removed), **Ver negocio**.
  - **Automatizaciones** (`AdminAutomations.tsx`): see below.
  - **Funciones** (`FeatureSettingsTable.tsx`): only the 16 feature keys the code checks, grouped, Live/Dev switch per feature, roles/plans behind an expand arrow.
  - Shared data hooks: `src/lib/adminData.ts`.
- Landing assets slimmed (hero WebP, lighter 1080p video, unused media moved to `designs/marketing-assets`); build output ~19 MB.

## Automations (in production, switched OFF)

Trello-style "When → Then" rules, managed by super admins in the admin portal. First rule: **pet birthday → email the owner**.

Decisions (Genesis, 2026-10-10):
- Pets get an **optional birth day**. With a day: email on that day (2-day catch-up). Month only: first week of the birth month. Once per pet per year, 9:00 AM Puerto Rico.
- Only clients with `marketing_email_opt_in = true` receive it. **As of 2026-10-10, 0 of 45 clients have opted in**, so nobody would receive it yet.
- Automations apply to all businesses by default; each business can switch each one off (Account settings → "Correos automáticos a clientes", `ClientEmailAutomationsCard.tsx`).
- Email is sent in the business's name, reply-to the business email, with a "why you got this / how to stop" footer.

Code:
- Migration `supabase/migrations/20261010200000_automations.sql` (expand-only: `pets.birth_day`, `automations`, `business_automation_settings`, `automation_runs`, `automation_cron_secret_matches()`; seeds the birthday automation **off**). Rollback: `supabase/rollbacks/20261010200000_automations.down.sql`.
- Edge Function `supabase/functions/run-automations/` (`verify_jwt = false` in config.toml; its own auth: cron secret from Vault, or super-admin JWT). Modes: `run`, `preview`, `test`. Logic tests: `npx vitest run --config supabase/functions/run-automations/vitest.config.ts` (9 passing). Not type-checked with Deno yet (the sandbox couldn't reach esm.sh).
- Daily schedule: `supabase/setup/automations_cron.sql` (pg_cron + pg_net, secret in Vault, 13:00 UTC). Replace `<PROJECT_REF>` before running.
- Front end: `src/lib/automations.ts`, `src/pages/admin/AdminAutomations.tsx`, pet form birth day (`PetForm.tsx`, only sent when set so saving works before the migration).

### Production steps: 1-3 DONE (2026-10-10), step 4 is Genesis's

1. **Database:** done. Genesis ran the migration in the SQL Editor (the Supabase MCP `execute_sql` times out on large DDL). Recorded in `supabase_migrations.schema_migrations` as `20261010200000`. Verified: 1 automation row (enabled = false), 4 policies, `pets.birth_day`.
2. **Edge Function:** done. `run-automations` v1 deployed via Supabase MCP with `verify_jwt = false`.
3. **Daily schedule:** done. `pg_cron` + `pg_net` enabled, Vault secret `automations_cron_secret` created, job `run-automations-daily` at `0 13 * * *`. Tested through `pg_net`: real secret -> 200 `{"ok":true,"mode":"run","results":{}}`; wrong secret -> 401. (The 200 also shows the Resend key is configured.) Note: `pg_net` landed in the `public` schema (advisor warning, low risk).
4. **PENDING (Genesis):** in `/admin/automations`: **Enviarme una prueba**, check the email, use **¿Quién lo recibe hoy?**, and only then switch the automation on.

## Automations v2: business automations, coupons, call list (2026-10-11, LOCAL ONLY, not committed)

Decisions (Genesis, 2026-10-10/11):
- Each business builds its own automations (templates + 4-step builder: When → Conditions → Action → Review and save). Grumi's own (trial ending, past due, inactive business, onboarding not finished) stay in `/admin/automations`.
- All triggers from the brainstorm **except vaccination**. Pet birthday and client inactive (and welcome) can carry a gift: % off, $ off, free service or free product; unique per-client code or a shared code the business chooses.
- Clients can type a code when **booking online** (validated and shown, kept on the appointment, applied at checkout).
- Grooming due: as a message with a booking link **and/or** a staff **call list** ("Para llamar") with outcomes Booked / Call back / No answer / Not interested.
- Who manages: managers **and admin staff** (access role admin/manager). Everyone in the business can work the call list and use coupons at checkout.
- SMS is built but stays off until Twilio secrets exist (`TWILIO_*`); "client's preference" falls back to email.
- Preset notifications vs automations split agreed (presets = operational on/off; marketing/reports = automations). The presets page tidy-up is **not built yet**.
- Payment security questions S-10 a/b/c: Genesis chose to answer them **after** this feature.

Code:
- Migration `supabase/migrations/20261010220000_automations_builder_coupons_follow_ups.sql` (+ rollback). Expand-only. Tested on a local Postgres with a stub schema: apply / re-run / rollback / re-apply OK; 36 coupon + permission checks pass (cross-business isolation, personal codes need the right client/phone, no double use, max uses, no direct redemption writes, anon can't read offers).
- Edge Function `supabase/functions/run-automations/`: `catalog.ts` (shared with the web app: triggers, actions, report sources/columns, templates, schedule/date helpers, coupon math), `engine.ts`, `reports.ts`, `delivery.ts`, `index.ts`. Deno type-check passes (with an import map to npm supabase-js); `catalog.test.ts` + `logic.test.ts`: 30 tests pass.
- Web app: `src/pages/AutomationsPage.tsx`, `src/pages/FollowUpsPage.tsx`, `src/components/automations/*`, `src/lib/{automations,coupons,followUps,automationsI18n}.ts`, `src/hooks/useCanManageAutomations.ts`; coupon box in `TransactionCreate.tsx` and `PublicBookingPage.tsx`; routes `/:slug/automations`, `/:slug/follow-ups`; sidebar links; admin page rewritten on the same builder.
- Feature key `automations` (seeded Dev / super admins) gates the pages; turn it Live in Admin → Funciones when ready.
- Typecheck: no new errors in these files (her local `node_modules` lacks `@testing-library/*` and `@playwright/test`, so the ratchet shows unrelated test-file errors there; CI installs them). ESLint: clean except existing warnings/`any`s in `TransactionCreate.tsx`.

### PENDING production steps (each needs Genesis's OK in that session)
1. Run the migration in the SQL Editor (one transaction) and record it: `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261010220000','automations_builder_coupons_follow_ups')`. The Supabase MCP `execute_sql` times out on large DDL.
2. Deploy `run-automations` (all six .ts files) with `verify_jwt = false`: `npx supabase functions deploy run-automations --project-ref ehjrykgwfwgckfpcjmka --no-verify-jwt` from her Mac.
3. Change the cron to every 15 minutes: re-run `supabase/setup/automations_cron.sql` with the project ref (safe to re-run; keeps the Vault secret).
4. Try it on localhost (feature is Dev-only for super admins), then turn `automations` Live in Admin → Funciones.

Not built yet: preset-notifications page tidy-up; per-pet "weeks between groomings" field in the pet form (the column `pets.grooming_interval_weeks` exists); XLSX reports (CSV for now).

## Other open items

- The `work/genesis` branch on GitHub should be deleted (already merged; the session couldn't delete branches). Genesis can delete it from github.com/Stratum-PR/pet-hub/branches.
- The admin-side "who sees it" roles/plans and the feature list are hard-coded in `FeatureSettingsTable.tsx` (`FEATURE_GROUPS`); add a key there when code starts checking a new feature.
- Possible next steps for size: five decorative SVGs in `public/brand` (~7.5 MB).

## Remediation merged into dev (2026-10-10)

Jovaniel's `remediation` branch was merged into `dev` (no deploy). It is the cleanup and security-fix work tracked in [REMEDIATION_QUEUE.md](REMEDIATION_QUEUE.md) and [FIX_LOG.md](FIX_LOG.md). For Genesis's work on `dev` this means:

- **CI runs on every push to `dev`** (`.github/workflows/ci.yml`): `check` (typecheck and lint ratchets, so new type/lint errors fail; vitest) and `db-tests` (payments, security/RLS suite and smoke E2E on a local Supabase stack). Run `npm run check` before pushing. Gates: `npm run check`, `npm run build`.
- **dual-frontend** (`.github/workflows/dual-frontend.yml`) runs the smoke E2E against `main`'s and `dev`'s frontend whenever migrations, Edge Functions, test env or e2e change. A migration that breaks `main` (production) fails it.
- **Migrations must stay expand-only** while `main` and `dev` differ (one shared database): add, don't rename/drop/tighten. New migration timestamps must be later than every file in `supabase/migrations/`. Production's migration history is incomplete: never `supabase db push`; apply via the SQL editor + `migration repair` (see OWNER_ACTIONS).
- **Routes are lazy-loaded** (`src/App.tsx` `lazyRoute`): add new pages the same way. Selects on `staff`/`profiles`/`businesses` use explicit column lists (`STAFF_PUBLIC_COLUMNS` etc.); don't add `select('*')` there.
- **The database parts of remediation are not applied to production yet** (OWNER_ACTIONS Part A and D5–D9, Jovaniel's). The frontend works with or without them.
- Second merge (2026-10-10 evening) added: staff and kiosk-manager PIN hashing (U11/U12, migrations 20261010210000/220000, **not applied to production**; the kiosk falls back to today's behavior until they are), the ProtectedRoute reload fix (U22), a faster dual-frontend gate whose checks now always report (U07c/U24), the QR print stored-XSS fix (U25), sign-up Enter key (U27), Delete for staff with access_role manager/admin (U23), feature-gate loading (U26) and the dead missing-email reminder call removed (U28).
- Third merge (2026-10-10 night) added, **database parts not applied to production** (Jovaniel's OWNER_ACTIONS D12/D13):
  - **Business settings are manager-only** (U29, migration 20261010230000): only managers/admins (and super admins) can update the `businesses` row, and a trigger blocks changes to billing columns (`subscription_tier`, `subscription_status`, `trial_ends_at`, `subscription_ends_at`, `stripe_*`) unless the request uses the **service role** (or comes from the SQL editor/cron). A future Stripe/billing Edge Function must use the service-role key; super admins can't change plans from the browser.
  - **Deactivated managers lose manager rights** (U30, migration 20261010240000): staff with access_role admin/manager need `status = 'active'` to delete clients/pets/appointments, edit the business, manage staff/PINs or read staff private data. Owners (profile role manager) are unaffected.
  - E2E clock pin fix (U31, tests only): pinned-clock flows no longer refresh the auth token on every request.
  - New migration slots on `dev` must be later than `20261010240000`.
- The pre-commit hook's "Hardcoded password" rule now flags only quoted literals.
- Jovaniel keeps working on `remediation` and merges it into `dev` again later. Remediation pulls `dev` in before each round, so Genesis's ATH work flows over.
- Branch protection (OWNER_ACTIONS B4) may soon require PRs on `dev`; if so, Genesis needs a bypass or PRs.

## Not ours (Jovaniel)

- Security decisions: [SECURITY_RISKS.md](SECURITY_RISKS.md). Genesis answered S-1 to S-5; Jovaniel answered S-6 to S-9 on 2026-10-10. **S-10a/b/c (which payment items go first) are back with Genesis** (Jovaniel: payments are her call): ask her at the start of her next session. Also hers: C2 (per-business transaction numbers) and which payment secrets table is live (P2-08). Don't implement other security fixes unless she asks. Jovaniel's S-6a (ATH keys to Supabase Vault) and S-8a (payments function uses staff access tier + active status) touch her payments area: a draft plan is in [REMEDIATION_QUEUE.md](REMEDIATION_QUEUE.md) ("Draft: S-6a / S-8a"); nothing started, he will coordinate with her.
- The `remediation` branch and Jovaniel's to-do list (`docs/OWNER_ACTIONS.md`), including a live hole: any signed-up user can make themselves manager of any business (P0-01), fix ready but not applied.
