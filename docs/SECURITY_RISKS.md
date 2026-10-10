# Grumi security risks: decisions needed

**Status: DECISIONS PENDING**

- Written 2026-10-08 by Claude (Claude Code) for Jovaniel Rodriguez, from a read-only review of `dev` at `8543663` and `Stratum-PR/payment_methods` at `28673ba`.
- Details and evidence for the payment items are in [PAYMENTS_SECURITY_REVIEW.md](PAYMENTS_SECURITY_REVIEW.md). IDs like G-2 and P-1 refer to it; the S-numbers are this file's.

---

## Instructions for the AI assistant (Claude Code, Cursor or any other)

This file is loaded automatically at the start of every session (`CLAUDE.md` imports it; `.cursor/rules/security-risks.mdc` points to it).

**While the status above is `DECISIONS PENDING`:**

1. **Before starting other work,** tell Genesis this file exists and that Jovaniel asked for these decisions. Show the "Do now" box below first. Then ask whether to go through the questions now.
   - If she says not now, do her task, and ask again at the start of the next session.
   - Never skip the questions silently.
2. **Ask with your multiple-choice tool** (in Claude Code: `AskUserQuestion`).
   - At most 4 questions per call, in the order below.
   - Show each risk's one-line summary before its question.
   - Keep the recommended option first, marked "(Recommended)".
   - She can always choose "Other" and type her own answer.
   - In tools without a multiple-choice tool, ask the same questions as numbered lists.
3. **Record every answer** in the Decisions table at the bottom: question id, choice, any notes, date, and who answered. Commit this file after each batch, so nothing is lost if the session ends.
4. **Once all questions are answered,** analyze the combined fix plan before writing any code: see "Plan review" below.
   - Write what you find into the Plan review section.
   - Ask follow-up multiple-choice questions to resolve every contradiction, loophole or vulnerability you find.
   - Repeat until none are left.
5. **Then** set the status to `DECIDED — READY TO IMPLEMENT`, add a short implementation order, and ask Genesis to confirm before changing code.
6. **When an item is fixed,** mark it in the Decisions table.
   - Update the status column of `docs/PAYMENTS_SECURITY_REVIEW.md`. That file is shared and must stay identical in `Stratum-PR/pet-hub`, `Stratum-PR/payment_methods` and `Stratum-PR/Mezza.pr`: update all three, or tell Genesis to ask Jovaniel for the Mezza copy.
   - When every item is fixed or consciously accepted, set the status to `DONE`.
7. **Ground rules:**
   - Never paste keys, tokens or passwords into chat, code or this file.
   - Don't apply migrations or deploy to the hosted project without Genesis saying so in that session.
   - Verify each finding against the current code before fixing it; the code may have changed since this review.

---

## Do now (no decision needed, just a check)

> **S-0: Check two Supabase Auth settings on the Grumi project today.** Dashboard → Authentication → Sign In / Providers → Email:
> - **"Confirm email" must be ON.** Otherwise anyone can sign up as `anything@stratumpr.com` and becomes a super admin over every business (see S-1).
> - **"Secure email change" must be ON.**
>
> Also confirm no enabled sign-in provider accepts unverified email addresses. Record the result in question S-1b.

---

## Risks and questions

### S-1: Super admin is granted by email domain (Critical)

**What:**
- `handle_new_user` (trigger on `auth.users` insert) makes any new account ending in `@stratumpr.com`, or the allowlisted Gmail, a super admin automatically.
- `handle_auth_user_email_updated` grants super admin on an email change to that domain, and removes it when the email changes away.
- The profile guard trigger lets a Stratum-domain user grant super admin to themselves.

See `test-env/supabase/prod-schema-snapshot.sql`, around lines 2284–2330 and 2520–2560, and the triggers at about line 3863.

**Why it matters:** super admins reach every business, its payment keys, test mode and support sessions. With "Confirm email" off, any outsider can become one. Even with it on, every Stratum mailbox (aliases, shared inboxes, contractors) is a full admin.

**S-1a. How should someone become a super admin?**
- **Only an existing super admin can add one, and at least one must always remain (Recommended).** Remove the domain auto-grant from both triggers and the self-grant. `admin_set_profile_role` becomes the only path. A trigger refuses any update, delete or account deletion that would leave zero super admins, locking so two admins can't demote each other at once. The Supabase dashboard (service role) stays as break-glass recovery.
- **Same, but only `@stratumpr.com` accounts can be promoted.** An existing admin adds admins, and the domain rule stays as an extra condition.
- **Keep the domain auto-grant, but only for confirmed emails.** Less work; every Stratum mailbox stays an admin.

**S-1b. Result of the S-0 check?**
- Both settings were already ON.
- One was OFF and I turned it ON.
- I can't access the settings; Jovaniel needs to check.

**S-1c. Who is a super admin right now?**
- **List current super admins, and remove anyone unexpected before the change (Recommended).**
- Keep the current list as it is.

