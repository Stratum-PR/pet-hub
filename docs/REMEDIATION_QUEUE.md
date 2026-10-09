# Remediation queue

Run by the coordinator session using [`.claude/skills/remediate/SKILL.md`](../.claude/skills/remediate/SKILL.md). **Only the coordinator edits this file.** Plan: [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) · record: [FIX_LOG.md](FIX_LOG.md) · owner steps: [OWNER_ACTIONS.md](OWNER_ACTIONS.md).

Integration branch: `remediation` (kept mergeable into `dev`: `origin/dev` is merged in before every wave). Workers push `fix/<unit>-<slug>`; the coordinator merges one unit at a time.

Status: `todo` · `running` · `review` (worker done, waiting on CI/merge) · `merged` · `blocked`.

| Wave | Unit | Plan item | Owns (paths it may change) | Migration slot | Depends on | Status |
|---|---|---|---|---|---|---|
| 0 | U00 | P1-04 CI on every push (check, build, test:security, test:payments, test:e2e) + typecheck ratchet path fix | `.github/workflows/ci.yml` (new), `scripts/typecheck-ratchet.mjs` | – | – | running |
| 1 | U01 | P2-07 remove browser-side `role` write | `src/pages/Register.tsx`, its new unit test | – | U00 | todo |
| 1 | U02 | P3-01 orphan files (Appendix B minus pages, plus `src/pages/Admin.tsx`) | the orphan files themselves (deletions) | – | U00 | todo |
| 1 | U03 | P3-02 legacy pages `Business{Customers,Pets,Services,Reports,Settings}`, `ClientPlaceholder` | those page files, `src/components/AppSidebar.tsx` | – | U00 | todo |
| 1 | U04 | P2-03 staff column privileges | `supabase/migrations/20261009110000_*.sql`, `supabase/rollbacks/20261009110000_*.down.sql`, `scripts/test-env-security.mjs` | 20261009110000 | U00 | todo |
| 1 | U05 | Reminder greets with `first_name` when `name` is empty | `supabase/functions/send-appointment-reminder/**` | – | U00 | todo |
| 1 | U06 | P4-01 lazy-load routes | `src/App.tsx`, new `src/components/RouteFallback.tsx` | – | U00 | todo |
| 1 | U07 | P1-13 dual-frontend CI gate (main's frontend vs new schema) | `.github/workflows/dual-frontend.yml` (new), `scripts/test-env-dual.mjs` (new) | – | U00 | todo |
| 2 | U08 | P2-01 staff RLS | `supabase/migrations/20261009120000_*.sql`, matching rollback, `scripts/test-env-security.mjs` | 20261009120000 | U04 | todo |
| 2 | U09 | P3-04 explicit column lists on `staff`/`profiles`/`businesses` | the `.from('staff'\|'profiles'\|'businesses')` select call sites (listed by the worker at start) | – | wave 1 | todo |
| 2 | U10 | P3-08 README + cross-platform scripts | `README.md`, new `scripts/*.sh` / `*.mjs` replacements | – | – | todo |
| 3 | U11 | P2-02 hash staff PINs | `supabase/migrations/20261009130000_*.sql`, rollback, kiosk/PIN code, `scripts/test-env-security.mjs` | 20261009130000 | U08, U09 | todo (stop before: owner review) |
| 4 | U12 | P2-04 hash `businesses.kiosk_manager_pin` | `supabase/migrations/20261009140000_*.sql`, rollback, kiosk manager code, `scripts/test-env-security.mjs` | 20261009140000 | U11 | todo (stop before: owner review) |

**Not queued** (blocked on a person or deferred): P2-01 businesses (SECURITY_RISKS S-7, Genesis) · P2-01 clients/pets/appointments (rule: may employees delete them?) · P2-05 demo workspace · P2-06 (production row counts) · P2-08, C4 (Genesis) · C5 (decision) · P3-03, P3-05, P3-06 (wide/high-risk, later run) · npm audit (lockfile) · P1-01, P1-02, P1-10, P1-12 (OWNER_ACTIONS Part B).

## Done when

- **Agent work:** every queued row through wave 2 is `merged` (waves 3–4 after the owner's go-ahead), CI is green on `remediation`'s last push, `remediation` still merges cleanly into `dev`, and each unit has a FIX_LOG entry.
- **Whole remediation:** the above plus every item in OWNER_ACTIONS.md (Parts A–D) and the "Needs you" list below checked off.

## Needs you

- [ ] **Areas you're actively changing on `dev`**: tell the coordinator, so units that touch them (U02/U03 deletions, U06 `App.tsx`, U09 selects) can be moved or narrowed.
- [ ] **Before wave 3 (U11, U12):** go/no-go on PIN hashing; it changes what `main`'s kiosk can read on the shared database.
- [ ] **Delete merged `fix/*` branches** if the coordinator reports the proxy refused it.

## Notes

- Shared files (coordinator only): FIX_LOG, OWNER_ACTIONS, REMEDIATION_STATUS, this queue, CLAUDE.md/AGENTS.md, `src/lib/translations.ts`, package.json/package-lock.json, `src/integrations/supabase/types.ts`, `scripts/typecheck-baseline.json`, `scripts/lint-baseline.json`. `scripts/test-env-security.mjs` has one owner per wave (listed above).
- No local DB stack in cloud sessions (Docker images can't be pulled), so CI on each `fix/*` branch is the DB/E2E gate. Until U00 merges, no branch has CI.
- Every migration unit must leave the `dev` frontend working both before and after the owner applies the migration (expand-only, PLAN §9 rule 1).
- 2026-10-09: wave 0 started. `dev` synced (c3521c2); trial gates: lint 421 none new, vitest 109/109, tsc 39, build OK.
