# Grumi Remediation Plan

Status: **DRAFT — planning, nothing applied**  
Owner: Jovaniel · Reviewer: Genesis · Created: 2026-10-08  
Target branch: `dev` (later promoted to `main`)

Decisions already made:
- **Hotfix:** fast-track migration PR.
- **Freeze:** full feature freeze for about 2 weeks.
- **Staging:** none. There is one shared Supabase project (production) because the free plan limits us to 2 projects. The local Docker test stack is the pre-production gate, and the single-database rules in §9 apply.
- **Tracking:** this doc plus one GitHub issue per item (IDs below).

---

## 1. Why this plan exists

The audit of `dev` on 2026-10-08 found four things.

**Silent breakage.**
- There are 82 TypeScript errors, and nothing runs `tsc`.
- There are about 290 `as any` casts.
- There are no tests for appointments, booking, clients, payroll or the time kiosk.
- Four core data hooks have two implementations each (`useBusinessData` and `useSupabaseData`).

**Critical security.**
- Any signed-up user can make themselves manager of any business.
- Employees can read coworkers' plain-text PINs and edit their own pay rate.
- 89 of 183 RLS policies exist only in production, not in migrations.

**A messy schema.**
- Duplicate tables and fields.
- 28 `_id` columns with no foreign key.
- Text IDs on `appointments` and `pets`.
- Mixed money units.
- Nullable `business_id` on 9 tenant tables.

**Dead code.** About 30 files that nothing imports, plus legacy `Business*` pages.

## 2. The fix protocol (applies to every item)

No item is applied until it passes all gates. Each item, or group of tightly related items, is one **change unit**, which means one branch, one PR, one tag and one entry in `docs/FIX_LOG.md`.

```
 1. Write the test first     the bug or behavior as a test that FAILS today
 2. Baseline                 run the full suite on dev and save the report (it should match the last FIX_LOG entry)
 3. Implement                the smallest change that makes the new test pass
 4. Gate A: Regression       typecheck, lint (no new errors), unit tests, build, smoke E2E
 5. Gate B: Functionality    the change unit's own tests and a manual walkthrough of the affected screens
 6. Gate C: Security         RLS/access suite (test:security) and the payments suite (test:payments)
 7. Rollback ready           DB changes: a tested rollback script in supabase/rollbacks/
                             frontend: the previous Vercel deployment noted for instant rollback
 8. Review                   Genesis approves the PR; CI green is required
 9. Apply                    production DB backup (supabase db dump) → migration → deploy
10. Verify in production     run the post-deploy checklist for the unit and watch errors for 24h
11. Record                   FIX_LOG entry: what changed, test report, backup ID, rollback command, tag
```

**"A way to know what happened"**
- **Tags:** every applied unit gets a git tag (`fix/P2-03`).
- **Fix log:** `docs/FIX_LOG.md` lists date, unit, PR, migration file, backup file, rollback script and test totals.
- **CI artifacts:** CI stores the test reports for each run, so any two runs can be compared.
- **Error monitoring** (decision pending, §9) shows what broke after a deploy.
- **Rule:** never two units in production on the same day until the gates are trusted.

**If a gate fails:** stop. Fix within the same unit, or roll back and reopen it. Never "fix forward" by starting the next unit.

---

## 3. Phases at a glance

| Phase | Goal | Duration | Freeze |
|---|---|---|---|
| 0 | Close the critical hole | Days 1–2 | Yes |
| 1 | Build the gates (test harness, CI, baseline) | Week 1 | Yes |
| 2 | Security fixes | Week 2 | Yes |
| 3 | Code cleanup (dead code, duplicate hooks) | Weeks 3–4 | Lifted for small features |
| 4 | Feature-folder restructure | Weeks 4–8, one feature at a time | No |
| 5 | Schema normalization | Ongoing, one table at a time | No |
| 6 | Promote `dev` → `main` | After Phase 2 | — |
| 7 | `CLAUDE.md` + `AGENTS.md` + agent hooks | After Phases 1–5 | — |