**S-1d. Extra protection for admins** (choose any):
- Log every grant and removal (who, whom, when) in an audit table.
- Notify the other admins by email when someone is granted admin.
- Require two-factor authentication (MFA) for super admins.
- An email change never changes admin status.

### S-2: Test-mode payments can hide real cash sales (High)

**What:**
- `link_transaction` in `supabase/functions/payments/index.ts` still overwrites the link without checking that it's empty, and never compares the amount (review G-2).
- Since the G-1 interim fix, it also sets `is_test = true` on the target transaction.
- So once one simulator charge has succeeded, any staff member can call `link_transaction` repeatedly with real cash sales' ids. Each one becomes "test" and disappears from revenue.
- The reverse also happens: the browser saves the sale first and links it in a second call. If that call never runs, a simulated sale counts as real revenue.

**S-2a. How should a charge become a saved sale?**
- **The server creates the transaction when the charge succeeds (Recommended).** The `payments` function writes the sale, line items and `is_test` itself; the browser only shows the result. This also fixes S-4 for ATH.
- **Keep the browser save, but make linking one-time and checked.** Link only when `transaction_id` is empty, the transaction has no other payment, it was created after the payment, and the amounts match. Add a unique index on `payments.transaction_id`.
- **Both:** the server creates it, plus the one-time-link checks for older paths.

### S-3: Test mode is on for real businesses (High)

**What:** dev.grumi.pet uses the production Supabase project (review G-19), and `PAYMENTS_SIMULATOR_ENABLED` defaults to on when unset. Any manager of a real business can turn on test mode.

**S-3a. What should happen to test mode?**
- **Give dev its own Supabase project, and set `PAYMENTS_SIMULATOR_ENABLED=false` on production (Recommended).** Test mode exists only on dev and in the local test environment.
- **Keep one project, but default the switch to off** (code changes the default) and turn it on only while testing.
- **Keep as today** (on, with the `is_test` flag and managers-only simulator).

### S-4: Revenue reports only see the newest 50 transactions (High, accuracy)

**What:** `Reports.tsx`, `BusinessReports.tsx` and `Dashboard.tsx` compute revenue in the browser from `useTransactions()`, which loads 50 transactions at a time (`TRANSACTIONS_PAGE_SIZE = 50`). A business with more than 50 sales in a period gets wrong totals, and businesses may file taxes from these numbers.

**S-4a. How should reports be computed?**
- **In the database: a function or view that totals by date range, excluding `is_test` and honoring RLS (Recommended).**
- A daily summary table refreshed by the database, with reports reading it.
- Load every page in the browser before computing (simple, but slow and heavy).

### S-5: Two checkouts compute money in the browser (Medium-High)

**What:**
- The new Quick charge panel (`src/components/QuickChargeDialog.tsx`) and `TransactionCreate.tsx` both compute prices, tax, tip and total in the browser and save the sale as paid. Any business member can write `transactions` (review G-3).
- Quick charge also records "card" and "other" payments with no provider involved, a free-amount "other charge", and an uncapped custom tip.
- It's available from the header to anyone with checkout access.

**S-5a. Where should sale totals be computed?**
- **One server function computes and saves every sale, used by both screens (Recommended).** The browser sends items and choices, never totals.
- Keep the browser math, but a database trigger recomputes totals and rejects mismatches.
- Server only for ATH and card; cash and manual methods stay in the browser.

**S-5b. Manual "card" and "other" methods** (recorded without a provider):
- **Allow, but require a reference (last 4 or terminal receipt number), and manager approval above an amount (Recommended).**
- Remove "card" until Stripe is built; keep "other" for exceptions only.
- Keep as today.

**S-5c. Custom tip limit:**
- **Up to 100% of the subtotal (Recommended).**
- Up to a fixed amount set in business settings.
- No limit.

### S-6: ATH Móvil keys stored as plain text (High)

**What:** `business_payment_secrets` and `payment_secrets` (`supabase/migrations/20261007140000_payments.sql:25-26, 73`) keep ATH public/private keys and per-payment auth tokens in plain text. The private key can refund money out of the business's ATH account.

**S-6a. How should they be stored?**
- **Supabase Vault; only the `payments` function decrypts (Recommended).**
- Encrypt the columns with a key kept outside the database (Edge Function secret).
- Leave as is (service-role-only access).

### S-7: Any member can edit the business, billing included (High)

**What:** the `businesses` update policy (`20250120000000_create_multi_tenant_schema.sql:82-88`) lets any profile with that `business_id` update the row, including `subscription_tier`, `subscription_status`, `stripe_*` and `trial_ends_at`. Needs checking: whether `client` profiles can have `business_id`.

**S-7a. Fix:**
- **Only managers/admins update the business, and a trigger blocks billing-column changes unless made by the service role (Recommended).**
- Lock only the billing columns; leave other settings editable by all members.

### S-8: Staff access tiers are ignored by the payments function (Medium)

