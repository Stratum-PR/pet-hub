# Handoff: Genesis's work on dev (updated 2026-10-10)

Read this at the start of a session with Genesis. It records how she works, what was built on `dev`, and what is still pending. Security decisions live in [SECURITY_RISKS.md](SECURITY_RISKS.md) and belong to Jovaniel (see "Not ours" below).

## How Genesis works

- **Branch:** work directly on `dev`. No separate work branches, no PRs. Never commit to `main`.
- **Checking changes:** Genesis runs the site on her Mac with `npm run dev` (http://localhost:8080) and `git pull`s your pushes. `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Localhost, dev.grumi.pet and grumi.pet all use the **same production Supabase project** (`ehjrykgwfwgckfpcjmka`).
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

## Automations (built, NOT live yet)

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

### PENDING: production steps (Genesis approved them, then asked to leave them pending)

Run in this order, each only with Genesis's OK in that session. She chose **no backup** (Supabase free plan; change is expand-only). The first attempt on 2026-10-10 was cancelled before running, so nothing is applied: `automations` does not exist in production yet.

1. **Database:** run `20261010200000_automations.sql` in one transaction (SQL editor, or Supabase MCP `execute_sql` with `BEGIN; … COMMIT;`). Then record it: `npx supabase migration repair --status applied 20261010200000` (production's migration history is incomplete; never `supabase db push`). Verify: `automations` has 1 row (enabled = false), 4 new policies, `pets.birth_day` exists.
2. **Edge Function:** deploy `run-automations` (`index.ts` + `logic.ts`) with `verify_jwt = false`. It uses existing secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFY_RESEND_API_KEY` (or `RESEND_API_KEY`), optional `NOTIFY_FROM_EMAIL`, `ALLOWED_ORIGINS`.
3. **Daily schedule:** run `supabase/setup/automations_cron.sql` with the project ref filled in. Check `cron.job` and `cron.job_run_details`.
4. Then in `/admin/automations`: **Enviarme una prueba**, check the email, use **¿Quién lo recibe hoy?**, and only then switch the automation on.

Until step 1 runs, `/admin/automations` shows a load-error toast and the pet form's birth day can't be saved (leave it empty).

## Other open items

- The `work/genesis` branch on GitHub should be deleted (already merged; the session couldn't delete branches). Genesis can delete it from github.com/Stratum-PR/pet-hub/branches.
- The admin-side "who sees it" roles/plans and the feature list are hard-coded in `FeatureSettingsTable.tsx` (`FEATURE_GROUPS`); add a key there when code starts checking a new feature.
- Possible next steps for size: five decorative SVGs in `public/brand` (~7.5 MB).

## Not ours (Jovaniel)

- Security decisions: [SECURITY_RISKS.md](SECURITY_RISKS.md). Genesis answered S-1 to S-5 and deferred the rest ("leave all security fixes to Jovaniel"). Don't re-ask; don't implement security fixes unless she asks.
- The `remediation` branch (Jovaniel's fixes, not merged into dev yet). His to-do list (`docs/OWNER_ACTIONS.md` on that branch) includes a live hole: any signed-up user can make themselves manager of any business (P0-01), fix ready but not applied as of 2026-10-08. When it merges, dev.grumi.pet only redeploys with `[deploy]` in the commit message.
