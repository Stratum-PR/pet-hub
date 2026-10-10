# U07 worker report (saved by the coordinator 2026-10-10, before merge)

Use its FIX_LOG / OWNER_ACTIONS / DECISIONS text when merging U07; delete this file in the merge's docs commit.

---

## U07 / P1-13 (CI) dual-frontend gate: final report (resent; this supersedes the earlier copy)

**The final push's runs had NOT finished when I handed back.** On 89f2cff: CI `check` passed; CI `db-tests`, `dual-main` and `dual-dev` were still running. Check both runs before merging:
- CI: https://github.com/Stratum-PR/pet-hub/actions/runs/38023437747
- dual-frontend: https://github.com/Stratum-PR/pet-hub/actions/runs/38023437745

### Schema regressions
**None.**
- Run 38021661425 flagged one: main's payroll flow (7) failed on remediation's schema and passed on main's own schema. It is a false alarm caused by midnight:
  - The data was seeded at 23:47 Puerto Rico time and the test ran at 00:00.
  - The page showed pay period "octubre 10 - octubre 23", so the shifts seeded "today" (Oct 9) fell into the previous period. The re-run on main's own schema seeded again after midnight and passed.
  - The migrations are identical between ecfe0cd and HEAD, and flow 7 passed on main at ecfe0cd (run 37996639342).
- Every other failure on main and dev also fails on that ref's own schema.

### Branch and commits
Branch `fix/U07-dual-frontend` (pushed only there):
- `0d56ada`: merge of origin/remediation (U09).
- `5276889`: prints the page snapshot of every failed attempt, on both schemas.
- `eaa5fda`: for unexpected failures, prints a digest of the Playwright trace (page URLs, console errors and warnings, page errors, failed requests). A failure with no pass/fail result on the ref's own schema now fails the gate.
- `89f2cff`: anything that would fail the gate (a suspected regression or a failure that isn't listed) is re-run once on a fresh seed of this branch's schema. Only failures that reproduce count; the rest are listed as "not reproduced". If that re-run can't run, the gate fails.

### How it works
`scripts/test-env-dual.mjs <main|dev>`:
1. Fetches the ref, `git archive`s it, deletes its .env files, runs `npm ci` and `npm run build` against the local stack, and refuses to run if the bundle lacks the local URL or still contains a hosted one.
2. Serves `dist/` on :55440 and runs this branch's Playwright specs through `E2E_WEB_COMMAND` / `E2E_JSON_REPORT`.
3. Re-runs each failure with the same frontend on the ref's own schema (`TEST_ENV_MIGRATIONS_DIR` set to the ref's migrations on top of the production snapshot).
4. Re-runs anything that would fail the gate on a fresh seed of this branch's schema.
5. Fails on: a schema regression, an unlisted failure, an expected failure that passed, an entry that matches no test, or an own-schema or confirmation step that couldn't run.

The workflow has jobs `dual-main` and `dual-dev`; the calibration job is gone. Triggers: push to dev, remediation and `fix/**`; PRs to dev/main; workflow_dispatch. Path filters are as specified, plus `playwright.config.ts`. Artifacts are uploaded. No secrets.

### Why run 37996639342 failed
dual-dev failed because flow 4 failed unexpectedly. It also failed on dev's own schema, so it is not a regression.
- It is flaky in the smoke suite itself, not specific to dev. The same test failed in CI on remediation's own frontend (run 38019545715), and on dev it passed on retry (run 38021661425).
- Symptom: the manager ends up on the client-portal screen ("Cuenta de personal") instead of the appointment book. My unconfirmed guess is the 6 s timeout in `src/components/LoginForm.tsx:287-294`, which sends the login to `/portal`.
- Flow 4's retry also isn't idempotent: when the first attempt already moved the appointment to 3 PM, the retry still expects 2 PM.

### Per-ref results
**main** (ad0bfd9, run 37996639342): 7 passed, 8 expected failures, all also failing on main's own schema:
- 3: no "Nueva cita" button.
- 4: no "Historial" tab.
- 4b and 4c: no Historial tab, no E2E-2 fix, and login stays on "Entrando…" when the browser clock is pinned ahead.
- 5: no Historial tab and no per-appointment Quick charge.
- 5c: no header "Cobrar".
- 9: no `/<slug>/reservar` page.
- 10: E2E-3 fix missing.

**dev** (c3521c2, run 38021661425): 10 passed, 5 expected failures, all also failing on dev's own schema:
- 4b and 4c: E2E-2 fix missing.
- 5 and 5b: E2E-1 fix missing.
- 10: E2E-3 fix missing.

### Runs
| Commit | CI | dual-frontend |
|---|---|---|
| 5276889 | failed: flaky flow 4 (38019545715) | failed: dev flow 4 (38019545747) |
| eaa5fda | green (38021661551) | dual-dev green; dual-main failed on the midnight payroll false alarm (38021661425) |
| 89f2cff (final) | `check` passed; `db-tests` still running (38023437747) | still running (38023437745) |

### Local gates (every push)
`npm run check` passed (typecheck ratchet 29, lint ratchet, vitest 119/119). The build with placeholder env passed. I checked the trace digest locally against a synthetic Playwright trace.

### FIX_LOG entry
## 2026-10-10 · P1-13 (CI) · Dual-frontend gate: smoke E2E against main's and dev's frontend
**Status:** done on `fix/U07-dual-frontend` (U07). No app or schema change.

**Change.**
- New `scripts/test-env-dual.mjs`: builds another ref's frontend against the local stack and runs this branch's smoke E2E on it. Per-ref expected failures (main 8, dev 5, each with title, reason and reference). Every failure is re-checked on the ref's own schema; gate-failing results are confirmed on a fresh seed; unexpected failures get page and trace digests.
- New `.github/workflows/dual-frontend.yml` with jobs `dual-main` and `dual-dev`, path-filtered.
- `playwright.config.ts`: optional `E2E_WEB_COMMAND` and `E2E_JSON_REPORT`. `test-env.mjs`: exports `stackEnv`; optional `TEST_ENV_MIGRATIONS_DIR`. Defaults are unchanged.

**Gates.** check ✓ · build ✓ · dual-main 7 passed + 8 expected · dual-dev 10 passed + 5 expected · no schema regressions.

**Rollback.** Revert the merge commit.

### OWNER_ACTIONS B4 addition
Also require the status checks **`dual-main`** and **`dual-dev`** (workflow "dual-frontend") on dev and main. Because of the path filters, a required check will not report on PRs that don't touch those paths. Either require them only once that is acceptable, or add a no-op twin workflow for the other paths.

### DECISIONS line
P1-13 (CI): a dual-frontend failure counts only if it fails on remediation's schema AND reproduces on a fresh seed. One that passes on the ref's own schema is a schema regression and blocks.

### Shared-file changes needed
- Optional npm script: `"test:e2e:dual": "node scripts/test-env-dual.mjs"`.
- For the P1-07 owner:
  - Flow 4's retry is not idempotent.
  - CI runs that cross midnight in Puerto Rico (about 04:00 UTC) can break flow 7.
  - Flow 4 sometimes lands on the client portal after login, on our own frontend too.

### Uncertain
- The final runs had not completed.
- The client-portal root cause for flow 4 is a hypothesis.
- The own-schema comparison swaps only migrations. Edge functions always come from this branch, so an edge-function regression would show up as an unlisted failure, not as a "schema regression".
- I couldn't download artifacts: the proxy blocks the blob storage host.
