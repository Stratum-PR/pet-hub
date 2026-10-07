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
- **Test mode**: the same flow against `athm-simulator` (Evertec has no sandbox). The "client" approves at
  `/:slug/ath-simulador` (Abrir teléfono simulado). No real money.

## Functions
- `payments` (verify_jwt off, JWT checked in code): settings, `ath_create`, `ath_status` (finalizes approved
  charges, guarded so it happens once), `ath_cancel`, `link_transaction`, `unlinked_for_appointment`, and
  ATH Móvil notifications at `?webhook=<key>` (unsigned, so every notification is re-checked with ATH).
- `athm-simulator` (verify_jwt off): ATH API look-alike with Postgres state; customer controls need a JWT of
  the owning business.

## Tables
`business_payment_settings` (readable by staff), `business_payment_secrets`, `payment_secrets`,
`athm_sim_businesses`, `athm_sim_payments` (service role only), `payments` (staff read; writes in functions).

## Going live with ATH Móvil
1. Test mode end to end on dev.grumi.pet.
2. Settings → Pagos → Real, paste the ATH Business keys.
3. Charge $1 to a personal ATH Móvil account (different card than the business), then refund it from the
   ATH Business app.
