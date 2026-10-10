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
| 1 | U07 | P1-13 dual-frontend CI gate (main's frontend vs new schema) | `.github/workflows/dual-frontend.yml` (new), `scripts/test-env-dual.mjs` (new) | – | U00 | review (final CI 38023437747 + dual-frontend 38023437745 on 89f2cff were running at stop; check them) |
| 2 | U08 | P2-01 staff RLS | `supabase/migrations/20261009120000_*.sql`, matching rollback, `scripts/test-env-security.mjs` | 20261009120000 | U04 | merged |
| 2 | U09 | P3-04 explicit column lists on `staff`/`profiles`/`businesses` | the `.from('staff'\|'profiles'\|'businesses')` select call sites (listed by the worker at start) | – | wave 1 | merged |
| 2 | U10 | P3-08 README + cross-platform scripts | `README.md`, new `scripts/*.sh` / `*.mjs` replacements | – | – | merged |
| 2 | U16 | CI infra: ATH simulator base image from public.ecr.aws (Docker Hub 429s block `db-tests`) | `test-env/ath-simulator/Dockerfile` | – | – | merged |
| 3 | U13 | P2-01 clients: employees can't delete clients (decision 9) | `supabase/migrations/20261009150000_*.sql`, matching rollback, `scripts/test-env-security.mjs`, employee-facing delete controls for clients (listed by the worker) | 20261009150000 | U08 | merged |
| 4 | U14 | P2-01 pets: employees can't delete pets (decision 9) | `supabase/migrations/20261009160000_*.sql`, matching rollback, `scripts/test-env-security.mjs`, employee-facing delete controls for pets | 20261009160000 | U13 | merged |
| 5 | U15 | P2-01 appointments: employees can't delete, may still cancel (decision 9) | `supabase/migrations/20261009170000_*.sql`, matching rollback, `scripts/test-env-security.mjs`, employee-facing delete controls for appointments | 20261009170000 | U14 | review (code done, security ✓ 2 known; CI red only on flaky E2E flow 4 → waits on U17, then re-run) |
| 5 | U17 | E2E flakes: flow 4 (cancel confirm not awaited; retry not idempotent; sometimes lands on client portal after login) and flow 7 (PR-midnight date edge) made deterministic, same assertions (owner-approved 2026-10-10) | `e2e/04-edit-cancel-appointment.spec.ts`, `e2e/07-payroll.spec.ts`, new `e2e/` helper | – | – | running (relaunched 2026-10-10 13:20 UTC, branch `fix/U17-e2e-flakes`) |
| 5 | U18 | Login misroute: a destination lookup slower than 6 s sends every user (staff included) to `/portal` (`LoginForm.tsx` timeout fallback); found via E2E flow 4 | `src/components/LoginForm.tsx`, its new unit test | – | – | running (branch `fix/U18-login-slow-redirect`) |
| 6 | U11 | P2-02 hash staff PINs | `supabase/migrations/20261009180000_*.sql`, rollback, kiosk/PIN code, `scripts/test-env-security.mjs` | 20261009180000 | U09, U15 | todo (stop before: owner review) |
| 7 | U12 | P2-04 hash `businesses.kiosk_manager_pin` | `supabase/migrations/20261009190000_*.sql`, rollback, kiosk manager code, `scripts/test-env-security.mjs` | 20261009190000 | U11 | todo (stop before: owner review) |

**Not queued** (blocked on a person or deferred): P2-01 businesses (SECURITY_RISKS S-7, Genesis) · P2-05 demo workspace · P2-06 (production row counts) · P2-08, C4 (Genesis) · C5 (decision) · P3-03, P3-05, P3-06 (wide/high-risk, later run) · npm audit (lockfile) · P1-01, P1-02, P1-10, P1-12 (OWNER_ACTIONS Part B).

## Done when

- **Agent work:** every queued row through wave 2 is `merged` (waves 3–4 after the owner's go-ahead), CI is green on `remediation`'s last push, `remediation` still merges cleanly into `dev`, and each unit has a FIX_LOG entry.
- **Whole remediation:** the above plus every item in OWNER_ACTIONS.md (Parts A–D) and the "Needs you" list below checked off.

## Resume here (updated 2026-10-10 ~13:20 UTC)

Order agreed with the owner today: U17 (+ U18 in parallel, no shared paths) → U07 → U15 → ask owner about U11/U12.

1. U07's final runs on 89f2cff: CI 38023437747 check ✓, db-tests ✗ only E2E flow 4 (14/15); dual-frontend 38023437745 dual-main ✓, dual-dev ✗ only flow 4 (fails on dev's own schema too). `remediation`'s last push (CI 38023587012, docs only) is also red only on flow 4 → nothing can merge until U17 lands.
2. U17 running (`fix/U17-e2e-flakes`). Owner approved a one-time waiver of merge rule (c) for U17 (remediation is red on the very test it fixes).
3. U18 running (`fix/U18-login-slow-redirect`): real app bug confirmed by reading `LoginForm.tsx` (6 s race resolves to `/portal` without knowing the role).
4. After U17 merges: U07 and U15 each merge `origin/remediation`, push, wait for green, then merge one at a time (reports in `docs/remediation-pending/`).
5. Rules learned: one remediation push at a time (wait for its CI before the next merge — stacked pushes cancel each other's runs); trust the GitHub API run `status: completed`, not monitor notices; workers stopped by the usage limit leave pushed work on their branch — relaunch from it; job-log blob URLs are blocked by the proxy, use get_job_logs with return_content.

## Needs you

- [ ] **Before waves 6–7 (U11, U12):** go/no-go on PIN hashing; it changes what `main`'s kiosk can read on the shared database.
- [ ] **B4 addendum:** also require `dual-main`/`dual-dev` (workflow "dual-frontend") once U07 merges — note they are path-filtered, so a required check won't report on PRs that don't touch migrations/functions/tests (U07 can add a no-op twin workflow if you want them required everywhere).
- [ ] **Decision (optional):** hide `main`'s employee-visible appointment trash button (after D9 it silently does nothing, with a success toast), or leave it until `main` gets the remediation frontend.
- [ ] **Decision (optional):** should the hidden client/pet Delete buttons also show for staff with access_role manager whose profile role is employee? (Database allows them; UI hides by profile role.)
- [ ] **Delete merged `fix/*` branches** if the coordinator reports the proxy refused it.

## Notes

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
