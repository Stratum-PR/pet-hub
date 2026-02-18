# Pet Hub – Security Threat Assessment

This document is a threat-model style review: how an attacker could abuse the web app, backend, and infrastructure, and what mitigations exist or are recommended.

**Scope:** Frontend (React/Vite), Supabase (Postgres RLS, Auth, Storage, Edge Functions), Vercel middleware, and deployment/config. Focus: data theft, account takeover, spam/abuse, downtime, financial fraud.

**Last updated:** After applying path-based Storage RLS (H1), H2, M1, M2, M3, and app-level Storage check. See **Fixes applied** and **Pending issues** below.

---

## Fixes applied (code changes)

| ID | Fix | Where |
|----|-----|--------|
| **H2** | User-facing errors no longer show raw `error.message`. Generic message (e.g. "Something went wrong. Please try again.") used in toasts and error UI. | Login, AuthCallback, BusinessDashboard, BusinessServices, BusinessPets, BusinessSettings, PetForm, AdminBusinessDetail, Register, GlobalErrorBoundary |
| **H1 (app)** | PetForm now verifies that the pet’s `business_id` matches the current user’s business (via `useBusinessId()`) before any Storage upload or delete. If mismatch, operation is blocked and a generic error is shown. | [src/components/PetForm.tsx](src/components/PetForm.tsx) |
| **H1 (Storage RLS)** | Path-based Storage RLS: upload path is `{business_id}/{filename}`. Policies restrict INSERT/UPDATE/DELETE so the first path segment must equal the caller’s `business_id` (from `profiles`). Legacy flat paths: only object owner can UPDATE/DELETE. SELECT remains public for photo URLs. | [supabase/migrations/20260212000000_pet_photos_path_based_storage_rls.sql](supabase/migrations/20260212000000_pet_photos_path_based_storage_rls.sql), [PetForm.tsx](src/components/PetForm.tsx) |
| **M1** | Password-reset Edge Function CORS is no longer `*`. It uses env `ALLOWED_ORIGINS` (comma-separated). If the request `Origin` is in that list, that origin is returned; otherwise first listed origin or `*` if unset (backward compatible). **You must set `ALLOWED_ORIGINS` in Supabase Edge Function secrets** (e.g. `https://yourapp.com,https://www.yourapp.com`). | [supabase/functions/rate-limited-reset-password/index.ts](supabase/functions/rate-limited-reset-password/index.ts) |
| **M2** | Console logging gated with `import.meta.env.DEV` so logs only run in development. | BusinessDashboard, ProtectedRoute, Login, PetForm, auth.ts |
| **M3** | Security headers added in `vercel.json`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`. | [vercel.json](vercel.json) |

Translations: `common.genericError` and `login.errorGeneric` added for generic error messages.

---

## Pending issues (your action)

These items could not be fully fixed in code or cannot be corroborated without your environment. Follow the steps below.

### 1. Set CORS for the password-reset Edge Function

**What:** The Edge Function now *supports* restricted CORS but still allows `*` if `ALLOWED_ORIGINS` is not set.

**What to do:**

1. In **Supabase Dashboard** → Project → Edge Functions → `rate-limited-reset-password` → Secrets (or Project Settings → Edge Functions → secrets), add:
   - **Name:** `ALLOWED_ORIGINS`  
   - **Value:** Your production (and staging) app origins, comma-separated, e.g. `https://yourapp.vercel.app,https://www.yourapp.com`
2. Redeploy the function if needed: `supabase functions deploy rate-limited-reset-password`
3. Test: from your app origin, “Forgot password” should still work; from another origin, the browser may block the request (expected).

---

### 2. ~~Storage: path-based RLS or proxy~~ (done)

**What:** Path-based Storage RLS is now in place. PetForm uploads to `{business_id}/{filename}` and a migration restricts INSERT/UPDATE/DELETE so the first path segment must match the caller’s `business_id`. Legacy flat paths can only be updated/deleted by the object owner.

**Status:** Implemented. See **Fixes applied** (H1 Storage RLS). No further action required unless you add other clients that write to `pet-photos` (use the same path prefix).

---

### 3. Supabase project CORS (dashboard)

**What:** Supabase project-level CORS is configured in the Supabase Dashboard, not in this repo. If it is set to `*`, other sites could call your Supabase API (anon) from the browser.

