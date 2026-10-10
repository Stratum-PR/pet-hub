# Remediation status (resume point)

> **2026-10-10 update:** the agent-team run is tracked in [REMEDIATION_QUEUE.md](REMEDIATION_QUEUE.md) — read its **"Resume here"** section first. Merged on `remediation` since the table below: P1-04 CI (U00), P2-07 (U01), P3-01 (U02), P3-02 (U03), P2-03 (U04), reminder greeting (U05), P4-01 (U06), P2-01 staff (U08), P3-04 (U09), P3-08 (U10), P2-01 clients (U13), P2-01 pets (U14), CI infra (U16). Gates on `remediation` @ the last push: tsc 29 · lint 400 · vitest 119/119 · build OK (main chunk ~1.07 MB) · test:payments 24/24 · test:security ✓ + 3 known issues open · smoke E2E 15/15. Production steps for all of these are in OWNER_ACTIONS Part D (D4–D8).

Updated 2026-10-08. Branch `remediation` is pushed to `origin` for review (Jovaniel evaluates it before merging into `dev`, then `main`). Read this first when resuming; the plan is [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md), the per-unit record is [FIX_LOG.md](FIX_LOG.md).

Branch `remediation` (from `dev` at `abb6350`; Claude pushes it only when Jovaniel asks in that session, as on 2026-10-08 end of day; never PRs or merges). **Everything that needs Jovaniel is in [OWNER_ACTIONS.md](OWNER_ACTIONS.md)**; when a unit adds a production step, append it to that file's Part D. Working rules: one unit at a time through the §2 protocol; no push/PR/merge; nothing run against hosted Supabase/Vercel; production steps are prepared for Jovaniel; units run without per-step approval and stop only at phase ends, failing gates or real decisions; production steps never block: they go to OWNER_ACTIONS Part D and work continues (decided by Jovaniel 2026-10-08).

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
| E2E-2 | Edit dialog opens on the appointment's own date; 4b green, 4c added | Ships with next `dev` deploy (no DB step) |
| E2E-3 | Hidden-feature routes redirect to the dashboard (parent-relative `Navigate`); E2E 10/10b | Ships with next `dev` deploy (no DB step) |
| P1-08 | Security suite reports confirmed holes as known issues (8 open: PIN read, self pay raise, coworker pay, business plan, 4 deletes); a fix that blocks one fails the run until it's moved to `check()` | — |
| P1-11 | Repo hygiene: `supabase/.temp/` untracked, unused UTF-16 `types/database.types.ts` deleted (`.env` was already untracked) | — |
| P1-03 bugs | QR code on Safari 12 fixed (test); kiosk/Landing/Register type-only cleanups; Admin.tsx → P3-01 (orphan); missing reminders RPC → decision C5 | Ships with next `dev` deploy (no DB step) |

Gates now: tsc 39 (ratcheted) · lint 421 (ratcheted) · vitest 109/109 · build OK (main 4,016,581 B) · test:security 24 ✓ + 8 known open · test:payments 24/24 · test:e2e 15/15 (no known-failing).

## Next, in order

1. **Jovaniel:** works through [OWNER_ACTIONS.md](OWNER_ACTIONS.md) on his own schedule (Part A = production P0 steps). Claude continues with items 2–4 meanwhile; production-dependent work (P1-01 baseline, P1-02, P1-10, P1-12, P1-13 QA business) waits for the matching Part B item.
2. **Real-bug units found by P1-07** (each flips a known-failing E2E test): ~~E2E-1~~, ~~E2E-2~~, ~~E2E-3~~ done. Details in FIX_LOG → P1-07.
3. ~~**Real-bug units from P1-03**~~ done (see FIX_LOG); remaining item is decision C5. Was: (one small unit each with a test): Admin.tsx service handlers, TimeKiosk `'clocking'`, Landing/Register props, `qrCode.ts` `replaceAll` on old Safari, missing `dispatch_staff_missing_email_reminders`. List in FIX_LOG → P1-03 stage 2.
4. ~~P1-11~~, ~~P1-08~~ done. **Resume here:** P1-13 dual-frontend gate, P1-04 PR CI workflow (add `npx playwright install --with-deps chromium` + `npm run test:e2e`).
5. Waiting on Jovaniel (OWNER_ACTIONS Parts B and C): P1-01 baseline + reference data, P1-02 secrets, P1-10 branch protection, P1-12 Sentry, P1-13 QA business; decisions on portal booking and TXN numbering.

## Open findings to schedule

- `npm audit`: 13 pre-existing (7 high: `xlsx` no npm fix, `sharp`, Tailwind 3 toolchain; 6 moderate incl. `react-router`). None from new dev deps. Candidate unit after Phase 1.
- `send-appointment-reminder`: greet with `first_name` when `name` is empty (Edge Function deploy).
- `dispatch_staff_missing_email_reminders` migration never applied to prod.
- `complete_manager_signup(text)` overload is broken (P2-06).
- Local stack lacks production's function/table privileges (snapshot has no GRANT/REVOKE) → P1-01 must capture them.
