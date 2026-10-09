# Your to-do list (Jovaniel)

Everything in the remediation that only you can do: production, GitHub settings, accounts and decisions. Claude keeps working on `remediation` meanwhile and **adds new items to the bottom of Part D** as later units need them. Work top to bottom; parts are independent unless they say otherwise.

Last updated 2026-10-08 (after P1-07).

**Rules for every production step**
- Backup first (A3) before any database change. Note the backup folder name where asked.
- Apply migrations by pasting the file into the Supabase **SQL editor**. **Never `supabase db push`**: production's migration history is incomplete, so it would try to replay old migrations.
- Paste results back into a Claude session ("here are the A1 results: …"). Never paste keys, passwords or connection strings.
- Each block has a rollback in [FIX_LOG.md](FIX_LOG.md); you don't need it unless something breaks.

---

## Part A: Close the security hole (do first, ~1–1.5 h total)

Today any signed-up user can make themselves manager of any business (P0-01). The fix is ready; these steps apply it safely. **A1–A2 are read-only** and can be done any time, even on your phone.

- [ ] **A1. Exploitation check** (~5 min, read-only). [PHASE0_PRODUCTION_CHECKS.md §1](PHASE0_PRODUCTION_CHECKS.md): paste `scripts/prod-checks/p0-checks.sql` into the SQL editor, run, export CSV, paste it to Claude. If any P0-02 row is non-zero, stop and read "If something was exploited" there before going on.
  - Optional, only useful the same day: the Logs Explorer query in the same section.
- [ ] **A2. Auth settings** (~5 min, read-only except one switch). [PHASE0_PRODUCTION_CHECKS.md §2](PHASE0_PRODUCTION_CHECKS.md): fill in the table. **"Confirm email" must be ON**; turn it on if it isn't (that's the only change allowed here). Also list Edge Function secret *names* (not values).
- [ ] **A3. Backup** (~15–20 min). [BACKUP_RESTORE.md → "Take a backup"](BACKUP_RESTORE.md): `npm run db:backup`, copy storage buckets, then `npm run db:restore-check -- <folder>`. Backup folder name: `__________`
- [ ] **A4. Apply P0-01, the security fix** (~10 min). Needs A1 reviewed + A3 done. Steps 3–7 in [FIX_LOG → P0-01](FIX_LOG.md): paste `supabase/migrations/20261008120000_lock_profile_identity_columns.sql` in the SQL editor → `npx supabase migration repair --status applied 20261008120000` → run the 3 verify queries → quick sign-up/invite/settings test → tag: `git tag fix/P0-01 <commit>`.
- [ ] **A5. Apply P0-06, client signup fix** (~10 min). Same session as A4 is fine. Steps in [FIX_LOG → P0-06](FIX_LOG.md): paste `20261008130000_restore_clients_name.sql` → `migration repair --status applied 20261008130000` → verify query → register a client with your own `+p006` email, then delete that test user. Tag `fix/P0-06`.
- [ ] **A6. Live smoke test** (~15 min). The checklist at the end of [PHASE0_PRODUCTION_CHECKS.md §3](PHASE0_PRODUCTION_CHECKS.md) (client sign-up should now **succeed**, since A5 fixed it). Note any red console errors.
- [ ] **A7. Watch** for errors mentioning `profile_identity_columns_are_read_only` for 24 h.

Then tell Claude "Part A done" with A1/A2 results and anything odd.

---

## Part B: Setup that unblocks later units (any order, ~1 h total)

- [ ] **B1. Push and review the branch.** `git push` on `remediation` (Claude doesn't push). Look over the commits when convenient; merging into `dev` waits for your review.
- [ ] **B2. Production schema baseline, P1-01** (~20 min, read-only against production). With the CLI linked to the project: `npx supabase db pull` into a new branch or folder Claude can read, and tell Claude where it is. Claude turns it into the baseline migration. Also needed: production's **reference data** the repo lacks: `feature_catalog`, `feature_rollout`, `feature_visibility_rules`, `breeds`. In the SQL editor run `select * from <table>` for each and export CSV. Ordinary managers' visibility of the appointment book depends on these rows.
- [ ] **B3. GitHub secrets for the drift check, P1-02** (~10 min). Repo Settings → Secrets → Actions: add `SUPABASE_ACCESS_TOKEN` (a personal access token from supabase.com/dashboard/account/tokens) and `SUPABASE_PROJECT_REF`. Tell Claude when they exist (not their values). Claude writes the workflow.
- [ ] **B4. Branch protection, P1-10** (~5 min, after Claude's CI workflow P1-04 exists). Settings → Branches → rules for `dev` and `main`: require a PR, require status checks (the CI job names Claude will give you), 1 review.
- [ ] **B5. Sentry, P1-12** (~15 min). Create a Sentry project (React), copy the DSN into Vercel env as `VITE_SENTRY_DSN` and into Supabase Edge Function secrets as `SENTRY_DSN`. Tell Claude it's set.
- [ ] **B6. QA business for the dev page, P1-13** (~10 min). On dev.grumi.pet, register a manager with your own `+qa` email and business name "QA Grumi"; create one client, pet and employee. Tell Claude its slug. It's used for every future smoke test instead of a real business.

---

## Part C: Decisions (reply in chat; a sentence each is enough)

- [ ] **C1. Client portal booking.** The plan's E2E list said "client portal booking", but the portal has no booking; clients book via the public `/<slug>/reservar` page. Is portal booking a wanted feature (later, outside the remediation), or is the public page enough?
- [ ] **C2. Transaction numbers (ask Genesis).** A new business's first sale was `TXN-00009` locally, which suggests numbering is global across businesses and reveals the platform's sale count. Per-business numbering, or fine as is?
- [ ] **C3. People whose client signup failed.** After A1, look at "client profiles with no clients row" (P0-05) together with Claude: repair their records, or let them re-register?
- [ ] **C4. SECURITY_RISKS.md questions** (Genesis's payments decisions) are still pending; Claude skips them when you're the one in session. Schedule a session with Genesis.

---

## Part D: Queue added by later units

Each new production item lands here **in apply order**, with its FIX_LOG link. Apply them oldest first, each after a fresh backup (A3) unless it says it can share one.

| # | Unit | What you do | Status |
|---|---|---|---|
| D1 | E2E-1 checkout crash ([FIX_LOG](FIX_LOG.md)) | Nothing in production: frontend only. It's fixed once `remediation` is merged into `dev` and dev.grumi.pet redeploys. Until then Cobrar crashes on dev.grumi.pet (not on `main`). | Fixed on `remediation` |
| D2 | E2E-2 edit dialog date ([FIX_LOG](FIX_LOG.md)) | Nothing in production: frontend only, same as D1. | Fixed on `remediation` |
| D3 | E2E-3 blank page on hidden features ([FIX_LOG](FIX_LOG.md)) | Nothing in production: frontend only, same as D1. | Fixed on `remediation` |