**What to do:**

1. In **Supabase Dashboard** → Project Settings → API (or Auth settings), find **CORS / allowed origins**.
2. Set it to your production and staging origins only (e.g. `https://yourapp.com`, `https://yourapp.vercel.app`). Remove `*` in production.
3. Test: the app should still work; requests from an origin not in the list should be blocked by the browser.

---

### 4. RLS and migrations (audit)

**What:** We did not run your Supabase project or re-run all migrations. It’s possible a later migration relaxed RLS or added a table without policies.

**What to do:**

1. In Supabase SQL Editor (or locally with `supabase db reset`), list tables: `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`
2. For each table with sensitive data, run: `SELECT * FROM pg_policies WHERE tablename = 'your_table';` and confirm RLS is enabled and policies scope by `auth.uid()` / `business_id` (or equivalent).
3. If you add new tables, always enable RLS and add policies; the pre-commit hook warns on new migrations without RLS.

---

### 5. Stripe (when you implement)

**What:** Stripe checkout and webhooks are not implemented in the repo; only documented in [API_ROUTES.md](API_ROUTES.md). If you add them without verifying signatures and using server-side keys, attackers could fake payments or webhook events.

**What to do:**

1. When implementing webhooks, always verify the signature with `stripe.webhooks.constructEvent(body, signature, webhookSecret)` and reject if verification fails.
2. Never use Stripe secret key or service role in client code. Use Edge Functions or a backend for checkout and webhook handling.
3. See [docs/SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md) and [API_ROUTES.md](API_ROUTES.md) for patterns.

---

### 6. Admin impersonation links (training)

**What:** If an admin opens a link like `https://yourapp.com/admin/impersonate/{token}` from an untrusted email or site, an attacker could have set up that URL to capture the token or redirect. Token is one-time and short-lived, but link handling matters.

**What to do:**

1. Document for admins: only use “Impersonate” from the admin dashboard; avoid opening impersonation links from email or unknown sources.
2. Prefer “Copy link” and open in the same browser where you’re already logged in as admin, rather than clicking links from other apps.

---

### 7. DDoS / rate limits (optional)

**What:** Vercel middleware limits 100 req/IP/hour to the SPA; Supabase and Edge Functions have their own limits. A large botnet could still send many requests from many IPs.

**What to do:**

1. If you see abuse or need stronger DDoS protection, put Cloudflare (or similar) in front of Vercel and/or Supabase and enable their rate limiting and WAF.
2. Document in [docs/RATE-LIMITING-GUIDE.md](docs/RATE-LIMITING-GUIDE.md) which limits apply where (SPA vs API vs Auth).

---

## 1. Attack surface map

### Frontend (React/Vite)

| Surface | Location | Notes |
|--------|----------|--------|
| Routes | [src/App.tsx](src/App.tsx) | Protected routes use `ProtectedRoute` with optional `requireAdmin`. Demo routes (`/demo/*`) are public. |
| Auth gating | [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx), [src/lib/auth.ts](src/lib/auth.ts) | Client-side only; redirects unauthenticated/non-admin. Session and impersonation state in sessionStorage. |
| Redirects | [src/pages/Login.tsx](src/pages/Login.tsx), [src/pages/AuthCallback.tsx](src/pages/AuthCallback.tsx), [src/pages/Landing.tsx](src/pages/Landing.tsx) | Post-login destination from `getRedirectForAuthenticatedUser()` / `getDefaultRoute()`; no user-controlled redirect URL. `AuthCallback` uses `searchParams.get('code')` for OAuth code only. |
| Query params | [src/pages/SignupSuccess.tsx](src/pages/SignupSuccess.tsx), [src/pages/Appointments.tsx](src/pages/Appointments.tsx), PetList/Clients | `session_id`, `highlight`, `pet` – used for in-app state, not redirect targets. |
| Dynamic HTML | [src/components/PetAnimations.tsx](src/components/PetAnimations.tsx) (innerHTML fallback), [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts), [src/main.tsx](src/main.tsx) | PetAnimations: static SVG string on image load error. Client/main: static config/error UI. [src/components/ui/chart.tsx](src/components/ui/chart.tsx): theme CSS from object, not user input. |
| Storage usage | [src/components/PetForm.tsx](src/components/PetForm.tsx) | Upload/delete to Supabase Storage `pet-photos`; path = `{business_id}/{timestamp}-{random}.{ext}`. PetForm verifies pet’s `business_id` matches current business before any Storage op. Storage RLS restricts INSERT/UPDATE/DELETE by path prefix (see Fixes applied). Bucket has 5MB + MIME restrict. |
| Password reset | [src/pages/Login.tsx](src/pages/Login.tsx) | Calls `supabase.functions.invoke('rate-limited-reset-password', { body: { email } })`. |
| Impersonation | [src/pages/AdminBusinessDetail.tsx](src/pages/AdminBusinessDetail.tsx), [src/pages/ImpersonateHandler.tsx](src/pages/ImpersonateHandler.tsx) | Token generated via `supabase.rpc('generate_impersonation_token', { target_business_id })`. Consumption via `supabase.rpc('use_impersonation_token', { impersonation_token })` then sessionStorage set. |

