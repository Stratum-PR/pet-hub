## Change unit

**ID:** <!-- e.g. P2-03, from docs/REMEDIATION_PLAN.md; "feature" for non-remediation work -->
**What and why:**

**Touches the database or an Edge Function?** <!-- yes/no; if yes, list migrations/functions -->

## Gates (docs/REMEDIATION_PLAN.md §2) — before → after

- [ ] Test written first and shown failing (or the gap shown, for tooling)
- [ ] `npm run check` (typecheck ratchet + lint ratchet + vitest): no new errors
- [ ] `npm run build`
- [ ] Smoke E2E (once P1-07 exists)
- [ ] `npm run test:security` and `npm run test:payments` on the local stack (`npm run test:env:reset`)
- [ ] Manual walkthrough of the affected screens

| Gate | Before | After |
|---|---|---|
| TypeScript errors | | |
| Lint problems | | |
| vitest | | |
| test:security | | |
| test:payments | | |

## Database / Edge Function changes (skip if none)

- [ ] New migration only; no applied migration edited
- [ ] Expand-only while `main` ≠ `dev` (no drop/rename/tightened constraint used by `main`) — §9 rule 1
- [ ] Rollback script in `supabase/rollbacks/`, tested apply → rollback → re-apply
- [ ] `main`'s frontend checked against the new schema
- [ ] Production steps written in `docs/FIX_LOG.md` (backup first: `npm run db:backup`)

## Record

- [ ] `docs/FIX_LOG.md` entry (date, unit, files, gates before → after, rollback, production steps)
- [ ] After it is applied in production: tag `fix/<unit ID>` and the backup ID in the FIX_LOG entry
