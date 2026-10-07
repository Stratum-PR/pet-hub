# ATH Móvil plan for Grumi (agreed 2026-10-07)

Grumi and Mezza (`Stratum-PR/Mezza.pr`) will both take ATH Móvil payments through one shared, public TypeScript package, `athmovil` (its own repo under Stratum-PR, published to npm). The package holds only the ATH protocol; each app builds its own data, screens and server code on top. Mezza is built first, so the package is proven before Grumi starts; this file is everything Grumi needs and doesn't require access to the Mezza repo.

Status: planned, nothing built. The ATH Business account for live testing isn't available yet, so the package and Mezza are built against a fake ATH server first.

Sources: [ATHM-Payment-Button-API](https://github.com/evertec/ATHM-Payment-Button-API) (REST), [athmovil-webhooks](https://github.com/evertec/athmovil-webhooks), [athmovil-javascript-api](https://github.com/evertec/athmovil-javascript-api) (browser button, **not** used), [ath.business/botondepago](https://ath.business/en/botondepago).

## What ATH Móvil gives us

- `POST /payment` (server, business's public token): total, the **customer's** ATH phone number, timeout 120–600 s, optional subtotal/tax/items, `metadata1`/`metadata2` (40 chars each). Returns `ecommerceId` and an `auth_token` (JWT). The customer gets a push in the ATH Móvil app.
- Status: `OPEN` → `CONFIRM` (customer approved) → `COMPLETED`, or `CANCEL` (expired or cancelled).
- `POST /authorization` (with `auth_token`): **the business must call this after `CONFIRM`** to take the money. Without it the customer approved but nothing was charged.
- `POST /business/findPayment`, `POST /business/cancel`, `PUT /business/updatePhoneNumber`.
- `POST /refund` (public + private token, `referenceNumber`, amount; partial allowed).
- Webhooks: `POST https://www.athmovil.com/transactions/webhook/post` with both tokens, a `listenerURL` and event toggles. **Payloads aren't signed** and retries aren't documented.
- Limits: $1.00–$1,500.00 per payment. No tip field (the tip is part of the total). No idempotency key on `/payment`.
- **No sandbox.** Live testing uses a real ATH Business account, real money and a refund.

## Rules (shared with Mezza)

1. **Server-side REST only.** The JS button (the one `src/pages/Payment.tsx` points to) sets the total in the browser. The total must come from the database, read by an Edge Function.
2. **A webhook is a hint.** It only triggers `settle()`, which reads the real status from `findPayment`. The listener URL carries a per-business random secret, since ATH doesn't sign webhooks.
3. **`settle()` is the only path to "paid"**, and running it again is harmless. The waiting screen polling, the webhook and a scheduled sweeper all call it.
4. **Never retry `/payment` blindly.** A timeout on create may mean a live payment exists; look it up by `metadata2` (our id) or cancel it first.
5. **Tokens belong to each business**, are passed into every call and are stored encrypted per business, never in env vars or the browser.
6. **The customer's phone number is used for the request and not stored**, unless the client opts in.
7. **No automatic refunds.** If money arrives for something already paid, it's recorded, shown as an overpayment and flagged; staff decide and refund (Grumi's existing refund flow and `transaction_refunds`).
8. Amounts outside $1.00–$1,500.00 can't use ATH; the screen says why and offers other methods.

## Separate Docker test environments (required)

Each repo tests in its own Docker environment, so the package, Mezza and Grumi never share a database, ports or containers on the same machine. Each one runs with one command, and CI runs the same setup.

| Repo | Docker environment | Ports |
|---|---|---|
| `athmovil` (package) | `docker compose` with Node 20, Node 22 and Deno services running the tests and a smoke test against the build, plus a Supabase edge-runtime service running a sample Edge Function against the fake ATH over HTTP; no database | none published |
| Mezza | Supabase stack `project_id = "mezza"` | 55320–55329; fake ATH on 55330 |
| **Grumi** | **Its own local Supabase stack**, separate from the hosted project and from Mezza | **proposed 55420–55429; fake ATH on 55430** |

- Grumi's Edge Functions run inside Supabase's edge-runtime container, so tests can't hand them a fake `fetch`. The package's fake ATH also runs over HTTP (`npx athmovil fake --port 55430`); the functions get its base URL (`http://host.docker.internal:55430`) through a function secret, in place of the real ATH URL.
- `supabase/config.toml` currently holds the hosted project ref as `project_id` and uses the default ports. Before changing either for the local stack, confirm that linking and deploys use `supabase link` (`supabase/.temp/project-ref`), not `project_id`.
- Test data is separate from dev data: the test environment seeds its own test businesses and resets between runs. No real ATH tokens are ever used there.

## How a business connects (current understanding)

1. The owner opens the **ATH Business app → Settings** and copies the public and private tokens (the private token's exact location gets confirmed in the live spike).
2. They paste both into Business Settings → Payment setup → ATH Móvil (replacing today's "coming soon" card).
3. An Edge Function checks them with a harmless call (the package's `checkCredentials`), stores them encrypted, and registers the webhook to `https://<functions-url>/ath-webhook/<business-id>/<secret>`.
4. ATH Móvil shows as a payment method for that business.

Open with Evertec (asked by the Mezza side; answers apply to both): whether a platform may hold merchants' tokens, whether registering a webhook replaces one the business already has, how to unsubscribe, whether webhooks are signed or retried, and whether a test environment exists.

## The package Grumi will use

Plain ESM, `fetch` only, no runtime dependencies; runs on Node and Deno. Import in Edge Functions with `npm:athmovil@<version>` (name to be confirmed at publish).

- `createAthClient({ publicToken, privateToken?, fetch?, baseUrl? })`: tokens per business; `baseUrl` points tests at the fake.
- Integer cents in and out; converted to dollars only on the wire.
- `createPayment`, `findPayment`, `authorize`, `cancel`, `updatePhoneNumber`, `refund`, `registerWebhook`, `checkCredentials`, `settle`, `parseWebhook`.
- Typed errors: `invalid_token`, `expired`, `not_found`, `limit`, `invalid_phone`, `network`, `unknown` (raw Evertec code kept). Grumi translates them in `src/lib/translations.ts`.
- `createFakeAth()` in memory and over HTTP, with test controls: approve, decline, expire, fail the next call, deliver or replay webhooks.
- Before every release the package's own CI runs a sample Edge Function inside Supabase's edge runtime (the version the Supabase CLI uses) that imports the build and runs create → approve → settle → refund against the fake, so a package update can't break Grumi without failing there first. Grumi's G6 tests still run in Grumi's own environment.

## Grumi phases (after the package's 0.1.0 and Mezza's adapter)

What Grumi has today: `transactions` stores cents and already allows `payment_method = 'ath_movil'` (plus `payment_method_secondary` for split tenders); `src/pages/Payment.tsx` fakes ATH with a toast; transactions are written from the browser (`useTransactions.ts`); server code is Supabase Edge Functions.

- [ ] G0 Plan and test environment first: Grumi's own local Supabase stack (own local project id, ports 55420–55429, test seed with test businesses) and the fake ATH on 55430, reachable from the edge-runtime container; one command runs the ATH tests
- [ ] G1 Data: per-business ATH account (Vault secret ids for the tokens, webhook secret, status); ATH fields per payment (`ecommerce_id`, encrypted `auth_token`, `reference_number`, `expires_at`), on `transactions` or a `transaction_payments` table if a transaction can be paid in parts (cash + ATH); webhook dedupe; RLS so no client role can read tokens
- [ ] G2 Edge Functions: `ath-connect` (check, store, register webhook), `ath-start` (reads the transaction's total from the database; never trusts the browser's amount), `ath-settle`, `ath-webhook`, `ath-refund`; a scheduled sweeper for `OPEN`/`CONFIRM` payments
- [ ] G3 Business Settings: the ATH Móvil card next to Stripe, with where to find the tokens, connect and disconnect; strings in `translations.ts` (es and en)
- [ ] G4 Checkout: the client's phone number → "Abre ATH Móvil y confirma el pago" waiting screen with countdown → paid; wrong number, cancel and expiry handled; replaces the fake in `Payment.tsx`; the client portal can reuse it to pay ahead
- [ ] G5 Staff: overpayments flagged for staff to refund or keep (with a reason); refunds of ATH payments call ATH `refund` first, then record in `transaction_refunds`
- [ ] G6 Tests in the Docker environment against the fake (full flow, expiry, cancel, webhook replayed twice, settle racing itself, refunds never exceeding what was paid, amount read from the database), then a live $1 payment and refund with a real ATH Business account
