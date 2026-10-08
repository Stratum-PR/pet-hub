# Remediation status (resume point)

Updated 2026-10-08. Read this first when resuming; the plan is [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), the per-unit record is [FIX_LOG.md](FIX_LOG.md).

Branch `remediation` (local only, from `dev` at `abb6350`; never pushed). Working rules: one unit at a time through the §2 protocol; no push/PR/merge; nothing run against hosted Supabase/Vercel; production steps are prepared for Jovaniel; units run without per-step approval and stop only at phase ends, failing gates, real decisions, or production actions.

## Done (committed on `remediation`)

| Unit | What | Production |
|---|---|---|
| P0-01 | Profile identity lock (trigger + `set_profile_business_id` revoke) | **Pending: Jovaniel applies** (FIX_LOG steps) |
| P0-04 | `npm run db:backup` / `db:restore-check`, docs/BACKUP_RESTORE.md | **Pending: take the first backup** |
| P0-02/03/05 | `scripts/prod-checks/p0-checks.sql`, docs/PHASE0_PRODUCTION_CHECKS.md, main-vs-prod review | **Pending: run the SQL, auth checklist, live smoke test; paste results** |
| P0-06 | `clients.name` restored (client signup broken in prod) | **Pending: apply after backup** |
| Plan | Phase 4 = route code splitting only; keep text ids (decisions 7, 8) | — |
| P1-06 | Vitest `unit` + `dom` projects; SWC cache fix (no env var needed) | — |
| P1-03 stage 1 | `npm run typecheck`, `typecheck:ratchet`, `check`; baseline in scripts/typecheck-baseline.json | — |
| P1-03 stage 2 | 39 type-only errors fixed, bundle proven byte-identical (82 → 43) | — |

Gates now: tsc 43 (ratcheted) · lint 422 (345/77) · vitest 104/104 · build OK (main 4,016,280 B) · test:security 23/23 · test:payments 24/24.

## Next, in order

1. **Jovaniel (production):** PHASE0_PRODUCTION_CHECKS §1–3 → paste results → `npm run db:backup` + `db:restore-check` → apply P0-01 and P0-06 (FIX_LOG steps) → walkthrough.
2. **Real-bug units from P1-03** (after P1-07, one small unit each with a test): Admin.tsx service handlers, TimeKiosk `'clocking'`, Landing/Register props, `qrCode.ts` `replaceAll` on old Safari, missing `dispatch_staff_missing_email_reminders`. List in FIX_LOG → P1-03 stage 2.
3. **P1-05** lint ratchet (same pattern as `typecheck-ratchet.mjs`; also add `.test-env/` to ESLint ignores).
4. P1-09 PR template + tags, P1-11 repo hygiene (`.env`, `supabase/.temp/` untracked), P1-08 known-failing security tests, **P1-07** Playwright smoke E2E (9 flows), P1-13 dual-frontend gate, P1-04 PR CI workflow.
5. Need Jovaniel: P1-01 (`supabase db pull` baseline, read-only against prod), P1-02 drift check secrets, P1-10 branch protection, P1-12 Sentry DSN.

## Open findings to schedule

- `npm audit`: 13 pre-existing (7 high: `xlsx` no npm fix, `sharp`, Tailwind 3 toolchain; 6 moderate incl. `react-router`). None from new dev deps. Candidate unit after Phase 1.
- `send-appointment-reminder`: greet with `first_name` when `name` is empty (Edge Function deploy).
- `dispatch_staff_missing_email_reminders` migration never applied to prod.
- `complete_manager_signup(text)` overload is broken (P2-06).
- Local stack lacks production's function/table privileges (snapshot has no GRANT/REVOKE) → P1-01 must capture them.
