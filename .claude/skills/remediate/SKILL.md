---
name: remediate
description: Coordinate a team of worktree agents that apply pending fixes from docs/REMEDIATION_PLAN.md to the `remediation` branch, in parallel waves, with no merge conflicts and nothing broken. Use when asked to continue, rerun or coordinate the remediation.
---

# Remediation coordinator playbook

You are the **coordinator**: you decide what runs, own the shared files, and merge. Workers write fixes.

## 0. Discover (report to the owner before any work)

- Branch: `git branch -r | grep -i remed` → `origin/remediation` (branched from `dev`; kept mergeable into `dev`).
- Read `docs/REMEDIATION_QUEUE.md`, `docs/REMEDIATION_STATUS.md`, `docs/REMEDIATION_PLAN.md`, `docs/FIX_LOG.md`, `docs/OWNER_ACTIONS.md`.
- List what's still pending in code. Production-only steps belong to the owner (OWNER_ACTIONS).
- Gates (npm, not pnpm): `npm run check` (typecheck ratchet + lint ratchet + vitest), `npm run build`, `npm run test:security`, `npm run test:payments`, `npm run test:e2e` (the last three need Docker).
- Build needs no env (the client falls back to placeholders). Use `VITE_SUPABASE_URL=https://placeholder.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=placeholder` to be safe.
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_name.sql`; rollbacks: `supabase/rollbacks/<same>.down.sql`. The test stack starts from `test-env/supabase/prod-schema-snapshot.sql` (version `20261007235900`) and applies newer migrations.
- Generated types: `src/integrations/supabase/types.ts`; regenerate with the test stack up: `npx supabase --workdir .test-env gen types typescript --local`.
- Docker: in cloud sessions `dockerd` starts, but Supabase images can't be pulled (ECR blocked, Docker Hub 429). Then CI on each `fix/*` branch is the DB/E2E gate.
- CI: `.github/workflows/ci.yml` (U00) runs on pushes to `dev`, `remediation`, `fix/**`. Check runs with the GitHub MCP `actions_list` (`list_workflow_runs`, branch filter).
- Show the owner the proposed queue and wait for OK.

## 1. Files

- `docs/REMEDIATION_QUEUE.md`: one row per unit (Wave | Unit | Plan item | Owns | Migration slot | Depends on | Status), plus "Done when", "Needs you", "Notes". **Only the coordinator edits it.**
- This skill.

## 2. Rules

- Units running at the same time never share an Owns path. Wide changes (formatting, unused-export cleanup, renames) run alone.
- Shared files have one writer, the coordinator: FIX_LOG, OWNER_ACTIONS, REMEDIATION_STATUS, the queue, CLAUDE.md/AGENTS.md, `src/lib/translations.ts`, package.json + lockfile, generated DB types, `scripts/*-baseline.json`. Workers put needed changes in their report. `scripts/test-env-security.mjs` has one owner per wave.
- Each unit gets a pre-assigned migration timestamp, later than every migration on `remediation` and `dev`. New files only; never edit an old migration.
- Migrations are expand-only: the `dev` frontend must work before and after the owner applies them.
- Before each wave: `git merge origin/dev` into `remediation` (never rebase), run the gates, push. Conflicts with the owner's in-flight work → ask.
- Test names/numbers: check for collisions at merge and renumber if needed.
- Merge one unit at a time, only after (a) the worker's report, (b) green CI on its branch, (c) green CI on `remediation`'s last push. Use `git merge --no-ff`. Then run the full local gate on the combined result, apply the shared-file changes (FIX_LOG entry etc.), and push. Push after every unit.
- Red → back out the merge, mark `blocked`, and send the failure to the worker (SendMessage). Never fix another unit's code in the merge commit.
- If a fix changes behavior users or staff would notice beyond what was asked → don't merge; explain to the owner with a recommendation and wait.
- Nothing to `main`, `dev` or production. No `supabase db push`, no seeding prod, no production keys.

## 3. Workers

One Agent per unit, `isolation: "worktree"`, in the background, all of a wave started in one message. Each prompt has:
- unit id, plan item, Owns paths, migration slot;
- setup: `git fetch origin remediation && git checkout -b fix/<unit>-<slug> origin/remediation && npm ci`;
- failing test first (when the test can't run locally, push the test-only commit first so CI shows it red), then the smallest fix, plus a rollback script for DB changes;
- local gates: `npm run check`, build with placeholder env;
- never skip or edit an existing test (moving a `known()` to `check()` in the security suite is the expected flip);
- push only its own branch, never `remediation`/`dev`/`main`;
- commit trailers as given by the session.
- Report: branch, commits, gate results with counts, CI run + result, FIX_LOG entry text, DECISIONS line, shared-file changes needed, anything unsure.

## 4. Keeping the owner informed

- Print a progress table (Unit | Work | Status) whenever a unit changes status, plus what needs the owner.
- When nothing is due to wake you, use `send_later` check-ins every ~6–10 min to check CI on branches in review and on `remediation`.
- Anything only the owner can do goes under "Needs you" right away, with what to do and what to send back.
- Say clearly when agent work is done, and list what's left for the owner.

## 5. Housekeeping

- Add `.claude/worktrees/` to `.git/info/exclude`.
- Deleting merged remote `fix/*` branches may fail through the proxy. If so, tell the owner.
