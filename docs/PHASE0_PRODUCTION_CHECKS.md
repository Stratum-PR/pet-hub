# Phase 0 production checks (P0-02, P0-03, P0-05)

Everything here is **read-only** and run by Jovaniel. Results go back to the session (paste them in chat) and into `docs/FIX_LOG.md`. Order: run this before the P0-04 backup and before applying P0-01.

Tested on the local stack on 2026-10-08, including against a reproduced takeover (P0-01 rolled back, attacks run): the checks flagged every attacker account.

---

## 1. One SQL query (P0-02 + P0-01 pre-check + P0-05), ~1 minute

Dashboard → **SQL Editor** → new query → paste all of [`scripts/prod-checks/p0-checks.sql`](../scripts/prod-checks/p0-checks.sql) → **Run**. It is a single `SELECT`. Then **Export → CSV** (or copy the rows) and paste it back. Emails come out masked (`ab***@domain`).

How to read it:

| Check | Expected | If not |
|---|---|---|
| **P0-02.1** managers with no owner/staff link | `0` | Each row is a manager of a business they don't own and have no staff record in — the shape of a takeover. Review together; see "If something was exploited". A manager added by hand by a super admin can also appear: check with the business owner. |
| **P0-02.2** employees with mismatched staff business | `0` | Same: an employee profile pointing at a business their staff row isn't in. |
| **P0-02.3** clients attached to a business | `0` | A client who moved their own profile into a business (no role change). Lower impact (clients get no manager access), still review. |
| **P0-02.4** role differs from signup role | only staff invites (`had_staff_invite: true`) and admin-made changes | A `client` signup that is now `manager`/`employee` without an invite is suspicious. |
| **P0-02.5** profiles by role | — | Context for the above. |
| **P0-02.6** super admins | only people you expect | This is also SECURITY_RISKS S-1c. Note anyone unexpected; don't remove yet. |
| **P0-01** `set_profile_business_id` callable by API roles | `false` | `true` means `20261006120000` never reached production and the takeover also works through that RPC: P0-01 closes it, so apply P0-01 promptly. |
| **P0-01** identity-lock trigger present | `false` (not applied yet) | `true` would mean the draft was applied by hand; tell me before applying the migration. |
| **P0-01** profiles policies / triggers | 3 policies (`Profiles select`, `Profiles update`, `System can insert profiles`); 3 triggers | Anything else changes P0-01's analysis; paste it. |
| **P0-05** `clients.name` exists | see §3 | `false` confirms client signup is broken in production (§3). |
| **P0-05** `dispatch_staff_missing_email_reminders` exists | see §3 | `false`: that migration never reached production. |
| **P0-05** client profiles with no clients row | small | A large or growing number = people whose signup failed (§3). |
| **P0-05** migration history | — | The list of migrations production has recorded; I compare it with the repo. |

**Optional, today only (the free plan keeps API logs ~1 day):** Dashboard → Logs → **Logs Explorer**, run:
```sql
select timestamp, request.method, request.path, response.status_code
from edge_logs
cross join unnest(metadata) as m
cross join unnest(m.request) as request
cross join unnest(m.response) as response
where (request.path like '/rest/v1/profiles%' and request.method in ('PATCH', 'POST'))
   or request.path like '/rest/v1/rpc/set_profile_business_id%'
order by timestamp desc
limit 200
```
Normal traffic: occasional `PATCH /rest/v1/profiles` (settings, client signup). Look for `rpc/set_profile_business_id` calls with status 200/204, or bursts of profile PATCHes from one account. If the query errors, use Logs → **API** with a filter on `profiles`.

### If something was exploited

Don't change anything yet. Note the rows (ids, businesses, times), tell me and Genesis, and take the P0-04 backup first (evidence). Then, in this order: apply P0-01 (closes the hole), reset the affected profiles to their correct role/business with the service role, review what those accounts could reach (the business's clients, staff, transactions), and decide on user notification.

---

## 2. Auth settings (P0-03 + SECURITY_RISKS S-0), ~5 minutes

Record each value; screenshots are fine. Dashboard → **Authentication**:

| Where | Setting | Want | Value today |
|---|---|---|---|
| Sign In / Providers → Email | Confirm email | **ON** (otherwise anyone can register as `x@stratumpr.com` and become super admin, S-1) | |
| | Secure email change | **ON** | |
| | Secure password change | ON | |
| | Minimum password length / requirements | ≥ 8, letters + digits | |
| | Email OTP expiry | ≤ 3600 s | |
| Sign In / Providers | Allow new users to sign up | ON (clients and managers self-register) | |
| | Other enabled providers (Google, …) | list them; each must verify emails | |
| | Allow anonymous sign-ins | **OFF** | |
| URL Configuration | Site URL | production URL | |
| | Redirect URLs | only Grumi's own domains (no wildcards on other hosts) | |
| Rate Limits | emails / sign-ups / token refresh | note the values | |
| Multi-Factor | TOTP | note (S-1d may require it for super admins) | |
| Hooks | any auth hooks | note | |