### Backend – Supabase

| Surface | Location | Notes |
|--------|----------|--------|
| RLS | [supabase/migrations/20250120000000_create_multi_tenant_schema.sql](supabase/migrations/20250120000000_create_multi_tenant_schema.sql) and later migrations | Tables scoped by `business_id` and `auth.uid()` / profile; super_admin can read all. Policies for profiles, businesses, customers/clients, pets, services, appointments, employees, time_entries, admin_impersonation_tokens. |
| Impersonation RPCs | Same migration | `generate_impersonation_token`: SECURITY DEFINER, checks `is_super_admin` server-side. `use_impersonation_token`: SECURITY DEFINER, validates token/expiry/one-time use; caller identity not restricted (by design). |
| Storage RLS | [supabase/migrations/20260212000000_pet_photos_path_based_storage_rls.sql](supabase/migrations/20260212000000_pet_photos_path_based_storage_rls.sql) | `pet-photos`: public read; INSERT/UPDATE/DELETE for `auth.role() = 'authenticated'` only. No path-based restriction (e.g. by business_id); migration notes “app should validate” ownership. |
| Edge Functions | [supabase/functions/rate-limited-reset-password/index.ts](supabase/functions/rate-limited-reset-password/index.ts) | Password reset; rate limit 3/email/hour via Upstash; CORS uses `ALLOWED_ORIGINS` env (see Pending issues). No other Edge Functions in repo (Stripe/checkout/impersonate from API_ROUTES.md are documentation only). |

### Infrastructure

| Surface | Location | Notes |
|--------|----------|--------|
| Rate limiting | [middleware.ts](middleware.ts) | Vercel Edge: 100 req/IP/hour (sliding window), Upstash Redis. Skips static assets. 429 returns HTML + Retry-After. |
| Routing | [vercel.json](vercel.json) | SPA rewrite: all non-static to index.html. Security headers added (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS). |

---

## 2. Attacker profiles (assumptions)

- **Opportunistic:** Brute-force login, spam password reset, hit obvious APIs, scrape public demo.
- **Insider / curious tenant:** Logged-in business user trying to see other businesses’ data or overwrite their storage.
- **More capable:** Abuse Supabase/Stripe from client or forged requests, probe RLS and Storage, attempt SSRF or supply-chain (out of scope for this doc).

---

## 3. Vulnerability and abuse paths (by category)

### A. Authentication and authorization

**ProtectedRoute / admin:**  
- **Exploit:** Attacker ignores UI and calls Supabase from browser console or script with a stolen/legit JWT: `supabase.from('businesses').select('*')`, or `supabase.from('profiles').select('*')`.  
- **Mitigation:** RLS enforces tenant and super_admin on all tables. Client-side `requireAdmin` only hides UI; data access is server-enforced.

**Impersonation:**  
- **Exploit:** Steal or guess impersonation token (32-char hex, 1h expiry, one-time). Open `/admin/impersonate/:token` in same browser where an admin is logged in, or phish admin to open link.  
- **Mitigation:** Token is random, short-lived, single-use; RLS on `admin_impersonation_tokens` limits who can create tokens. Risk is token leakage (e.g. shared link, logs) or admin opening link on compromised device.