Phase 0 goes first even though the full harness doesn't exist yet. Its gate is the security test written for it plus the existing payments suite.

---

## Phase 0: Emergency (days 1–2)

| ID | Item | Gate / verification |
|---|---|---|
| P0-01 | **Lock profile identity columns.** A trigger blocks users from changing their own `role`, `business_id` or `staff_id` (draft on local branch `fix/lock-profile-identity-columns`). | `test:security`: 4 checks fail before the fix and 8/8 pass after. `test:payments` 24/24. Manual: client sign-up, manager sign-up, employee invite. |
| P0-02 | **Check whether it was exploited.** Run the read-only query in Appendix A on production. | Results reviewed by both of you before P0-01 ships. |
| P0-03 | **Confirm production auth settings.** "Confirm email" is ON; note the signup, OTP and password settings in this doc. | Screenshot or notes recorded here. |
| P0-05 | **Assess `main` vs the production DB** (one shared database, see §9). List the `dev` migrations already applied to production (read-only `supabase migration list`). For each one, check whether `main`'s code still works with it: on the local stack, build the production schema and run `main`'s frontend against it. Then smoke-test the live production app's main flows by hand. | A list of migrations that break `main` (if any) and a fix decision for each: hotfix `main`, or promote `dev` sooner. |
| P0-04 | **Production backup procedure.** A documented `supabase db dump` (schema and data) taken before any production change, stored privately. | A restore has been dry-run onto the local test stack. |

## Phase 1: Build the gates (week 1)

| ID | Item | Done when |
|---|---|---|
| P1-01 | **Production schema baseline.** Use `supabase db pull` to capture all 89 production-only policies and 7 production-only functions as a baseline migration, so the repo matches production. | A fresh stack built from migrations is identical to production (a schema diff shows nothing). |
| P1-02 | **Schema drift check in CI.** It fails if production differs from the migrations, or if generated types differ from `src/integrations/supabase/types.ts`. | CI job is green. |
| P1-03 | **`typecheck` and `check` scripts**, and fixing the 82 TypeScript errors. | `npm run check` passes. |
| P1-04 | **PR CI workflow** on every PR to `dev` and `main`: check, build, `test:security`, `test:payments`, smoke E2E. Reports are uploaded. | Required status check. |
| P1-05 | **Lint ratchet.** Existing problems are baselined; new `any` and new hook-dependency errors fail CI. | CI fails on a deliberate new `any`. |
| P1-06 | **Vitest config** (`jsdom`, setup file). Document the SWC cache workaround for Windows. | Unit tests pass locally and in CI. |
| P1-07 | **Smoke E2E with Playwright** against the local stack, with seeded data: (1) manager login → dashboard; (2) create client + pet; (3) book an appointment; (4) edit/cancel the appointment; (5) checkout / quick charge; (6) employee kiosk clock-in/out; (7) payroll page loads with correct totals; (8) client portal booking; (9) public booking page. | 9 flows green in CI. |
| P1-08 | **Expand the security suite** to cover every confirmed issue as a **known-failing** test (marked `expected-fail` until fixed): coworker PIN read, self pay-rate edit, employee edits business, generic-policy overreach on clients/pets/appointments. | The suite reports "N known issues open"; each fix flips one to passing. |
| P1-09 | **Fix log and release tags.** Create `docs/FIX_LOG.md` and the tagging convention; add a PR template with the gate checklist from §2. | Template in use on the first PR. |
| P1-10 | **Branch protection** on `dev` and `main`: PR required, CI required, 1 review. | Settings applied (by you, in GitHub). |
| P1-11 | **Repo hygiene.** Untrack `.env` and `supabase/.temp/`; delete `types/database.types.ts` (unused, UTF-16). | `git ls-files` is clean. |
| P1-13 | **Shared-database safeguards:** a CI job that runs `main`'s frontend against the new schema; a QA business and test accounts for the dev page; the release-train checklist. | The dual-frontend gate is required in CI; a QA business exists. |
| P1-12 | **Error monitoring with Sentry:** React app and edge functions, with the release tag = git tag so every error maps to a change unit. | A test error appears in Sentry with the right release. |

