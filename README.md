# Grumi (pet-hub)

Grumi is a multi-tenant web app for pet grooming businesses. Managers and staff run the appointment book, clients and their pets, services, checkout and payments (ATH Móvil, Stripe), inventory, a staff time kiosk and payroll; clients get a portal and public online booking. Each business is a tenant, separated by Postgres row-level security.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, React Router.
- **Backend:** Supabase (Postgres with RLS, Auth, Storage, Realtime, Edge Functions in `supabase/functions/`).
- **Hosting:** Vercel (`vercel.json`, `middleware.ts`).
- **Tests:** Vitest (unit + jsdom), Playwright (smoke E2E), Node scripts for the access-control and payments suites against a local Supabase stack.

## Prerequisites

- **Node 22** and **npm** (the repo uses `package-lock.json`; CI runs Node 22).
- **Docker** (Docker Desktop or Docker Engine), only for the local Supabase stacks and the database/E2E tests.
- **Supabase CLI:** comes with `npm ci` as a dev dependency. Run it as `npx supabase …`; no global install needed.

Everything below works on Windows, macOS and Linux.

## Setup

```sh
npm ci
```

Then create `.env.local` with the variables from [`.env.example`](.env.example). For the frontend you need:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`
- optional: `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PRICE_BASIC`, `VITE_STRIPE_PRICE_PRO`, `VITE_STRIPE_PRICE_ENTERPRISE`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

Edge Function secrets (e.g. `BARCODE_LOOKUP_API_KEY`, `WAITLIST_NOTIFY_EMAIL`, `WAITLIST_NOTIFY_DRAIN_SECRET`) are set in Supabase, not in `.env.local`. Never put production keys in the repo.

To point the app at a local Supabase instead of a hosted project:

```sh
npm run supabase:start   # default local stack (supabase/config.toml, ports 54320-54329)
npm run setup-env        # writes .env.local from it (or a template if it isn't running); never overwrites
```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Frees port 8080, then starts Vite on http://localhost:8080 |
| `npm run dev:safari` | Same, and opens Safari on macOS |
| `npm run build` | Production build into `dist/` (plus the discoverability files) |
| `npm run preview` | Frees port 4173, then serves `dist/` |
| `npm run check` | Typecheck ratchet + lint ratchet + unit tests (the `check` CI job) |
| `npm test` / `npm run test:watch` | Unit tests only (Vitest) |
| `npm run lint` / `npm run typecheck` | Full ESLint / `tsc` output (the ratchets fail only on problems not in `scripts/*-baseline.json`) |
| `npm run supabase:start` · `supabase:stop` · `supabase:restart` · `supabase:status` | Default local Supabase stack |
| `npm run kill-vite` / `npm run kill-preview` | Free port 8080 / 4173 |

The build needs no env; without one the client uses placeholders. CI builds with `VITE_SUPABASE_URL=https://placeholder.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=placeholder`.

A husky pre-commit hook (`scripts/pre-commit`) runs a security scan on staged files (blocks critical findings, warns on the rest) and writes reports to `reports/` (gitignored).

## Test stack and test suites

The database and E2E tests run against a **separate local test stack** (`scripts/test-env.mjs`): its own folder `.test-env/`, project id `grumi-test`, ports 55420-55429, an ATH Móvil simulator on 55430, fake keys. It never touches the hosted project or the default local stack. It starts from a snapshot of production's schema (`test-env/supabase/prod-schema-snapshot.sql`) and applies every newer migration in `supabase/migrations/`.

```sh
npm run test:env:up       # start (first run downloads images; needs Docker)
npm run test:security     # access-control (RLS) suite; confirmed open holes are reported as "known issues"
npm run test:payments     # payments end-to-end suite
npm run test:e2e          # Playwright smoke E2E (app on :55440); first time: npx playwright install chromium
npm run test:env:reset    # wipe the test database and re-apply every migration
npm run test:env:status   # show URLs
npm run test:env:down     # stop and remove everything
```

## CI

`.github/workflows/ci.yml` runs on every push to `dev`, `main`, `remediation` and `fix/**`, and on PRs to `dev`/`main`. No secrets.

- **`check`:** `npm ci`, `npm run check`, `npm run build` with placeholder env.
- **`db-tests`:** starts the test stack, then `test:payments`, `test:security` and `test:e2e`; logs and the Playwright report are uploaded as artifacts.

## Database migrations

- Add **new** files only: `supabase/migrations/YYYYMMDDHHMMSS_name.sql`, with a rollback at `supabase/rollbacks/<same name>.down.sql`. Never edit a migration that already exists.
- Keep them expand-only: the currently deployed frontend must work both before and after the migration is applied.
- Test locally with `npm run test:env:reset` (or `up`) and the suites above; CI does the same.
- Regenerate types with the test stack up: `npx supabase --workdir .test-env gen types typescript --local` → `src/integrations/supabase/types.ts`.
- **Production is applied by the owner, by hand:** take a backup (`npm run db:backup`, check it with `npm run db:restore-check`, see [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)), paste the migration into the Supabase SQL editor, then record it with `npx supabase migration repair --status applied <version>`. **Never run `supabase db push`**: production's migration history is incomplete, so it would replay old migrations. Steps per change are in [docs/OWNER_ACTIONS.md](docs/OWNER_ACTIONS.md).

## Docs

- Remediation: [REMEDIATION_PLAN.md](docs/REMEDIATION_PLAN.md) (plan and decisions), [REMEDIATION_STATUS.md](docs/REMEDIATION_STATUS.md) (where things stand), [REMEDIATION_QUEUE.md](docs/REMEDIATION_QUEUE.md) (units in flight), [FIX_LOG.md](docs/FIX_LOG.md) (one entry per change: gates, rollback, production steps), [OWNER_ACTIONS.md](docs/OWNER_ACTIONS.md) (everything only the owner can do, including production steps).
- Security: [SECURITY_RISKS.md](docs/SECURITY_RISKS.md) (open decisions), [SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md), [SECURITY-THREAT-ASSESSMENT.md](docs/SECURITY-THREAT-ASSESSMENT.md), [PAYMENTS_SECURITY_REVIEW.md](docs/PAYMENTS_SECURITY_REVIEW.md).
- Operations: [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md), [PHASE0_PRODUCTION_CHECKS.md](docs/PHASE0_PRODUCTION_CHECKS.md), [FEATURE_ROLLOUT_RUNBOOK.md](docs/FEATURE_ROLLOUT_RUNBOOK.md).
- Features and setup: [README-SUPABASE.md](docs/README-SUPABASE.md), [PAYMENTS.md](docs/PAYMENTS.md), [API_ROUTES.md](docs/API_ROUTES.md), [OAUTH_WORKFLOW.md](docs/OAUTH_WORKFLOW.md), [RATE-LIMITING-GUIDE.md](docs/RATE-LIMITING-GUIDE.md), and the rest of [`docs/`](docs/).

