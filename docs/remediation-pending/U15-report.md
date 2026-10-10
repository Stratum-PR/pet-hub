# U15 worker report (saved by the coordinator 2026-10-10, before merge)

Use its FIX_LOG / OWNER_ACTIONS / DECISIONS text when merging U15; delete this file in the merge's docs commit.

---

## U15 · P2-01 appointments: employees cannot delete appointments, but can still cancel them

**Summary.** The database fix is done and the security tests pass: `test:security` all ✓, 2 known issues open. **The final CI run is red**, though, because E2E flow 4 failed on 2 attempts in a row. The evidence below says this is a timing problem in the spec, not this change. I re-ran twice, did not edit the spec, and am handing back for your call rather than re-running again.

### Cancel paths (looked at first)
No path an employee can reach cancels by DELETE, on any branch. Cancelling is always a status UPDATE, so the migration was safe to write. **No frontend change was needed or made.**

- **remediation**
  - Appointment book → details sheet "Cancelar cita" → confirm dialog → `act('cancel','canceled')` → `setStatus` → `updateAppointment(id, {status:'canceled'})`.
  - Declining a booking request (`AppointmentBook.tsx:431`): UPDATE `status:'canceled'` plus `decision_note`, `decided_at`, `decided_by_*`.
  - `EditAppointmentDialog` status select "Cancelled" → `onUpdate`, status `'cancelled'`.
  - `deleteAppointment` exists in `useSupabaseData.ts` and `useBusinessData.ts`, but nothing uses it: `Index.tsx` takes it from the hook and never passes it anywhere. There is no delete control in the remediation UI at all.
- **dev**: same as remediation (`AppointmentDetailsSheet:287`, `AppointmentBook:431/467`). `deleteAppointment` is not used either.
- **main**
  - Cancel is the `EditAppointmentDialog` status select "Cancelled" (UPDATE).
  - Delete is a **separate** trash button on `src/pages/Appointments.tsx` (lines 560, 684, 946). Its confirm dialog says "Delete Appointment… cannot be undone". It calls `deleteAppointment` → `.delete().eq('id').eq('business_id')`. Employees can see it; there is no role check. `BusinessAppointments.tsx` also has delete but is not routed.
- **Client portal** (`ClientPortalPublicPage`): reads only, by `client_id`. No cancel or delete.
- **Public booking**: `submit_booking_request` is SECURITY DEFINER and only inserts.
- **Edge functions** (`notify-appointment`, `send-appointment-reminder`): no deletes. The database has no SECURITY INVOKER function that deletes appointments.

### Branch and commits
`fix/U15-appointments-no-employee-delete`, pushed.
- `564fb15` test(security): employees cannot delete appointments; cancel, manager, staff lead, super admin and portal appointment paths (P2-01 appointments)
- `562bd32` fix(rls): only managers can delete appointments; employees still cancel by status (P2-01 appointments, decision 9)

Files:
- `supabase/migrations/20261009170000_appointments_delete_managers_only.sql`
- `supabase/rollbacks/20261009170000_appointments_delete_managers_only.down.sql`
- `scripts/test-env-security.mjs`

### Appointments policies, old → new
- **Old: 8 policies, 2 allow DELETE.**
  - "Appointments delete": FOR DELETE, any member of the business or super admin. This is the hole.
  - "Users can manage appointments from their business": FOR ALL, super admin or a business member with profile role manager/super_admin.
- **New: 10 policies, exactly 1 allows DELETE.**
  - Dropped "Appointments delete".
  - Added `appointments_delete_business_managers`: FOR DELETE TO authenticated, `is_business_manager(business_id)` OR super admin. The super admin clause covers rows with `business_id` NULL (the column is nullable).
  - Split the FOR ALL policy into "Users can read / insert / update appointments from their business", with expressions copied verbatim. On the scratch database, all four expressions hash identically to the old FOR ALL USING/CHECK (md5 a0e94f80…).
  - Unchanged: "Appointments select/insert/update", "Clients can read own appointments", "Demo workspace read appointments", "Users can access appointments from their business".