Also note, for backups (names only, **never values**): Dashboard → Edge Functions → **Secrets** → the list of secret names, and whether `PAYMENTS_SIMULATOR_ENABLED` is set (SECURITY_RISKS S-3).

If "Confirm email" is OFF: turn it ON (that is the one change S-0 asks for) and check P0-02.6 for unexpected `@stratumpr.com` super admins.

---

## 3. `main` vs the production database (P0-05)

**Done locally (2026-10-08).** Every `.from(...).select(...)` and `.rpc(...)` in `main`'s and `dev`'s code (354 / 377 files) was checked against the production schema snapshot (literal selects only; insert/update payloads were checked by hand where they touch changed tables).

The 11 migrations `dev` adds over `main`, reviewed one by one against what `main` writes:

| Migration | Changes something `main` uses? | Effect on `main` |
|---|---|---|
| `20261005120000_scheduling_overhaul` | replaces the `appointments` status CHECK; new NOT NULL columns with defaults | None: the new CHECK accepts every status `main` writes (both spellings); defaults fill the new columns |
| `20261006120000_lock_set_profile_business_id` | revokes an RPC | None: `main` never calls it |
| `20261006130000_clock_in_pin_rate_limit` | `clock_in_out` renamed to `_unthrottled` and wrapped | None: same signature, still granted to `anon`/`authenticated`; adds PIN rate limiting |
| `20261006140000_staff_private_details` | moves SSN, bank details, address and payment notes from `staff` to `staff_private` | **Visible:** `main`'s staff screens read these from `staff`, so they show **empty**. No data loss: a trigger moves anything `main` writes there, and blank means "no change" (so `main` also can't clear a value). Intentional security fix; goes away when `dev` is promoted. |
| `20261006150000_client_confirmation_guard` | new table + revoked RPC | None: used only by an Edge Function (service role) |
| `20261007120000_appointments_created_at_default` | adds defaults | None |
| `20261007130000_booking_show_staff_photos` | new settings column (default), replaces two booking RPCs | None found: `main` doesn't call `get_public_booking_options`; `get_employee_portal_settings` keeps its arguments |
| `20261007140000_payments` | new tables only | None |
| `20261007150000_payments_test_mode_guard` | `transactions.is_test` (default false) + trigger that forces it to false for browser writes | None: `main` never sets it |
| `20261007230000_settings_missing_portal_columns` | new column with default | None |
| `20261008120000_lock_profile_identity_columns` (P0-01) | trigger on `profiles` | None (step 8 of P0-01) |

Two mismatches with production's schema, **both present on `main` and `dev`**, so they are not caused by `dev`'s migrations:

1. **Client self-registration is broken.** `Register.tsx` writes `clients.name`; production's `clients` has `first_name`/`last_name` but no `name`. Reproduced through the real API on the local stack: `PGRST204 Could not find the 'name' column of 'clients'`. The auth account and profile get created, then the signup throws, so the person sees an error and has no client record. The same column breaks the `send-appointment-reminder` Edge Function: its client lookup fails, so it skips every reminder as `no_client_email`.
2. **Missing-email reminders for managers never run.** `dispatch_staff_missing_email_reminders` (migration `20260328103000`) isn't in production; the app logs a warning and continues. Low impact.

The SQL in §1 confirms both against the live database. The fix is a decision for after the results (add `clients.name` back as an expand-only column, or change both frontends and the Edge Function to `first_name`/`last_name`).

**Your part: smoke-test the live production app** (production URL, your own manager account; don't create real customers — use your own email with `+test` for the client signup):

- [ ] Manager login → dashboard loads with today's numbers
- [ ] Calendar/appointments list loads; open one appointment
- [ ] Clients list and one client with their pets
- [ ] Staff list; time kiosk page opens
- [ ] Payroll page loads
- [ ] Checkout / Cobrar opens (don't charge)
- [ ] Public booking page of your business loads (incognito)
- [ ] Client sign-up with `you+p005@…` → expect it to **fail** (finding 1); note the exact message
- [ ] Browser console on each page: note any red errors (screenshot)

Paste back: which items failed and the console errors.