**Session / logout:**  
- **Exploit:** After “Exit impersonation,” sessionStorage is cleared but Supabase session remains; user is still admin. Impersonation state is client-only.  
- **Mitigation:** By design; no extra risk as long as RLS and token design hold.

**Summary:** AuthZ is enforced in DB and RPCs. Main residual risk is impersonation token handling and phishing of admins.

---

### B. Supabase database and RLS

**Tenancy:**  
- **Exploit:** Attacker with valid JWT for business A calls `supabase.from('clients').select('*')` or similar; may try to pass `business_id` in filters.  
- **Mitigation:** RLS uses `auth.uid()` and profile’s `business_id` (or super_admin). Client cannot override row-level visibility. Later migrations (e.g. clients table, insert policies) should be verified to keep same pattern.

**Probing:**  
- **Exploit:** List tables, try INSERT/UPDATE with other `business_id`, try joins that might leak other tenants.  
- **Mitigation:** RLS and WITH CHECK restrict rows; INSERT/UPDATE policies enforce same business_id. Super_admin is the only cross-tenant role and is DB-backed.

**Summary:** RLS design is strong. Recommendation: ensure every table with sensitive data has RLS and that no policy allows unconstrained SELECT (e.g. “authenticated can read all”).

---

### C. Supabase Storage and file handling

**Pet photos bucket:**  
- **Exploit:** Any authenticated user can call `supabase.storage.from('pet-photos').upload('attacker-file.png', blob)` or `.remove([...])`. Paths are flat (`{timestamp}-{random}.ext`), not prefixed by business_id. Attacker could overwrite/delete objects if they guess or enumerate paths, or fill bucket.  
- **Mitigation:** Bucket has 5MB and MIME allowlist at DB level. RLS does not scope by path or business; migration explicitly says “app should validate that the pet belongs to their business.” So app-level checks in PetForm (and any other upload/delete) are critical.

**PetForm:**  
- **Exploit:** Bypass UI and call Storage directly; or manipulate form to upload for a pet belonging to another business.  
- **Mitigation:** PetForm now checks that the pet’s `business_id` matches the current user’s business (via `useBusinessId()`) before any upload or delete; mismatch blocks the op. Storage RLS enforces path prefix by business_id at the DB level.

**Summary:** Storage is now scoped by tenant at the RLS level (path-based) plus app-level validation in PetForm.

---

### D. Edge Functions and API endpoints

**Password reset (`rate-limited-reset-password`):**  
- **Exploit:** Call from any origin if CORS is permissive. Attacker can trigger 3 reset emails/hour per email (rate limit).  
- **Mitigation:** Rate limit (3/email/hour). CORS is now driven by env `ALLOWED_ORIGINS`; you must set it in Supabase Edge Function secrets (see Pending issues).

**Stripe (from API_ROUTES.md):**  
- **Exploit:** If checkout or webhook is implemented without verification: fake checkout session, or POST fake events to webhook URL to trigger subscription/user creation.  
- **Mitigation:** Doc shows webhook signature verification and service role only server-side. When implementing, ensure every webhook handler uses `stripe.webhooks.constructEvent` and never trusts body without signature.

**Admin impersonation (API_ROUTES.md):**  
- **Exploit:** If an Edge Function for impersonation existed and only checked JWT without verifying `is_super_admin` in DB, any user could call it.  
- **Mitigation:** Current implementation uses RPC `generate_impersonation_token` with server-side `is_super_admin` check. No Edge Function needed for token generation.

**Summary:** Password-reset CORS is the only live Edge issue. Stripe and impersonation are doc/design; keep server-side checks when implementing.

---

### E. Rate limiting and abuse

**Global (middleware):**  
- **Exploit:** 100 req/IP/hour is per IP. Attacker with many IPs (botnet, proxies) can still send high volume. Static assets are skipped, so heavy asset requests don’t count.  
- **Mitigation:** Reduces single-IP abuse; cannot stop distributed DoS. Consider Cloudflare or similar for DDoS and optional WAF.

**Bypass:**  
- **Exploit:** Supabase Auth and Edge Functions are invoked directly (e.g. Supabase project URL). Vercel middleware runs on Vercel; requests to Supabase bypass it. So login and password-reset rate limits are enforced by Supabase and the Edge Function, not by middleware.  
- **Mitigation:** Login: Supabase Auth rate limits apply. Reset: Edge Function + Upstash. Middleware protects the SPA and same-origin navigation.