## Phase 2: Security fixes (week 2)

Each row is one change unit and follows the protocol in §2.

| ID | Item | Notes |
|---|---|---|
| P2-01 | **Rewrite RLS one table at a time.** Replace the generic and duplicate policies with one clear set per table, built on shared helpers (`is_business_manager(b)`, `is_business_member(b)`, `is_own_staff_row(id)`). Order: `staff` → `profiles` → `businesses` → `clients` → `pets` → `appointments` → `services` → `transactions` → `inventory` → the rest. | One table per PR. Each PR flips its known-failing tests. Must keep all smoke E2E flows green. |
| P2-02 | **Hash staff PINs** (pgcrypto `crypt`), migrating existing PINs in place so nobody needs a reset. `clock_in_out` compares hashes, and the app stops selecting `pin`. | The app currently reads `staff.*`, so the explicit column lists in P3-04 must land first, or both ship together. |
| P2-03 | **Column privileges on `staff`.** Employees cannot update `hourly_rate`, `role`, `access_role`, `commission_rate` or `pin`. | Trigger or column grants, plus tests. |
| P2-04 | **Hash `businesses.kiosk_manager_pin`.** | Same pattern as P2-02. |
| P2-05 | **Demo workspace access.** Keep, restrict or remove the anonymous-read policies (see §9). | |
| P2-06 | **Remove the broken legacy invite path:** `complete_employee_signup` (references a missing `employees` table) and the `employee_invitations` table, if production has no rows. Drop the 1-argument `complete_manager_signup` overload. | Check production row counts first. |
| P2-07 | **Remove the browser-side `role` write** in `Register.tsx` (the server already sets `client`). | |
| P2-08 | **Review the payment secrets tables** (`payment_secrets` vs `business_payment_secrets`). | Needs Genesis (payments owner). |

## Phase 3: Code cleanup (weeks 3–4)

| ID | Item | Notes |
|---|---|---|
| P3-01 | **Delete orphan files** (Appendix B) in batches of about 5. | Each batch: typecheck, build and smoke E2E. Check routes, lazy imports and scripts before deleting. |
| P3-02 | **Delete legacy pages** `BusinessCustomers`/`BusinessPets`/`BusinessServices`/`BusinessReports`/`BusinessSettings`, after confirming no route reaches them. | |
| P3-03 | **Merge the duplicate data hooks.** One `useClients`/`usePets`/`useServices`/`useAppointments`, built on React Query; remove the `useBusinessData` duplicates. Highest-risk item in this phase. | One domain per PR. Extend E2E for that domain first. |
| P3-04 | **Explicit column lists** instead of `select('*')` on `staff`, `profiles` and `businesses`. | Prerequisite for P2-02. |
| P3-05 | **Enable `strictNullChecks`** file by file and drive the remaining `as any` count down. | Tracked as a number in CI. |
| P3-06 | **Fix the 64 `exhaustive-deps` warnings** (stale-data bugs). | Grouped by feature. |
| P3-07 | **Clean up branches.** Merge or close `feature/scheduling-overhaul`; delete `oauth-v1` and `cursor/*` after review. | |
| P3-08 | **Rewrite the README**; make the PowerShell-only scripts cross-platform. | |

## Phase 4: Feature-folder restructure (weeks 4–8)

Target structure: `src/features/<feature>/{components,hooks,api.ts,types.ts,tests,README.md}`, plus `src/shared/` and `src/app/`. Features may not import each other's internals (enforced by a lint boundaries rule); they use a public `index.ts` instead.