**What:** the function checks `profiles.role` (`manager`/`employee`), not `employees.access_role` (`admin`/`manager`/`staff`/`contractor`). Contractors can charge and cancel; an `admin`-tier employee can't change payment settings. Not yet checked: whether deactivated staff keep access.

**S-8a. Fix:**
- **Use `employees.access_role` and active status: charges need staff or above, settings need admin or manager (Recommended).**
- Keep `profiles.role`, but block contractors and inactive staff.

### S-9: How changes reach production (Medium)

**What:**
- The assistant applies migrations and deploys functions straight to the hosted project from its session.
- The payments CI runs after pushing to `dev` and doesn't gate anything.
- Production has recorded only 54 of 136 migration files, and some were never applied, so production's real schema is uncertain.

**S-9a. Deploy process:**
- **Only CI deploys, after tests pass on the local test environment; sessions never deploy (Recommended).**
- Sessions may deploy, but only after the local test run passes and Genesis approves in that session.
- Keep as today.

**S-9b. Migration history:**
- **Baseline: one migration equal to the current production schema, marked as applied; older files moved to an archive folder (Recommended).**
- Repair the history file by file until it matches production.
- Leave it; keep using the schema snapshot.

### S-10: Remaining payment items from the review

**S-10a. Which Grumi items go in the first fix round?** (choose any)
- G-5: refunds made in the ATH Business app reach Grumi (refund webhooks matched, plus a manager refund action).
- G-6: "Desconectar" deletes the ATH keys and unsubscribes the webhook.
- G-7: support "log in as staff" sessions can't change payment settings; the audit log records the real admin.
- G-15: delete the raw card-number form in `src/pages/Payment.tsx`.

**S-10b. Lower-risk Grumi items for the first round?** (choose any)
- G-8 and G-9: webhook key in the path with rotation; in-flight payments survive mode or key changes.
- G-10 and G-11: a test that every action without a token gets 401; `last_error` hidden from staff.
- G-16 and G-17: rate limit on `ath_create`; CORS allows only Grumi's own origins.
- G-18: payments' appointment and customer must belong to the business.

**S-10c. Package (`payment_methods`) items for the first round?** (choose any)
- P-1: the ATH key check reads ATH's error envelope, so wrong keys are refused.
- P-2: refunds never run twice (record first, one call, no automatic retry).
- P-4: a shared `settle()` in the package (Grumi's lock logic), used by Grumi and later Mezza.
- P-3, P-8 to P-11, P-13: SQL template fix, simulator host allowlist, version marker in copied files, CI publish job, no personal data in errors, timeout recovery.

---

## Plan review (fill in after all questions are answered)

Check the combined decisions for:

- **Contradictions between answers.** For example:
  - S-1a "domain auto-grant" with S-1d "email change never changes admin";
  - S-2a "server creates the transaction" with S-5a "browser computes totals";
  - S-3a "one project" with S-9a "only CI deploys" (CI would deploy test mode to production).
- **Loopholes the fixes leave open:**
  - any other path that sets `is_test`, `status` or totals (SECURITY DEFINER functions, other Edge Functions, the "recover paid-but-unsaved" banner);
  - every way to remove the last super admin (account deletion, ban, role change, profile delete);
  - support sessions bypassing manager-only rules;
  - reports reading `transactions` directly.
- **New vulnerabilities the fixes introduce:**
  - a server function that trusts ids from the browser without checking the business;
  - Vault decryption reachable from a browser-callable function;
  - the minimum-admin lock causing a lockout;
  - a reports function that ignores RLS or leaks other businesses' totals;
  - CI holding production credentials.
- **Rules everything must still meet:**
  - amounts come from the database;
  - the server is the only path to "paid";
  - webhooks only trigger a re-check;
  - no automatic refunds;
  - secrets stay server-side and encrypted;
  - test sales never count as revenue.

Findings:

_(none yet)_

Implementation order:

_(after the review)_

---

## Decisions

| Question | Choice | Notes | Date | Answered by | Fixed? |
|---|---|---|---|---|---|
| S-0 / S-1b | Both settings were already ON | Confirm email + Secure email change | 2026-10-10 | Genesis | — |
| S-1a | Only an existing super admin can add one, and only `@stratumpr.com` accounts can be promoted | Domain rule kept as an extra condition, no auto-grant; at least one must remain | 2026-10-10 | Genesis | |
| S-1c | List current super admins and remove anyone unexpected before the change | | 2026-10-10 | Genesis | |
| S-1d | Audit log of grants/removals; email other admins on grant; require MFA for super admins | Not chosen: "email change never changes admin status" | 2026-10-10 | Genesis | |
| S-2a | | | | | |
| S-3a | | | | | |
| S-4a | | | | | |
| S-5a | | | | | |
| S-5b | | | | | |
| S-5c | | | | | |
| S-6a | | | | | |
| S-7a | | | | | |
| S-8a | | | | | |
| S-9a | | | | | |
| S-9b | | | | | |
| S-10a | | | | | |
| S-10b | | | | | |
| S-10c | | | | | |