- `is_business_manager` covers everyone the FOR ALL policy let delete, so no manager loses delete.
- The migration requires 20261009120000 (it stops with an error otherwise) and is idempotent. `appointments.id` is untouched.

### Scratch PostgreSQL 16 check
- Used cluster u14 on port 55914 and database u15, with prod policies from the snapshot. The cluster is **stopped** now, and the u14/u15 databases were dropped.
- Scripts are in `/tmp/claude-0/-home-user-pet-hub/ab75a275-bf41-5561-b94b-c15536b1ad02/scratchpad/u15/` (`gen.sh`, `run.sh`, `scen.sql`, `split.sh`).
- Steps: prod → migration → migration again → rollback → rollback again → migration. All checks passed:
  - the rollback restores the policies exactly, and behavior after the rollback equals prod;
  - both scripts are idempotent;
  - re-migrating gives the same policies and behavior.
- Behavior was checked for 12 roles × 6 appointment rows × select/insert/update/cancel/delete.
- **Only DELETE changed**, and only for: employee A on its business's rows (including its own-staff row and a portal client's row), employee B on its own row, and a client profile linked to business A.
- Staff with access_role manager or admin, managers, profile role super_admin and super admins (including on a NULL-business row) keep delete.
- Cancel (status update), update, insert and select are identical for everyone.