**Summary:** Rate limiting is layered; middleware protects the app, not Supabase endpoints. Acceptable if Supabase/Edge limits are in place; document where each limit applies.

---

### F. Frontend / browser-side issues

**XSS:**  
- **Exploit:** Find places that render user-controlled data with `dangerouslySetInnerHTML` or `innerHTML`.  
- **Current:** PetAnimations uses `innerHTML` only for a static SVG fallback (no user input). Chart uses `dangerouslySetInnerHTML` for theme CSS from a fixed object. Client/main use static strings for config/error UI; main escapes `msg` for error display. No user-supplied HTML rendered unsanitized in reviewed code.  
- **Mitigation:** Pre-commit warns on dangerous patterns. Continue to avoid inserting user input into HTML; if needed, use DOMPurify or safe alternatives.

**Open redirect:**  
- **Exploit:** e.g. `?redirect=https://evil.com` and app does `navigate(searchParams.get('redirect'))`.  
- **Current:** Login/AuthCallback/Landing use fixed destinations or `getDefaultRoute`/`getRedirectForAuthenticatedUser()`; no user-controlled redirect target.  
- **Mitigation:** Pre-commit blocks unvalidated redirect from query. Keep redirects allowlisted.

**Information leakage:**  
- **Exploit:** Console logs, error toasts with `error.message`, or stack traces in UI.  
- **Current:** Console calls are gated with `import.meta.env.DEV`. User-facing errors show a generic message; GlobalErrorBoundary shows generic message in production and full error only in dev.  
- **Mitigation:** Pre-commit still warns on new console use; keep errors generic in production.

**Summary:** No critical XSS or open redirect in current code; reduce logging and error exposure in production.

---

### G. Configuration and infrastructure

**CORS:**  
- **Current:** Password-reset Edge Function uses `ALLOWED_ORIGINS` env; set it in Supabase (see Pending issues). Supabase project CORS is still configured in dashboard (not in repo).  
- **Recommendation:** Set Supabase project CORS to your app origins only in the dashboard.

**Security headers:**  
- **Current:** vercel.json now sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Strict-Transport-Security (see Fixes applied).  
- **Optional:** Add a restrictive Content-Security-Policy if you can without breaking the app.

**Secrets:**  
- **Exploit:** .env committed, or VITE_* used for service role.  
- **Current:** Pre-commit blocks .env and service-role in client; .env.example present.  
- **Recommendation:** Keep key rotation and Secret Scanning as in checklist.

**Summary:** CORS on the reset function and missing explicit security headers are the main config items to harden.

---

## 4. Prioritized risk list

| Priority | ID | Finding | Attacker action | Impact | Current mitigation | Residual risk |
|----------|----|---------|------------------|--------|--------------------|---------------|
| High | H1 | Storage RLS not scoped by tenant | Authenticated user uploads/deletes in pet-photos; could overwrite/delete others’ files if paths are guessable or enumerate | Data loss, abuse, tenant isolation failure | Bucket size/MIME limits; app “should” validate ownership | **Low** (path-based RLS + app check) |
| High | H2 | Error messages to user | Attacker triggers errors, sees `error.message` in toast/UI | Leak of paths, queries, or internals | Pre-commit warns; some toasts still show raw message | **Medium** (code changes needed) |
| Medium | M1 | Password-reset CORS `*` | Any site can call reset; 3/email/hour limit | Harassment, email probing | Rate limit and Supabase behavior | **Medium** (tighten CORS to app origin) |
| Medium | M2 | Console logging in production | Attacker opens DevTools, sees logs (paths, IDs, profile) | Information disclosure | Pre-commit warns | **Medium** (remove or gate behind env) |
| Medium | M3 | Security headers not explicit | Clickjacking, MIME sniffing if Vercel defaults insufficient | Session or content manipulation | Unknown Vercel defaults | **Medium** (set headers in vercel.json) |
| Low | L1 | Impersonation token phishing | Attacker gets admin to open `/admin/impersonate/:token` | Admin privileges in victim session | Token one-time and short-lived | **Low** (training, link handling) |
| Low | L2 | Rate limit bypass via many IPs | Distributed requests to app or Supabase | DoS or resource exhaustion | Middleware + Supabase limits | **Low** (accept or add Cloudflare) |
| Low | L3 | Stripe webhook / checkout not implemented | When implemented, missing verification | Fake payments or subscription state | Doc shows correct pattern | **Low** (enforce at implementation) |