Order: **appointments → clients/pets → staff/time → payroll → payments → inventory → reports → marketing/waitlist**.

Each feature move is one change unit: a pure move with no behavior change, all gates green, then any follow-up refactor. Also:
- split `translations.ts` per feature,
- add route-level code splitting (the main bundle is 3.9 MB today),
- add a spec template at `docs/features/_template.md` and ADRs at `docs/adr/`.

## Phase 5: Schema normalization (ongoing)

Pattern for each item: **expand → backfill → switch code → verify → contract.** Old and new columns coexist until the code no longer reads the old one; then the old column is dropped in a later, separate unit. Always take a production backup first.

- **Appointments.** Settle on one each of: date/time model, price (integer cents), service (`service_ids` vs a join table), and client (`client_id`; drop `customer_id`).
- **Text IDs.** Convert `appointments.id` and `pets.id` from text to UUID, then add the missing foreign keys.
- **Missing foreign keys.** Add the 28 missing `_id` FKs after orphan cleanup.
- **Required `business_id`.** Make it `NOT NULL` on the 9 tenant tables after backfill.
- **`settings` types.** Convert text booleans and numbers to real types; resolve the `businesses` vs `settings` overlap (name, logos).
- **`staff`.** Drop the legacy SSN/bank columns; one name model; one role model.
- **Indexes.** Add the 22 missing FK indexes and drop the 6 duplicates.
- **Money.** One convention: integer cents everywhere.

## Phase 6: Promote `dev` → `main`

When Phase 2 is complete and CI is green:
1. Tag the current `main` as `main-pre-dev-merge`.
2. Merge `dev` → `main` through a PR, with no force-push.
3. Confirm which branch Vercel deploys to production (§9).

From then on: `main` = production, `dev` = integration, and every change unit is a PR into `dev`.

## Phase 7: `CLAUDE.md` + `AGENTS.md` (after the remediation)

Written last so they describe the finished architecture, not the current one.
- **`CLAUDE.md` and `AGENTS.md`** (same content, two entry points), covering:
  - architecture map and feature-folder rules,
  - data-access rules (no `as any` on rows, feature `api.ts` only),
  - the change-unit protocol from §2 and the "done = gates green" definition,
  - commands, migration workflow (migration + regenerated types + rollback script),
  - i18n rules,
  - files and areas that need extra care,
  - the security model (roles, RLS helpers),
  - what agents must never do: push, edit production, `--no-verify`, or apply DB changes without a backup.
- **Per-feature `README.md` files**, which agents read before touching a feature.
- **`.claude/settings.json` hooks:** typecheck and related tests after edits; block edits to applied migrations.
- **Move the security-decisions gate** (Genesis Q&A) into a section of `CLAUDE.md` instead of a hard stop at session start.

---

## 9. Decisions

| # | Decision | Answer (2026-10-08) |
|---|---|---|
| 1 | Draft hotfix commit | **Keep** as the P0-01 draft on local branch `fix/lock-profile-identity-columns`. Not pushed; Genesis reviews it in Phase 0. |
| 2 | Error monitoring | **Sentry** (frontend and edge functions, tagged by release). |
| 3 | Demo workspace | **Keep, isolated.** Policies may only match the demo business ID, and the demo data must be clearly fake (P2-05). |
| 4 | Production deploy branch | **`main`** → production on Vercel. **`dev`** → a separate Vercel dev page. |
| 5 | Database used by the dev page | **The same Supabase project as production.** |
| 6 | Payment secrets tables (P2-08) | **Open:** Genesis to confirm which one is live. |

### Consequence of decisions 4 and 5: one database, two app versions

```
main (April code) ──► Vercel production ──┐
                                           ├──► ONE Supabase project (production data)
dev (current)     ──► Vercel dev page ────┘        ▲
                                                    └── dev's migrations are applied here
```

