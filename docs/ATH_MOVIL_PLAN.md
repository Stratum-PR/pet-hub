# ATH Móvil plan for Grumi (superseded 2026-10-07)

This plan proposed a separate public `athmovil` package. It is **superseded by Genesis's design**, which both Grumi and Mezza now use:

- Shared code: the private package `@stratum-pr/payments` in `Stratum-PR/payment_methods` (ATH Móvil + Stripe Connect), copied into the Edge Functions with `scripts/sync-payment-libs.sh`.
- How Grumi's payments work: [PAYMENTS.md](PAYMENTS.md).
- What must be fixed before real payments: [PAYMENTS_SECURITY_REVIEW.md](PAYMENTS_SECURITY_REVIEW.md) (items G-1 to G-12 are Grumi's; P-1 to P-13 are the package's).

Still required from this plan (user request):

- **A separate Docker test environment for Grumi** (review item G-12): its own local Supabase stack, separate from the hosted project and from Mezza (proposed ports 55420–55429; Mezza uses 55320–55329), with a test seed of test businesses that resets between runs. The package's ATH Móvil simulator runs on its own port (proposed 55430) and the `payments` function points at it through a function secret. No real ATH tokens in tests. Before changing `project_id` or ports in `supabase/config.toml`, confirm deploys use `supabase link`.
- **The package is tested where Grumi runs:** `payment_methods` CI should run the tests on Node and inside Supabase's edge runtime, so a package update can't break Grumi's functions without failing there first.
- **Real ATH Móvil stays off** until one live $1 payment, a cancel, an expiry and a partial refund pass with a real ATH Business account.
