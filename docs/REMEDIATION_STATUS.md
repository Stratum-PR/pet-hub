# Remediation status (resume point)

Updated 2026-10-08. Branch `remediation` is pushed to `origin` for review (Jovaniel evaluates it before merging into `dev`, then `main`). Read this first when resuming; the plan is [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), the per-unit record is [FIX_LOG.md](FIX_LOG.md).

Branch `remediation` (from `dev` at `abb6350`; Jovaniel pushes it, Claude never does). **Everything that needs Jovaniel is in [OWNER_ACTIONS.md](OWNER_ACTIONS.md)**; when a unit adds a production step, append it to that file's Part D. Working rules: one unit at a time through the §2 protocol; no push/PR/merge; nothing run against hosted Supabase/Vercel; production steps are prepared for Jovaniel; units run without per-step approval and stop only at phase ends, failing gates or real decisions; production steps never block: they go to OWNER_ACTIONS Part D and work continues (decided by Jovaniel 2026-10-08).

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
| P1-05 | `npm run lint:ratchet` (baseline 422); `.test-env` ignored; `npm run check` = both ratchets + vitest | — |
| P1-09 | `.github/pull_request_template.md`; tag `fix/<ID>` when applied (FIX_LOG header) | — |
| P1-07 | Playwright smoke E2E, 9 flows (`npm run test:e2e`); 8 green, flow 5 + check 4b known-failing on bugs E2E-1/E2E-2 | — |
| E2E-1 | Realtime channel crash fixed (`uniqueChannelName` in 4 hooks); flow 5 green + 5b/5c added | Ships with next `dev` deploy (no DB step) |

Gates now: tsc 43 (ratcheted) · lint 422 (345/77, ratcheted) · vitest 108/108 · build OK (main 4,016,367 B) · test:security 23/23 · test:payments 24/24 · test:e2e 12 passed (11 green + 1 known-failing: 4b).

## Next, in order

1. **Jovaniel:** works through [OWNER_ACTIONS.md](OWNER_ACTIONS.md) on his own schedule (Part A = production P0 steps). Claude continues with items 2–4 meanwhile; production-dependent work (P1-01 baseline, P1-02, P1-10, P1-12, P1-13 QA business) waits for the matching Part B item.
2. **Real-bug units found by P1-07** (each flips a known-failing E2E test): ~~E2E-1~~ done, **E2E-2** edit dialog opens on the wrong date and saving reschedules (flips 4b), E2E-3 blank page on hidden-feature redirect. Details in FIX_LOG → P1-07.
3. **Real-bug units from P1-03** (one small unit each with a test): Admin.tsx service handlers, TimeKiosk `'clocking'`, Landing/Register props, `qrCode.ts` `replaceAll` on old Safari, missing `dispatch_staff_missing_email_reminders`. List in FIX_LOG → P1-03 stage 2.
4. P1-11 repo hygiene (`.env`, `supabase/.temp/` untracked), P1-08 known-failing security tests, P1-13 dual-frontend gate, P1-04 PR CI workflow (add `npx playwright install --with-deps chromium` + `npm run test:e2e`).
5. Waiting on Jovaniel (OWNER_ACTIONS Parts B and C): P1-01 baseline + reference data, P1-02 secrets, P1-10 branch protection, P1-12 Sentry, P1-13 QA business; decisions on portal booking and TXN numbering.

## Open findings to schedule

- `npm audit`: 13 pre-existing (7 high: `xlsx` no npm fix, `sharp`, Tailwind 3 toolchain; 6 moderate incl. `react-router`). None from new dev deps. Candidate unit after Phase 1.
- `send-appointment-reminder`: greet with `first_name` when `name` is empty (Edge Function deploy).
- `dispatch_staff_missing_email_reminders` migration never applied to prod.
- `complete_manager_signup(text)` overload is broken (P2-06).
- Local stack lacks production's function/table privileges (snapshot has no GRANT/REVOKE) → P1-01 must capture them.