### Evidence that legitimate paths still work on main and dev
New checks in `appointmentPolicies()`, all ✓ in CI:
- **Employee:**
  - reads the business's appointments;
  - books one (BookingFormDialog payload);
  - reschedules one;
  - sets confirmed / in_progress / completed / no_show / scheduled;
  - cancels with `'canceled'` (remediation/dev) and `'cancelled'` (main's edit dialog), and the row stays;
  - declines a request with the audit fields;
  - cannot delete an appointment it just booked.
- **Managers and super admins:**
  - a manager deletes the way main's `deleteAppointment` does;
  - another business's manager can neither cancel nor delete;
  - a profile-role employee with staff access_role manager deletes;
  - a super admin deletes, with a business and with `business_id` NULL.
- **Portal client:** reads its own appointments; cannot delete its own or a business's appointment.
- `known("employee cannot delete the business's appointments …")` is now `check()`.
- Public booking (submit_booking_request) has no direct check here. E2E flow 9 covers it and passed on every attempt.

### UI change, and what employees on main/production will see
- **No UI change.** Remediation has no appointment Delete control to hide.
- **On main/production after the migration:** an employee who clicks the trash icon on Appointments and confirms gets **no error**. Main's `handleConfirmDelete` shows the "Appointment deleted successfully" toast regardless of the result, and `deleteAppointment` returns true on a blocked 0-row delete. The appointment disappears from the list, then comes back on reload with its status unchanged.
- Cancelling on main (edit dialog → status Cancelled) keeps working for employees.
- Managers, staff with access_role manager/admin and super admins are unaffected.

### Local gates (before both pushes)
`npm run check`: tsc ratchet 29, lint 400, vitest 119/119. Placeholder `npm run build`: OK.

### CI
- **Red test-only run:** https://github.com/Stratum-PR/pet-hub/actions/runs/38021930702
  - `check` ✓.
  - `db-tests` ✗, and only the 2 employee appointment-delete checks failed ("employee cannot delete the business's appointments", "employee cannot delete an appointment they just booked").
  - payments 24/24, e2e 15/15 (flow 4 passed).
- **Final fix run:** https://github.com/Stratum-PR/pet-hub/actions/runs/38022331992 (status completed, **conclusion failure**). In all 3 attempts: `check` ✓, payments 24/24, `test:security` "All access-control checks passed" with **2 known issues open** (P2-02 kiosk PIN, P2-01 businesses).

| Attempt | E2E | What failed |
|---|---|---|
| 1 (~04:00Z) | 14/15 | Flow 7 (payroll): "Eli Empleado" row not found. Flow 4 **passed**. |
| 2 | 14/15 | Flow 7 passed. Flow 4 failed. |
| 3 | 14/15 | Flow 4 failed again. |

- **Flow 7:** attempt 1 ran exactly at midnight Puerto Rico time. The seed creates "today" shifts in PR time, so this looks like a date-boundary flake.
- **Flow 4, attempts 2 and 3:** both failed at `04-edit-cancel-appointment.spec.ts:45`, `expect(row).toContainText(/Cancelada/)` after the cancel and reload. Playwright's retry then failed at line 17, because the first try had already moved the row to 3 PM (the retry shows "Programada … 13 oct 2026 · 3 PM"). So after the cancel the row was neither cancelled nor deleted: its status never changed.
- **Likely cause:** the spec clicks "Cancelar cita", then checks `if (await confirm.isVisible())` without waiting. `AppointmentDetailsSheet` always opens an AlertDialog confirm. If the dialog hasn't rendered yet, the spec skips the confirm and no UPDATE is ever sent.
- This change only touches DELETE and keeps manager UPDATE unchanged. Flow 4 passed with this migration applied (attempt 1) and without it (red run).
- It is a different symptom from the earlier "Historial not appearing" flake, but the same spec.
- I could not download the playwright-report artifact: the blob host returned 403 through the proxy.
- **Owner decision:** accept this run as green on everything but the flake, re-run again, or have U07 fix the spec, e.g. `await expect(confirm).toBeVisible()` before clicking.

### FIX_LOG entry text
```
## 2026-10-10 · P2-01 appointments · Only managers can delete appointments; employees still cancel (decision 9)

**Status:** done on `remediation` (unit U15, branch `fix/U15-appointments-no-employee-delete`). **Not applied to production** (OWNER_ACTIONS D9).

**Problem.** Two permissive policies on `appointments` allowed DELETE and were OR-ed together. "Appointments delete" allowed any profile linked to the business, so every employee could delete any appointment of their business. Decision 9 (2026-10-09): employees may not delete appointments; they may cancel one (status change), which keeps the record; managers keep delete.

**Cancel paths.** Every frontend cancels by UPDATE, never by DELETE: remediation/dev AppointmentBook → AppointmentDetailsSheet "Cancelar cita" (`status 'canceled'`) and request decline (`'canceled'` + decision fields); main EditAppointmentDialog status select (`'cancelled'`). Main's separate trash button on Appointments.tsx is a real delete ("Delete Appointment"). Client portal only reads; public booking is SECURITY DEFINER insert-only; no edge function deletes appointments.

**Change.**
- `supabase/migrations/20261009170000_appointments_delete_managers_only.sql`.
  - Requires 20261009120000 (`is_business_manager`).
  - Drops "Appointments delete".
  - Creates `appointments_delete_business_managers`: FOR DELETE TO authenticated, `is_business_manager(business_id)` OR super admin. The super admin clause keeps delete on appointments with no business (business_id is nullable).
  - Splits the FOR ALL "Users can manage appointments from their business" into "Users can read/insert/update appointments from their business", with identical expressions.
  - Every other policy is unchanged, including "Appointments update", so employees keep booking, rescheduling and every status change (confirmed, in_progress, completed, no_show, canceled/cancelled).
- `supabase/rollbacks/20261009170000_appointments_delete_managers_only.down.sql`: recreates the 2 old policies verbatim from the production snapshot.
- `scripts/test-env-security.mjs`:
  - "employee cannot delete the business's appointments" moved from known() to check().
  - New regression checks: employee read/book/reschedule; every status the app sets; cancel ('canceled' and 'cancelled') and request decline keep the row; employee cannot delete an appointment they booked; manager delete; cross-business manager can't cancel or delete; staff access_role manager delete; super admin delete, with and without a business; portal client reads its own appointments and cannot delete them or a business's.
- No frontend change: remediation has no appointment delete control (the hooks' `deleteAppointment` is unused).

**Compatibility with `main` (shared database).**
- Expand-only for every flow either frontend uses except an employee's delete.
- On main an employee still sees the trash button on Appointments. Confirming it deletes nothing and shows no error (the "Appointment deleted successfully" toast still appears). The appointment vanishes from the list until a reload, with its status unchanged.
- Cancelling (edit dialog → Cancelled) keeps working for employees. Managers, staff with access_role manager/admin, super admins and portal clients are unaffected.

**Gates.**
- tsc 29 · lint 400 · vitest 119/119 · build OK.
- Red test-only run 38021930702: only the 2 employee appointment-delete checks failed.
- Fix run 38022331992: `check` ✓; `db-tests`: `test:payments` 24/24, `test:security` all ✓ + **2 known issues open** (was 3) on all 3 attempts. Smoke E2E 14/15 each attempt: flow 7 (payroll) failed on attempt 1 at PR midnight; flow 4 failed on attempts 2 and 3 at spec line 45 (the cancel's confirm dialog isn't awaited). Every flow passed at least once with this migration.
- Migration → rollback → migration verified on a scratch Postgres 16: policies and behavior identical after the rollback, both scripts idempotent, split expressions identical to the FOR ALL policy, the only behavior change is DELETE by non-manager business profiles.

**Production steps (Jovaniel; OWNER_ACTIONS D9).**
1. Confirm D6 (20261009120000, `is_business_manager`) is applied; the migration stops with an error otherwise. Apply after D8.
2. Backup (A3) and note its folder name: `__________`.
3. Paste the whole migration file into the Supabase SQL editor and run it. **Never `supabase db push`.**
4. `npx supabase migration repair --status applied 20261009170000`.
5. Verify (read-only): `select policyname, cmd from pg_policies where schemaname='public' and tablename='appointments' order by 1;`
   - Expect 10 rows.
   - Exactly one DELETE row: `appointments_delete_business_managers`.
   - Neither "Appointments delete" nor "Users can manage appointments from their business".
6. Smoke test on the dev page with the QA business:
   - as a manager: book, reschedule, cancel and (on main) delete an appointment;
   - as an employee: book, reschedule, confirm and cancel an appointment (it stays, shown as cancelled);
   - as a client: open the portal and see your appointments;
   - send a public booking request;
   - then, on the production app, cancel an appointment as a manager.
7. Watch for RLS errors on `appointments` for 24 h.

No frontend deploy is needed.

**Rollback (production).** Run `supabase/rollbacks/20261009170000_appointments_delete_managers_only.down.sql` in the SQL editor, then `npx supabase migration repair --status reverted 20261009170000`. This reopens "employees can delete any appointment of their business". The helpers belong to 20261009120000 and are not touched.

**Tag:** `fix/P2-01-appointments` once applied to production.

**Notes.**
- Main shows employees a trash button that now silently does nothing, with a success toast. Hiding it would need a main-side change (not in scope).
- A profile with role client and a business_id set also loses delete on that business's appointments; it keeps the old SELECT/INSERT/UPDATE via "Appointments select/insert/update" (not changed here).
- E2E flow 4 checks `confirm.isVisible()` without waiting after "Cancelar cita", so it can skip the confirm dialog and never cancel; this run failed that way twice. Flow 7 seeds "today" in PR time and failed once at PR midnight.
```

### OWNER_ACTIONS row
```
| D9 | Apply 20261009170000 (P2-01 appointments: only managers delete appointments; employees still cancel) in the SQL editor after D8, then `migration repair --status applied 20261009170000`, then run the FIX_LOG "P2-01 appointments" verify query (10 policies, one DELETE) and smoke test | Ready on `remediation` |
```

### DECISIONS
No new decision is needed; this implements decision 9. There is one open product question for the owner: should main's employee-visible trash button (it now does nothing silently) be hidden on main, or left until main gets the remediation frontend?

### Strings and other notes
- No translation strings needed.
- The pre-commit hook printed generic "admin route / audit_log" reminders. They are advisory and the commit was allowed.

