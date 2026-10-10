# Remediation queue

Run by the coordinator session using [`.claude/skills/remediate/SKILL.md`](../.claude/skills/remediate/SKILL.md). **Only the coordinator edits this file.** Plan: [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) · record: [FIX_LOG.md](FIX_LOG.md) · owner steps: [OWNER_ACTIONS.md](OWNER_ACTIONS.md).

Integration branch: `remediation` (kept mergeable into `dev`: `origin/dev` is merged in before every wave). Workers push `fix/<unit>-<slug>`; the coordinator merges one unit at a time.

Status: `todo` · `running` · `review` (worker done, waiting on CI/merge) · `merged` · `blocked`.

| Wave | Unit | Plan item | Owns (paths it may change) | Migration slot | Depends on | Status |
|---|---|---|---|---|---|---|
| 0 | U00 | P1-04 CI on every push (check, build, test:security, test:payments, test:e2e) + typecheck ratchet path fix | `.github/workflows/ci.yml` (new), `scripts/typecheck-ratchet.mjs` | – | – | merged |
| 1 | U01 | P2-07 remove browser-side `role` write | `src/pages/Register.tsx`, its new unit test | – | U00 | merged |
| 1 | U02 | P3-01 orphan files (Appendix B minus pages, plus `src/pages/Admin.tsx`) | the orphan files themselves (deletions) | – | U00 | merged |
| 1 | U03 | P3-02 legacy pages `Business{Customers,Pets,Services,Reports,Settings}`, `ClientPlaceholder` | those page files, `src/components/AppSidebar.tsx` | – | U00 | merged |
| 1 | U04 | P2-03 staff column privileges | `supabase/migrations/20261009110000_*.sql`, `supabase/rollbacks/20261009110000_*.down.sql`, `scripts/test-env-security.mjs` | 20261009110000 | U00 | merged |
| 1 | U05 | Reminder greets with `first_name` when `name` is empty | `supabase/functions/send-appointment-reminder/**` | – | U00 | merged |
| 1 | U06 | P4-01 lazy-load routes | `src/App.tsx`, new `src/components/RouteFallback.tsx` | – | U00 | merged |
| 1 | U07 | P1-13 dual-frontend CI gate (main's frontend vs new schema) | `.github/workflows/dual-frontend.yml` (new), `scripts/test-env-dual.mjs` (new) | – | U00 | merged |
| 2 | U08 | P2-01 staff RLS | `supabase/migrations/20261009120000_*.sql`, matching rollback, `scripts/test-env-security.mjs` | 20261009120000 | U04 | merged |
| 2 | U09 | P3-04 explicit column lists on `staff`/`profiles`/`businesses` | the `.from('staff'\|'profiles'\|'businesses')` select call sites (listed by the worker at start) | – | wave 1 | merged |
| 2 | U10 | P3-08 README + cross-platform scripts | `README.md`, new `scripts/*.sh` / `*.mjs` replacements | – | – | merged |
| 2 | U16 | CI infra: ATH simulator base image from public.ecr.aws (Docker Hub 429s block `db-tests`) | `test-env/ath-simulator/Dockerfile` | – | – | merged |
| 3 | U13 | P2-01 clients: employees can't delete clients (decision 9) | `supabase/migrations/20261009150000_*.sql`, matching rollback, `scripts/test-env-security.mjs`, employee-facing delete controls for clients (listed by the worker) | 20261009150000 | U08 | merged |
| 4 | U14 | P2-01 pets: employees can't delete pets (decision 9) | `supabase/migrations/20261009160000_*.sql`, matching rollback, `scripts/test-env-security.mjs`, employee-facing delete controls for pets | 20261009160000 | U13 | merged |
| 5 | U15 | P2-01 appointments: employees can't delete, may still cancel (decision 9) | `supabase/migrations/20261009170000_*.sql`, matching rollback, `scripts/test-env-security.mjs`, employee-facing delete controls for appointments | 20261009170000 | U14 | merged |
| 5 | U07b | Dual-frontend gate: flow 7 as `mayPass` in EXPECTED.dev (same U22 ProtectedRoute race as flow 4; fails on dev's own schema too, run 38066965363 attempt 2) — owner OK 2026-10-10 | `scripts/test-env-dual.mjs` | – | U07 | merged |
| 5 | U17 | E2E flakes: flow 4 (cancel confirm not awaited; retry not idempotent; sometimes lands on client portal after login) and flow 7 (PR-midnight date edge) made deterministic, same assertions (owner-approved 2026-10-10) | `e2e/04-edit-cancel-appointment.spec.ts`, `e2e/07-payroll.spec.ts`, new `e2e/` helper | – | – | merged |
| 5 | U18 | Login misroute: a destination lookup slower than 6 s sends every user (staff included) to `/portal` (`LoginForm.tsx` timeout fallback); found via E2E flow 4 | `src/components/LoginForm.tsx`, its new unit test | – | – | merged |
| 5 | U19 | Feature-gated routes redirect to the dashboard before feature rules/tier load (reload or deep link to appt-book etc. bounces to dashboard); found by U17 | `src/pages/Index.tsx`, its new unit test, optional new `src/lib/featureGate.ts` | – | – | merged |
| 5 | U20 | Payroll default pay-period anchor uses the UTC date (from 20:00 PR the current period starts tomorrow); found by U17 | `src/pages/Payroll.tsx`, `src/hooks/useSupabaseData.ts` (anchor only) | – | – | merged |
| 5 | U21 | Same UTC-date pay anchor default in `EmployeePayroll.tsx`, `EmployeeTimesheet.tsx`, `BusinessSettingsPage.tsx` (the settings form can save tomorrow's date after 20:00 PR); found by U20 | those 3 files | – | U20 | merged |
| 6 | U22 | ProtectedRoute reload race: a manager is bounced to `/portal` when the profile loads after the client-link check (found by the U15 worker; makes E2E flow 4 flaky; listed as `mayPass` in dual-dev) | `src/components/ProtectedRoute.tsx` (verify), its new unit test | – | – | running (started 18:25 UTC from cfe4db4, owner OK to start before dev-sync CI) |
| 6 | U11 | P2-02 hash staff PINs | `supabase/migrations/20261010210000_*.sql`, rollback, kiosk/PIN code, `scripts/test-env-security.mjs` | 20261010210000 (was 20261009180000; renumbered after dev's 20261010200000_automations) | U09, U15 | running (started 18:25 UTC from cfe4db4) |
| 7 | U12 | P2-04 hash `businesses.kiosk_manager_pin` | `supabase/migrations/20261010220000_*.sql`, rollback, kiosk manager code, `scripts/test-env-security.mjs` | 20261010220000 (was 20261009190000) | U11 | todo (owner go-ahead 2026-10-10; starts after U11 merges) |
| 8 | U23 | Show the client/pet Delete buttons to staff with access_role manager (the database already allows them; UI hides by profile role) — owner OK 2026-10-10 | client/pet delete controls (listed by the worker) + unit test | – | U22 | todo (after U12) |
| 8 | U24 | B4: no-op twin of `dual-frontend` for PRs outside its paths, so `dual-main`/`dual-dev` can be required checks — owner OK 2026-10-10 | `.github/workflows/dual-frontend-skip.yml` (new) | – | U07 | todo (after U12) |
| 8 | U25 | Review `dangerouslySetInnerHTML` / `document.write` in `BusinessSettingsPage.tsx` (QR print path; possible XSS) — owner OK 2026-10-10 | `src/pages/BusinessSettingsPage.tsx` (QR print only), new test | – | U21 | todo (after U12) |
| 8 | U26 | `useFeatureRollout` exposes a settled/error flag; replaces U19's 10 s fallback — owner OK 2026-10-10 | `src/hooks/useFeatureRollout*`, `src/lib/featureGate.ts`, their tests | – | U19 | todo (after U12) |
| 8 | U27 | Client sign-up: Enter on step 1/2 submits the whole form early — owner OK 2026-10-10 | `src/pages/Register.tsx` (+ its test) | – | U01 | todo (after U12) |
| 8 | U28 | C5: drop the dead `dispatch_staff_missing_email_reminders` call (owner decision 2026-10-10) | the caller (listed by the worker) | – | – | todo (after U12) |

**Not queued** (blocked on a person or deferred): P2-01 businesses (SECURITY_RISKS S-7, Genesis) · P2-05 demo workspace · P2-06 (production row counts) · P2-08, C4 (Genesis) · C5 (decision) · P3-03, P3-05, P3-06 (wide/high-risk, later run) · npm audit (lockfile) · P1-01, P1-02, P1-10, P1-12 (OWNER_ACTIONS Part B).

## Done when

- **Agent work:** every queued row through wave 2 is `merged` (waves 3–4 after the owner's go-ahead), CI is green on `remediation`'s last push, `remediation` still merges cleanly into `dev`, and each unit has a FIX_LOG entry.
- **Whole remediation:** the above plus every item in OWNER_ACTIONS.md (Parts A–D) and the "Needs you" list below checked off.

## Resume here (updated 2026-10-10 ~15:30 UTC, owner near usage limit)

State: `remediation` has U00–U06, U08–U10, U13, U14, U16–U21 merged, plus `origin/dev` merged in at 0b723a8 (Vercel `ignoreCommand` via `scripts/vercel-ignore-build.sh`: only main/dev deploy; unused media moved to `designs/marketing-assets`). That merge needed one type-only fix in `src/pages/AdminDashboard.tsx`: dev's new users panel used `Business`, but U09 narrowed the list to `ListedBusiness` (id/slug only used).

Order the owner agreed (do in this order, one merge at a time, wait for remediation CI between):
1. **U07** (`fix/U07-dual-frontend`): needs CI + dual-frontend (dual-main AND dual-dev) green on its latest head (95a05aa, or newer after the remediation sync). Changes since the pending report: `EXPECTED.main` + flow 7 (`mayPass`, U17 clock pin vs main's login hang before 12:00 PR), `EXPECTED.dev` + flow 4 (`mayPass`, ProtectedRoute race = U22). FIX_LOG: main 9 expected, dev 6 expected; describe `mayPass`. Report: `docs/remediation-pending/U07-report.md` (+ B4 addendum, DECISIONS line); delete it in the docs commit.
2. **U15** (`fix/U15-appointments-no-employee-delete`): a worker proved flow 4's failure there is NOT the migration but an app race in `ProtectedRoute` (reload bounces a manager to `/portal` when the profile loads after the client-link check; CI runs 38060099293, 38060579995, 38060947523, 38061346629). Diagnostics were reverted at 549fdcb (green 38061758672); a later temporary diag commit 395c8ae ("bounce rate of 25 hard loads") must be reverted before merging: check the branch head. Report: `docs/remediation-pending/U15-report.md` (FIX_LOG + OWNER_ACTIONS D9).
3. **dev sync** before U11 (owner asked): `git merge origin/dev` (never rebase), gates, push, wait for green.
4. **U11** (P2-02 hash staff PINs, slot 20261009180000) **and U22** (fix the `ProtectedRoute` reload race; owns `src/components/ProtectedRoute.tsx` (verify path) + its test) in parallel. Owner approved both. U11 must keep `main`'s kiosk working on the shared DB (expand-only: e.g. hash alongside plaintext); if impossible, stop and ask the owner. Inputs: FIX_LOG → P3-04 "Readers of `staff.pin`".
5. **U12** (P2-04 hash `businesses.kiosk_manager_pin`, slot 20261009190000) after U11 merges. Same compatibility rule.
6. When all of that is merged and remediation CI is green: send the owner a PushNotification ("current work done").

Rules learned: one remediation push at a time; trust GitHub API `status: completed`; job-log blob URLs are blocked (use get_job_logs return_content); lint from a clean worktree (`.claude/worktrees/` inside the repo inflates the lint ratchet); workers stopped by the usage limit leave pushed work on their branch: relaunch from it.

## Needs you

- [x] **Before waves 6–7 (U11, U12):** go/no-go on PIN hashing — go (2026-10-10, after U15 merges); it changes what `main`'s kiosk can read on the shared database.
- [ ] **B4 addendum** (owner chose: require + no-op twin → U24; after U24 merges, add the checks in branch protection): also require `dual-main`/`dual-dev` (workflow "dual-frontend") once U07 merges — note they are path-filtered, so a required check won't report on PRs that don't touch migrations/functions/tests (U07 can add a no-op twin workflow if you want them required everywhere).
- [x] **Decision:** main's employee trash button after D9 — **leave it** until `main` gets the remediation frontend (2026-10-10).
- [x] **Decision:** show client/pet Delete to staff with access_role manager — **yes** (2026-10-10) → U23.
- [ ] **Delete merged `fix/*` branches** if the coordinator reports the proxy refused it.

## Notes

- 2026-10-10 ~18:30 UTC: owner decision on dev churn: (1) no more `origin/dev` syncs into remediation until U12 is merged; (2) after U12, the owner merges remediation into dev (B1; agents never push dev), which brings U22's race fix to dev so flows 4/7 can come off EXPECTED.dev; dev deploys only with `[deploy]` in the commit message; (3) no gate pinning unit.
- 2026-10-10 ~18:20 UTC: dev sync 065f115 (origin/dev 28435c2: admin portal pages, automations + migration 20261010200000, Vercel [deploy] gate, landing media). Conflicts resolved with owner OK: App.tsx keeps dev's admin routes, loaded lazily (U06); AdminDashboard.tsx deleted on dev, remediation's U09 edits dropped with it (new admin pages use explicit columns). Gates: tsc 29, lint 400, vitest 135/135, build OK. U11/U12 slots renumbered to 20261010210000/220000 (owner OK).
- 2026-10-10 ~18:15 UTC: U15 merged (b7c64f2: CI 38072272882 ✓, dual-frontend 38072272864 ✓; remediation dbcad52 CI 38073922997 ✓). Next: dev sync, then U11 + U22.
- 2026-10-10 ~17:55 UTC: U07b merged (72c7110: CI 38071762534 ✓, dual-frontend 38071762429 ✓). U15 at b7c64f2 (U07b merged in): CI 38072272882 ✓, dual-dev ✓, dual-main running.
- 2026-10-10 ~17:35 UTC: diagnosis: U15 not the cause (attempt 2 "UNEXPECTED FAILURE (fails on dev's own schema too)"; SELECT policies unchanged by the split). Owner chose mayPass for flow 7 on dev → U07b started. Then: merge U07b, sync U15, re-run dual-frontend, merge U15.
- 2026-10-10 ~17:10 UTC: U15 synced with remediation (744c8cc): CI ✓, dual-main ✓, dual-dev ✗ flow 7 (ProtectedRoute-race symptom, but consistent only with U15's migration; remediation 517f340 dual-dev ✓). One re-run confirmed. Owner: diagnose, keep order (nothing else starts). Diagnosis worker started.
- 2026-10-10 ~16:30 UTC: owner decisions: main trash button left as is; U23 (staff-manager Delete), U24 (dual no-op twin), U25 (innerHTML review), U26 (rules-failed flag), U27 (sign-up Enter), U28 (C5 drop call) queued after U12; unused deps/keys not now. C1 closed (public page enough); C3 repair records (Claude prepares SQL after the owner's A1 results).
- 2026-10-10 ~16:20 UTC: U07 merged (head 031a1b9: CI 38065120904 ✓, dual-frontend 38065120915 ✓ — main 7 passed + 8 expected + flow 7 mayPass passed; dev 11 passed + 4 expected). Flows 5/5b dropped from EXPECTED.dev (dev has the E2E-1 fix since 813eb75). remediation's previous push e2cde1b: CI 38063842861 ✓. Next: U15.
- 2026-10-10 ~14:30 UTC: U21 merged (branch CI 38058755289 green; remediation 38058940815 green). Owner OK for U11/U12 after U15. U07 + U15 synced with remediation (cc9ef17 / bf59bd0); U15's CI 38059035682 red, investigating.
- 2026-10-10 ~14:20 UTC: U19 merged (branch CI 38058522206 green, flow 4 first attempt ×3; remediation 38058432187 green). U21 running. Next: U07, then U15 (update each from remediation, green CI, merge).
- 2026-10-10 ~14:10 UTC: U20 merged (owner OK to run in parallel with U19; branch CI 38057951694 green; remediation 38057672269 green). U21 queued (needs owner OK).
- 2026-10-10 ~14:00 UTC: U17 merged (branch CI 38057194260 green; rule (c) waived by owner). U19 (feature-gate redirect race, the remaining flow 4 flake) started. U20 (payroll UTC anchor) queued, needs owner OK. U07/U15 wait for U19.
- 2026-10-10: U18 merged (branch CI 38054885116 green; remediation's previous push 38054673577 green). Merged before U17 because rule (c) was met.
- 2026-10-10 13:20 UTC: U07 and remediation red only on flaky flow 4; plan reordered (U17 first, rule (c) waived once for U17, owner OK). U18 added (login slow-redirect bug). U17 + U18 started.
- Shared files (coordinator only): FIX_LOG, OWNER_ACTIONS, REMEDIATION_STATUS, this queue, CLAUDE.md/AGENTS.md, `src/lib/translations.ts`, package.json/package-lock.json, `src/integrations/supabase/types.ts`, `scripts/typecheck-baseline.json`, `scripts/lint-baseline.json`. `scripts/test-env-security.mjs` has one owner per wave (listed above).
- No local DB stack in cloud sessions (Docker images can't be pulled), so CI on each `fix/*` branch is the DB/E2E gate. Until U00 merges, no branch has CI.
- Every migration unit must leave the `dev` frontend working both before and after the owner applies the migration (expand-only, PLAN §9 rule 1).
- 2026-10-10: U14 merged (CI 38021128236, security 3 known open). U15 started.
- 2026-10-10: U13 merged (CI 38019670337, security 4 known open). Flaky E2E flow 4 noted (failed 2/4 on U13, also in U07). U14 started.
- 2026-10-10: U09 merged (CI 37996504085). U07, U09, U13 workers had stopped at ~22:00 on the account usage limit; U07 and U13 relaunched after the reset.
- 2026-10-09: U16 merged (Docker Hub 429s in CI).
- 2026-10-09: U02 merged (CI 37988832893). Follow-ups queued as notes: unused npm deps + unused translation keys cleanup (coordinator-owned shared files).
- 2026-10-09: U06 merged (coordinator-reviewed). U02 and U07 relaunched from their pushed commits; U09 and U13 started (U09 excludes U02's orphan files; U13 is the only security-suite writer).
- 2026-10-09: U08 merged (CI 37985608351: security 5 known open). U02, U06, U07 workers were stopped (owner); owner chose: coordinator reviews/merges U06's pushed branch, U02 and U07 relaunched from their existing commits.
- 2026-10-09: U04, U10 merged. U08 and U10 started before wave 1 finished (no shared Owns paths with U02/U06/U07; U08 depended only on U04).
- 2026-10-09: owner is not working on `dev` (no conflicts expected). Decision 9 (employee deletes) recorded in PLAN §9 → U13–U15 queued (slots 20261009150000/160000/170000; U11 → 20261009180000 and U12 → 20261009190000 so slots keep merge order).
- 2026-10-09: U01 merged (CI 37979424683). Follow-up found: Enter on step 1/2 of client sign-up submits the whole form (no name/pets) — candidate unit.
- 2026-10-09: wave 1 started (U01–U07); `dev` had no new commits since the wave-0 sync.
- 2026-10-09: U00 merged (CI run 37977573219 green: check ✓, db-tests ✓ — payments 24/24, security 24 ✓ + 8 known, E2E 15/15). Merge rule (c) waived for U00 only: `remediation` had no CI before it.
- 2026-10-09: wave 0 started. `dev` synced (c3521c2); trial gates: lint 421 none new, vitest 109/109, tsc 39, build OK.