- **Production's database is ahead of production's code.** The production snapshot is at `20261007235900`, while `main`'s newest migration is from April. Any `dev` migration that renames, drops or tightens something `main` uses breaks production with no deploy at all. This is a likely contributor to "new stuff breaks old stuff".
- **The dev page works on real data.** Test bookings, sales, staff edits and payment test mode on the dev page write real production records.
- **Every hosted change runs first on production.** The local test stack gates code, but there is no hosted place to try a migration first.

**Decision (2026-10-08): stay on one database.** The Supabase free plan allows 2 projects, and they're used by Mezza and Grumi. Edge functions, secrets and storage are shared between `main` and `dev` as well as tables.

**Permanent single-database rules:**
1. **Expand-only while `main` ≠ `dev`.** Add tables, nullable columns, new functions, and new edge-function behavior behind a flag. No renames, drops, tightened constraints or breaking function changes until `main` no longer uses the old shape (expand → switch → contract).
2. **Weekly release train.** Promote `dev` → `main` at least weekly so the code/database gap stays small. This is the main protection.
3. **Dual-frontend gate.** Every migration or edge-function PR runs the smoke E2E on the local stack against **both** `main`'s and `dev`'s frontend.
4. **Test data isolation.** The dev page is used only with a dedicated QA business and test accounts, with payments in test mode. Real customers are never edited from the dev page.
5. **Backup before every database or edge-function change** (`supabase db dump`; the free plan has no downloadable backups). The dump ID goes in the FIX_LOG entry.
6. **P0-01 (the hotfix) complies with rule 1.** It only blocks a write that neither `main` nor `dev` legitimately makes.

**Optional later:** a Pro upgrade on Grumi's organization (about $25/month plus a per-project compute charge) would add a separate dev project and real daily backups.

---

## Appendix A: Exploitation check (read-only; run in the production SQL editor)

```sql
-- Managers who are neither the business owner nor using the business email
select p.id, p.email, p.role, b.name, p.updated_at
from profiles p join businesses b on b.id = p.business_id
where p.role = 'manager' and b.owner_id is distinct from p.id
  and lower(b.email) <> lower(p.email)
order by p.updated_at desc;

-- Employees whose profile business doesn't match their staff row
select p.id, p.email, p.business_id, s.business_id as staff_business
from profiles p left join staff s on s.id = p.staff_id
where p.role = 'employee' and (s.id is null or s.business_id <> p.business_id);
```

## Appendix B: Orphan file candidates (verify each before deleting)

`components/`: CustomerList, DaycareCalendarView, EmployeePinSetupDialog, EnvDiagnostics, KioskManagerAccess, OnboardingModal, SidebarLogoPreview, ThemedFavicon, TimeEntryCard  
`components/ui/` (unused shadcn): accordion, aspect-ratio, chart, context-menu, hover-card, menubar, navigation-menu, progress, resizable, scroll-area  
`hooks/`: useBusinessBySlug, useLocalStorage, useStaffServiceRates  
`lib/`: bookingAvailability, overtimeCalculation, payrollStaffSummaryFilter, timeRounding  
`pages/`: BusinessCustomers, BusinessPets, BusinessReports, BusinessServices, BusinessSettings, ClientPlaceholder  
Other: `data/calendarSampleData.ts`, `types/index.ts`, root `types/database.types.ts`  
**Not orphans:** `content/discoverable-content.ts` is used by `scripts/generate-discoverability.ts`.

## Appendix C: Audit baseline (2026-10-08, `dev`)

| Measure | Value |
|---|---|
| Unit tests | 102/102 passing |
| Payments E2E | 24/24 passing |
| Build | Passes; main bundle 3.9 MB |
| TypeScript errors | 82 (125 more with `strictNullChecks`) |
| `as any` | ~292 |
| Lint problems | 422 |
| Schema | 54 tables · 183 policies (89 production-only) · 70 functions · 26 triggers |
