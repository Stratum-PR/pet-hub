# Payments (ATH Móvil now, Stripe next)

Shared code: private repo `Stratum-PR/payment_methods` (package `@stratum-pr/payments`), copied into the
Edge Functions by `scripts/sync-payment-libs.sh` (re-run it after changing the package, then redeploy).

## Pieces
- **Settings → Pagos** (`/:slug/settings/payments`, managers): ATH Móvil Off / Test mode / Real.
  Real mode asks for the business's public + private keys (ATH Business app → Settings). They are stored
  only in `business_payment_secrets` (service role) and checked by subscribing ATH Móvil's notifications.
- **Checkout** (`transactions/new`, opened from the appointment): with method ATH Móvil and ATH turned on,
  the button becomes "Cobrar con ATH Móvil". Staff enters the client's ATH phone; the client approves in
  the app; Grumi finalizes and saves the transaction as paid (inventory and appointment billing as before).
  If the page closes after the money arrives, reopening checkout for that appointment offers to save it.
- **Test mode**: the same flow against `athm-simulator` (Evertec has no sandbox). No real money.
  Interim fix for security review G-1, while dev.grumi.pet shares the production project:
  - Only managers can open the simulated phone (`/:slug/ath-simulador`) and approve, so staff can't approve
    their own test charges. Staff see "a manager approves this charge".
  - A sale paid on the simulator is flagged `transactions.is_test` by the server. Test sales show a "Prueba"
    badge, print "PRUEBA / TEST" on the receipt, don't email receipts, and are left out of the dashboard,
    reports and the client portal. A database trigger lets only server code set or clear the flag.
  - Mode and key changes go to `payment_audit_log` (managers can read it).
  - Function secret `PAYMENTS_SIMULATOR_ENABLED=false` turns test mode off for the whole project (use it on a
    production-only project once dev has its own).

## Functions
- `payments` (verify_jwt off, JWT checked in code): settings, `ath_create`, `ath_status` (finalizes approved
  charges, guarded so it happens once), `ath_cancel`, `link_transaction`, `unlinked_for_appointment`, and
  ATH Móvil notifications at `?webhook=<key>` (unsigned, so every notification is re-checked with ATH).
- `athm-simulator` (verify_jwt off): ATH API look-alike with Postgres state; customer controls need a JWT of
  the owning business.

## Tables
`business_payment_settings` (readable by staff), `business_payment_secrets`, `payment_secrets`,
`athm_sim_businesses`, `athm_sim_payments` (service role only), `payments` (staff read; writes in functions),
`payment_audit_log` (managers read; written by `payments`), `transactions.is_test` (server-only flag).

## Local test stack (security review G-12)
Separate from the hosted project: its own local Supabase (`project_id = "grumi-test"`, ports 55420–55429) and
the package's ATH Móvil simulator in Docker (55430). It runs from `.test-env/`, so `supabase link`,
`supabase/config.toml` and the default local ports stay untouched.

```
npm run test:env:up      # first run downloads Docker images (several minutes)
npm run test:payments    # real Postgres + RLS + triggers + Edge Functions, test and "real" ATH modes
npm run test:env:down
```
Also runnable on GitHub: Actions → "Payments test environment" → Run workflow. In "real" mode the
`payments` function talks to the simulator container through `ATH_API_BASE_URL`, which it honors only when
`PAYMENTS_ENV=local` and the host is local (set in `test-env/supabase/config.toml`, never in production).

## Going live with ATH Móvil
1. Test mode end to end on dev.grumi.pet.
2. Settings → Pagos → Real, paste the ATH Business keys.
3. Charge $1 to a personal ATH Móvil account (different card than the business), then refund it from the
   ATH Business app.

## Security review (2026-10-07)

Open security issues and fixes for Grumi payments, the shared package and Mezza: [PAYMENTS_SECURITY_REVIEW.md](PAYMENTS_SECURITY_REVIEW.md). Fix G-1 (test mode records real paid sales) and the other High/Medium items before turning on real ATH Móvil for businesses.
