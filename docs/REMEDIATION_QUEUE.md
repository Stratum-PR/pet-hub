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
| 6 | U07c | Dual-frontend gate speed: no retries in dual runs; skip `unreachable` expected failures (screen missing on that ref) instead of timing out + re-checking them; target dual-main ~25 → ~6–8 min — owner OK 2026-10-10 | `scripts/test-env-dual.mjs`, `.github/workflows/dual-frontend.yml` | – | U07b | merged |
| 5 | U17 | E2E flakes: flow 4 (cancel confirm not awaited; retry not idempotent; sometimes lands on client portal after login) and flow 7 (PR-midnight date edge) made deterministic, same assertions (owner-approved 2026-10-10) | `e2e/04-edit-cancel-appointment.spec.ts`, `e2e/07-payroll.spec.ts`, new `e2e/` helper | – | – | merged |
| 5 | U18 | Login misroute: a destination lookup slower than 6 s sends every user (staff included) to `/portal` (`LoginForm.tsx` timeout fallback); found via E2E flow 4 | `src/components/LoginForm.tsx`, its new unit test | – | – | merged |
| 5 | U19 | Feature-gated routes redirect to the dashboard before feature rules/tier load (reload or deep link to appt-book etc. bounces to dashboard); found by U17 | `src/pages/Index.tsx`, its new unit test, optional new `src/lib/featureGate.ts` | – | – | merged |
| 5 | U20 | Payroll default pay-period anchor uses the UTC date (from 20:00 PR the current period starts tomorrow); found by U17 | `src/pages/Payroll.tsx`, `src/hooks/useSupabaseData.ts` (anchor only) | – | – | merged |
| 5 | U21 | Same UTC-date pay anchor default in `EmployeePayroll.tsx`, `EmployeeTimesheet.tsx`, `BusinessSettingsPage.tsx` (the settings form can save tomorrow's date after 20:00 PR); found by U20 | those 3 files | – | U20 | merged |
| 6 | U22 | ProtectedRoute reload race: a manager is bounced to `/portal` when the profile loads after the client-link check (found by the U15 worker; makes E2E flow 4 flaky; listed as `mayPass` in dual-dev) | `src/components/ProtectedRoute.tsx` (verify), its new unit test | – | – | merged |
| 6 | U11 | P2-02 hash staff PINs | `supabase/migrations/20261010210000_*.sql`, rollback, kiosk/PIN code, `scripts/test-env-security.mjs` | 20261010210000 (was 20261009180000; renumbered after dev's 20261010200000_automations) | U09, U15 | merged |
| 7 | U12 | P2-04 hash `businesses.kiosk_manager_pin` | `supabase/migrations/20261010220000_*.sql`, rollback, kiosk manager code, `scripts/test-env-security.mjs` | 20261010220000 (was 20261009190000) | U11 | merged |
| 8 | U23 | Show the client/pet Delete buttons to staff with access_role manager (the database already allows them; UI hides by profile role) — owner OK 2026-10-10 | client/pet delete controls (listed by the worker) + unit test | – | U22 | merged |
| 8 | U24 | B4: no-op twin of `dual-frontend` for PRs outside its paths, so `dual-main`/`dual-dev` can be required checks — owner OK 2026-10-10 | `.github/workflows/dual-frontend-skip.yml` (new) | – | U07 | merged |
| 8 | U25 | Review `dangerouslySetInnerHTML` / `document.write` in `BusinessSettingsPage.tsx` (QR print path; possible XSS) — owner OK 2026-10-10 | `src/pages/BusinessSettingsPage.tsx` (QR print only), new test | – | U21 | merged |
| 8 | U26 | `useFeatureRollout` exposes a settled/error flag; replaces U19's 10 s fallback — owner OK 2026-10-10 | `src/hooks/useFeatureRollout*`, `src/lib/featureGate.ts`, their tests | – | U19 | merged |
| 8 | U27 | Client sign-up: Enter on step 1/2 submits the whole form early — owner OK 2026-10-10 | `src/pages/Register.tsx` (+ its test) | – | U01 | merged |
| 8 | U28 | C5: drop the dead `dispatch_staff_missing_email_reminders` call (owner decision 2026-10-10) | the caller (listed by the worker) | – | – | merged |
| 9 | U29 | P2-01 businesses / S-7a: only managers/admins update the business; trigger blocks billing columns (subscription_tier/status, stripe_*, trial_ends_at) unless service role; slug format CHECK only if every existing slug passes. Expand-only for main and remediation's frontend — owner OK 2026-10-10 | `supabase/migrations/20261010230000_*.sql`, rollback, `scripts/test-env-security.mjs` (owner this wave), minimal frontend if needed | 20261010230000 | – | merged |
| 9 | U30 | `is_business_manager` also requires `staff.status = 'active'` (inactive admin/manager staff can't delete); frontend delete helper mirrors it — owner: tighten (2026-10-10) | new migration, rollback, `src/lib/deletePermissions.ts` (+test), `scripts/test-env-security.mjs` | 20261010240000 | U29 (shares the security suite and `is_business_manager`) | merged |
| 9 | U31 | E2E clock pin: `pinBrowserClock` (`setFixedTime`) can make auth-js treat sessions as expired when pinned ahead of real time (U22 note); tests only, same assertions — owner OK 2026-10-10 | `e2e/clock.ts`, clock calls in e2e flows 4 and 7 | – | – | merged |
| – | S-6a/S-8a | Payments (Genesis's area): **plan only, not started** — see "Draft: S-6a / S-8a" below; owner coordinates with Genesis | – | – | owner + Genesis | needs owner |

**Not queued** (blocked on a person or deferred): P2-01 businesses (SECURITY_RISKS S-7, Genesis) · P2-05 demo workspace · P2-06 (production row counts) · P2-08, C4 (Genesis) · C5 (decision) · P3-03, P3-05, P3-06 (wide/high-risk, later run) · npm audit (lockfile) · P1-01, P1-02, P1-10, P1-12 (OWNER_ACTIONS Part B).

## Done when

- **Agent work:** every queued row through wave 2 is `merged` (waves 3–4 after the owner's go-ahead), CI is green on `remediation`'s last push, `remediation` still merges cleanly into `dev`, and each unit has a FIX_LOG entry.
- **Whole remediation:** the above plus every item in OWNER_ACTIONS.md (Parts A–D) and the "Needs you" list below checked off.

## Resume here (updated 2026-10-10 ~22:05 UTC)

Update 22:05: U29, U30, U31 merged (remediation f2b7c00: CI 38089467042 ✓, dual-frontend 38089467077 ✓; tsc 28 · lint 400 · vitest 226 · build OK). Next: merge remediation into dev (owner-approved, no `[deploy]`). Still open: S-6a/S-8a (plan drafted below; owner + Genesis), slug CHECK (needs the owner's D12 query result), U31 follow-up (drop main flow 7 `mayPass` after a green dual-main before 16:00 UTC).


State: every queued unit through U28 is **merged** on `remediation` (incl. U07/U07b/U07c dual-frontend gate, U11/U12 PIN hashing, U15, U22–U28), and `remediation` was merged into `dev` twice (428a060, then 64704b0; no deploy). PR #6 (remediation → main) was closed. Gates on the last head: tsc 28 · lint 400 · vitest 223 · build OK; CI + dual-frontend green (dual gate now ~5 min).

Not queued yet (candidates; ask the owner first):
- **P2-01 businesses / S-7a** (owner answered 2026-10-10: only managers/admins update the business; trigger blocks billing columns except service role). Also closes the root cause of U25's stored XSS (member-writable `qr_code`/`name`/`slug`); consider a slug format CHECK.
- **S-6a** ATH keys to Supabase Vault (owner: Vault) and **S-8a** payments function uses staff access tier + active status — payments area: coordinate with Genesis's ATH work on `dev`.
- **P2-02 / P2-04 contract steps** (drop plaintext PINs, close the public read of `kiosk_manager_pin`) — only after `main` runs the remediation frontend.
- Inactive staff with access_role admin/manager can still delete clients/pets (`is_business_manager` ignores `staff.status`) — owner decision.
- E2E clock pin (`page.clock.setFixedTime`) may slow auth when pinned ahead of real time (U22 note).
- S-9b baseline after Parts A and D (needs B2).
- Unused npm packages / translation keys (owner: not now).
- Genesis's open questions: S-10a/b/c, C2, P2-08 (HANDOFF).

Working rules (learned): one remediation push at a time (CI cancels in-progress runs); merge `origin/dev` in before each round (never rebase); every unit's frontend must work before and after its own migration (remediation runs on `dev` before Part D is applied); migration slots after every file on `dev`; lint from a clean worktree outside `.claude/worktrees`; GitHub job-log blob URLs are blocked (use get_job_logs return_content).

## Draft: S-6a / S-8a (payments; NOT started — owner coordinates with Genesis)

Both touch `supabase/functions/payments/` and the payments tables Genesis is working on directly on `dev` (ATH Móvil). Proposed as two separate units, each after a fresh `origin/dev` sync, run only once the owner and Genesis say go (and after Genesis answers P2-08: which payment secrets table is live).

**S-8a (smaller, do first).** `payments/index.ts` ~269–272 authorizes by `profiles.role` (`manager`/`employee`) and `is_super_admin`. Change: resolve the caller's staff row for the business (same rule as `caller_staff_access_role_for_business` / `is_business_manager`, incl. U30's active-status check): charges/cancels need access_role staff or above and `status = 'active'` (contractors and inactive staff refused); settings (mode, keys, webhook) need admin or manager; profile managers and super admins keep today's access. Tests: `npm run test:payments` cases per tier (contractor charge → 403, inactive staff → 403, admin-tier employee settings → 200). No migration expected (maybe a helper SQL function, expand-only). Behavior change staff would notice: contractors lose Cobrar with ATH, admin-tier employees gain payment settings → owner/Genesis confirm wording.

**S-6a (larger).** ATH public/private tokens in `business_payment_secrets` (and per-payment auth tokens in `payment_secrets`) move to Supabase Vault: expand migration adds `*_secret_id uuid` columns + SECURITY DEFINER functions callable only by `service_role` (`payments_store_secret`, `payments_read_secret`) wrapping `vault.create_secret`/`vault.decrypted_secrets`; the function writes both (dual-write) and reads Vault first, falling back to the plain column; a later contract step (after backfill and once main runs the new function) nulls and drops the plain columns. Needs: Vault enabled on production (check `vault` schema), a backfill script the owner runs in the SQL editor after a backup, test-env Vault support in CI (verify the local stack has `supabase_vault`), payments tests for store/read/rotate, and an Edge Function deploy (owner, D-row). Open questions for Genesis: P2-08 (live table), simulator tokens in Vault too or not (S-3a: simulator is super-admin-only), and timing vs her ATH work.

## Needs you

- [x] **Before waves 6–7 (U11, U12):** go/no-go on PIN hashing — go (2026-10-10, after U15 merges); it changes what `main`'s kiosk can read on the shared database.
- [ ] **B4 addendum** (U24 merged 2026-10-10: in-job decision instead of a twin; add `dual-main`/`dual-dev` in branch protection, see OWNER_ACTIONS B4 incl. the Genesis direct-push heads-up): also require `dual-main`/`dual-dev` (workflow "dual-frontend") once U07 merges — note they are path-filtered, so a required check won't report on PRs that don't touch migrations/functions/tests (U07 can add a no-op twin workflow if you want them required everywhere).
- [x] **Decision:** main's employee trash button after D9 — **leave it** until `main` gets the remediation frontend (2026-10-10).
- [x] **Decision:** show client/pet Delete to staff with access_role manager — **yes** (2026-10-10) → U23.
- [ ] **Delete merged `fix/*` branches** if the coordinator reports the proxy refused it.

## Notes

- 2026-10-10 ~22:05 UTC: U30 merged (ac5405e; branch CI 38088998654 ✓, dual 38088998677 ✓; red 38088639011). Also tightens `can_manage_staff_private` (same decision; inactive leads could read staff_private and raise own pay). D13 added.
- 2026-10-10 ~21:48 UTC: U31 merged (9ba6811; CI 38087820254 ✓, dual 38087820262 ✓). 4b/4c token refreshes 27/20 → 0.
- 2026-10-10 ~21:37 UTC: U29 merged (eeb07e4; CI 38087717084 ✓, dual 38087717141 ✓; red 38086768419). Slug CHECK not added (no slug data in the snapshot; query in D12). D12 added. Pre-commit hook false positive on an old FIX_LOG example line reworded (not bypassed).
- 2026-10-10 ~21:10 UTC: dev sync 478743a (no file changes). Owner: U30 tighten; S-6a/S-8a plan only.

- 2026-10-10 ~20:30 UTC: U24 merged (60ad0f3: CI 38083129726 ✓, dual-frontend 38083129679 ✓). **U23–U28 all merged.** Next: merge remediation into dev again (no deploy tag).
- 2026-10-10 ~20:25 UTC: U26, U27, U23, U25 merged (each CI green on its branch; combined gates tsc 28, lint 400, vitest 223/223, build OK). U25 found and fixed a stored XSS (QR preview/print). U24 still running.
- 2026-10-10 ~20:15 UTC: U23–U28 started in parallel (no shared Owns). U28 merged (CI 38082169535 ✓); typecheck baseline 29 → 28.
- 2026-10-10 ~20:05 UTC: U12 merged (9d5c533: CI 38081115484 ✓, dual-frontend 38081115397 ✓; red 38080738121). pre-commit password rule narrowed (owner OK). types.ts: 3 functions. Finding: anon can read every slugged business's kiosk_manager_pin (directory policy) until the P2-04 contract step. **All units the owner listed today are merged.** Next (owner-approved): U23–U28, then merge remediation into dev again.
- 2026-10-10 ~19:25 UTC: U11 merged (f2e7f62: CI 38078208163 ✓, dual-frontend 38078208125 ✓; red 38075757971). types.ts: 3 RPCs added by the coordinator. Open: KioskManagerPinResetDialog blocked by the pre-commit hook's false positive (needs owner call before U12, which owns that file). U12 next.
- 2026-10-10 ~19:00 UTC: U07c merged (c02da17: CI 38077126481 ✓, dual-frontend 38077126633 ✓; dual-main smoke 22 min → 2m10s, dual-dev → 1m30s; EXPECTED.dev now empty). dev CI 38076997404 ✓ after the remediation merge.
- 2026-10-10 ~18:48 UTC: **remediation merged into dev** (dev 428a060 = remediation 8a0e33d tree; no deploy tag). Gates on that tree: CI 38076280999 ✓, dual-frontend 38075226597 ✓. Follow-up once dev CI is green: flows 4 and 7 can come off EXPECTED.dev (dev now has U22) — fold into U07c or the next gate change.
- 2026-10-10 ~18:45 UTC: owner decided to merge remediation into dev now (so Genesis can resume ATH work on dev), coordinator pushes it this once, no `[deploy]`. PR #6 (remediation → main) closed. dev's handoff commit merged in; docs/HANDOFF.md updated for Genesis. After this, remediation keeps syncing dev before each round as usual, and is merged into dev again after U11/U12.
- 2026-10-10 ~18:40 UTC: U22 merged (red 38075598902, green 38075767627: E2E 15/15 first attempt). Working rule added: after the owner merges remediation into dev, remediation's frontend runs on production's schema before Part D is applied, so every unit's frontend must work both before and after its own migration (U11/U12 told).
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