---

## 5. Remediation checklist (reference)

- **H1 – Storage:** App-level check in PetForm and path-based Storage RLS (business_id path prefix) are done.
- **H2 – Error exposure:** Done; generic messages and dev-only logging.
- **M1 – CORS:** Code uses `ALLOWED_ORIGINS`; set the secret (see Pending issues).
- **M2 – Console:** Done; gated with `import.meta.env.DEV`.
- **M3 – Headers:** Done in vercel.json.
- **L1–L3:** See Pending issues for optional and future items.

---

## 5b. (Legacy) Detailed remediation options

### High

- **H1 – Storage** (done)
  - **Option A (implemented):** Upload path is `{business_id}/{file}`; migration [20260212000000_pet_photos_path_based_storage_rls.sql](supabase/migrations/20260212000000_pet_photos_path_based_storage_rls.sql) restricts INSERT/UPDATE/DELETE by `(storage.foldername(name))[1]` = caller’s `business_id` from profiles. PetForm uses business_id prefix and validates pet ownership before any Storage op.

- **H2 – Error exposure**
  - In [BusinessDashboard.tsx](src/pages/BusinessDashboard.tsx), [BusinessServices.tsx](src/pages/BusinessServices.tsx), and any other place that shows `error.message` in a toast or UI: catch errors, log full error only in dev or server-side, and show a generic message (e.g. “Something went wrong. Please try again.”) to the user.
  - Optionally add a small logger that in production never sends stack or message to the client.

### Medium

- **M1 – Password-reset CORS**
  - In [supabase/functions/rate-limited-reset-password/index.ts](supabase/functions/rate-limited-reset-password/index.ts), replace `Access-Control-Allow-Origin: "*"` with your app origin(s), e.g. from env `APP_ORIGIN` or `ALLOWED_ORIGINS`, and use that in the CORS header. Keep OPTIONS and error responses consistent.

- **M2 – Console**
  - Remove or wrap in `import.meta.env.DEV` all `console.log`/`console.warn`/`console.error` in [ProtectedRoute.tsx](src/components/ProtectedRoute.tsx), [Login.tsx](src/pages/Login.tsx), [PetForm.tsx](src/components/PetForm.tsx), [auth.ts](src/lib/auth.ts), and other production paths. Pre-commit already flags these.

- **M3 – Headers**
  - In [vercel.json](vercel.json) (or Vercel project settings), add headers for all routes where possible, e.g.:
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'self'`
    - A minimal `Content-Security-Policy` if feasible (without breaking the app).

### Low (good practice)

- **L1:** Document for admins: do not open impersonation links from untrusted sources; prefer copying link only when needed.
- **L2:** If DoS becomes a concern, add Cloudflare (or similar) in front of Vercel and/or Supabase and document rate limits in [docs/RATE-LIMITING-GUIDE.md](docs/RATE-LIMITING-GUIDE.md).
- **L3:** When implementing Stripe, ensure every webhook uses signature verification and that checkout/session creation use server-side keys only; reference [API_ROUTES.md](API_ROUTES.md) and [SECURITY-CHECKLIST.md](docs/SECURITY-CHECKLIST.md).

---

## 6. Summary

- **AuthZ and RLS:** Strong; admin and tenant boundaries enforced server-side. Impersonation uses one-time, short-lived tokens and server-side super_admin check.
- **Storage:** PetForm validates pet ownership before upload/delete. Path-based Storage RLS enforces business_id path prefix for INSERT/UPDATE/DELETE.
- **Edge / API:** Password-reset CORS is configurable via `ALLOWED_ORIGINS`; set it in Supabase. When implementing Stripe, verify signatures and use server-side keys.
- **Frontend:** Console gated to dev; user-facing errors are generic. No critical XSS or open redirect.
- **Infra:** Security headers set in vercel.json.

Use this document with [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md) and the pre-commit hook. Address **Pending issues** in your environment and when you add new features.
