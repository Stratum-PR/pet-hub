# Senior Security Engineer – Checklist & Vulnerability Guide

**Stack:** React 18 + Vite · Supabase (Postgres + Auth + Storage) · Future: Stripe, ATH Móvil  
**Goal:** Prevent harmful code from entering the repo and catch issues before every commit.

---

## 1. Pre-commit hook (run before every commit)

- **Location:** `scripts/pre-commit`
- **Install (Husky):**  
  `npx husky init` then  
  `npx husky add .husky/pre-commit "node scripts/pre-commit"`
- **Install (manual):**  
  `cp scripts/pre-commit .git/hooks/pre-commit` and `chmod +x .git/hooks/pre-commit`

The hook **blocks** commit on CRITICAL (secrets, .env staged, SQL injection patterns, missing RLS, open redirect, Stripe webhook without verification, typosquat packages) and **warns** on many others (console.log, XSS patterns, .gitignore gaps, etc.). See `SECURITY-HOOK-README.md` in Downloads or the script header for the full list.

---

## 2. “Hacker” vulnerability list – exploit + fix

| # | Vulnerability | How it’s exploited | How to fix |
|---|----------------|--------------------|------------|
| 1 | **Secrets in repo** | Clone repo, grep for `sk_live_`, `eyJ...`, connection strings; use keys to access your Supabase/Stripe. | Never commit `.env`. Use `.env.example` with placeholders. Pre-commit blocks secrets. Rotate any key that ever touched git. |
| 2 | **Service role in client** | Open DevTools → Sources/Network, find `createClient(..., service_role_key)`. Call Supabase API with it; bypass RLS, read all data. | Use only anon key in client. Service role only in Edge Functions / backend. Pre-commit flags `VITE_*SERVICE_ROLE*` and service_role in `src/`. |
| 3 | **SQL injection** | Submit `' OR 1=1 --` in a form that gets concatenated into SQL. | Use parameterized queries only. Supabase client (`.eq()`, `.insert()`, etc.) is safe. Never interpolate user input into raw SQL. |
| 4 | **XSS** | Submit `<script>...</script>` or `onerror=...` in a field rendered with `dangerouslySetInnerHTML` or `innerHTML`. | Sanitize with DOMPurify; prefer `textContent` or safe React rendering. Pre-commit warns on dangerous patterns. |
| 5 | **Open redirect** | `?redirect=https://evil.com`. App does `navigate(searchParams.get('redirect'))`. User lands on phishing site. | Allowlist: only redirect to known paths (e.g. `['/', '/dashboard']`). Pre-commit blocks unvalidated redirect from query. |
| 6 | **No RLS** | With anon key, call `supabase.from('profiles').select('*')` and read every row. | Enable RLS on every table; add policies so `auth.uid()` (or equivalent) scopes rows. Pre-commit blocks new tables without RLS. |
| 7 | **Storage – other users’ files** | Guess or enumerate paths: `storage.from('avatars').download('other-user-id/photo.png')`. | Storage RLS: policies so SELECT/UPDATE/DELETE only where `auth.uid()::text = (storage.foldername(name))[1]` (or equivalent). |
| 8 | **CORS = *** | Attacker site runs `fetch('https://your-api.com/...', { credentials: 'include' })`. Browser sends cookies; attacker reads response. | Set CORS allowed origins to your production (and staging) domain only. Never `*` in production. |
| 9 | **Fake Stripe webhooks** | Attacker POSTs to your webhook URL with fake `payment_intent.succeeded`. You credit account without real payment. | Verify signature with `stripe.webhooks.constructEvent(body, sig, webhookSecret)`; reject if verification fails. Pre-commit blocks webhook code without verification. |
| 10 | **Protected route only in UI** | Attacker calls your API with curl and a stolen/forged JWT; no server-side role check. | Every protected API/Edge Function must check `user`/`profile` (e.g. `is_super_admin`) server-side before doing privileged work. |
| 11 | **Sensitive data in console** | User opens DevTools; `console.log` shows tokens, emails, or internal errors. | Remove or gate `console.*` in production; use a proper logger and never log secrets. Pre-commit warns on console in prod code. |
| 12 | **Full error trace to user** | Error page or API response returns `error.stack`. Attacker learns paths, dependencies, DB hints. | Catch errors; return generic message to user; log full error server-side only. |
| 13 | **Password reset / login spam** | Spam forgot-password or login; victim gets flooded or attacker brute-forces. | Rate limit: e.g. 3 reset/email/hour, 10 login attempts/IP/15 min. Use Supabase or Edge + Redis (e.g. Upstash). |
| 14 | **No rate limit on API** | Attacker sends 10k req/min; exhaust DB or get billed for 3rd-party APIs. | Global API rate limit (e.g. 100 req/IP/hour); per-user limits for expensive operations (e.g. 50/day for OpenAI). |
| 15 | **Old secrets in git history** | Even after removing from latest commit, keys remain in history. | Rotate all keys that might have been committed. Use GitHub Secret Scanning; consider `git filter-repo` to purge history if needed. |
| 16 | **No GDPR delete** | User requests deletion; you only delete `auth.users` row; profiles, storage, related tables remain. | Delete all rows where `user_id = X`, remove user’s storage objects, then delete auth user. Log in audit_log. |
| 17 | **Malicious npm packages** | Typo: install `lodahs` instead of `lodash`; package runs postinstall script and exfiltrates env. | Verify package name on npm before install; use lockfile and `npm ci`; pre-commit flags known typosquats. |
| 18 | **DDoS** | Flood your API or auth endpoints to cause outage. | Use Vercel/Cloudflare (or similar) rate limiting and DDoS protection; keep rate limits on auth and API. |
| 19 | **Large / wrong file uploads** | Upload 500MB or .exe to storage; cost or abuse. | Client + server: max size (e.g. 5MB), allowlist MIME types; validate server-side (e.g. Supabase Edge or bucket config). |
| 20 | **JWT too long-lived / no rotation** | Stolen JWT valid for months. | Set JWT expiry (e.g. 7 days); use refresh token rotation (Supabase Auth supports this). |

---

## 3. Config and deployment (not in pre-commit)

- **.env:** Never commit. `.gitignore` must include `.env`, `.env.local`, `.env.*.local`, and env-specific files. Use `.env.example` with placeholder keys.
- **CORS:** In Supabase (and any API): set allowed origins to your production (and staging) domain only. Never `*`.
- **Redirect URLs:** In Supabase Auth (and OAuth providers), only add your real site and callback URLs. Validate redirect targets in code against an allowlist.
- **RLS:** Every table has RLS enabled and policies so users only access their own data (by `auth.uid()` or equivalent).
- **Storage policies:** Users can only read/update/delete objects in “their” path (e.g. folder = `auth.uid()`).
- **Rate limits:**  
  - General API: e.g. 100 requests/hour/IP.  
  - Login: e.g. 10 attempts/IP/15 min.  
  - Password reset: e.g. 3 requests/email/hour.  
  - Costly endpoints (e.g. AI): e.g. 50 requests/user/day.
- **JWT:** 7-day expiry; refresh token rotation (configure in Supabase Auth).
- **Stripe:** In production, test only with Stripe test keys and a separate Supabase staging project. Never use live keys for testing.
- **Errors:** Never return stack traces or internal details to the client; generic message + server-side logging only.
- **DDoS:** Rely on host (Vercel/Cloudflare) and rate limiting; same auth and limits for mobile APIs.
- **Post-build:** Run `npm audit` / `npm audit fix` after dependency changes; check for breaking changes before major upgrades.
- **Keys:** Rotate API keys every 90 days; enable GitHub Secret Scanning.

---

## 4. audit_log table

- **Required for:** user deletion, role changes, payment events, data export.
- **Keep up to date:** When you add new sensitive actions (e.g. new admin action, new payment flow), add a corresponding audit log write.
- Pre-commit reminds when migrations or user-deletion–related code change.

---

## 5. Before deploy checklist

- [ ] `.env` (and all env files with secrets) in `.gitignore`; no `.env` committed.
- [ ] `.env.example` exists with all required keys (values redacted).
- [ ] Supabase: RLS on all tables; Storage policies so users only access their own files.
- [ ] Supabase: CORS = production (and staging) domain only; redirect URLs allowlist.
- [ ] No service_role key in client (check DevTools / build).
- [ ] Stripe webhook verifies signature; test mode + separate Supabase for staging.
- [ ] Protected routes/APIs check role/server-side; same auth and rate limits for mobile.
- [ ] `npm audit` clean (or only accepted risks); no full traces returned to users.
- [ ] Source maps: off or hidden in production.
- [ ] GitHub Secret Scanning (and optionally Dependabot) enabled.
- [ ] File upload: 5MB max and MIME allowlist; server-side validation where possible.

---

## 6. Quick reference – pre-commit vs this doc

| Pre-commit (automated) | This doc (manual / config) |
|------------------------|----------------------------|
| Secrets, .env staged, SQL injection patterns, RLS on new tables, open redirect, Stripe webhook verification, typosquat packages, console.log, XSS patterns, .gitignore, file upload size/type reminders, error exposure, protected route and storage reminders, audit_log reminder | CORS, JWT/refresh, rate limits, DDoS, GDPR delete implementation, Stripe test vs live, key rotation, audit_log schema and maintenance, deploy checklist |

Use the pre-commit hook so the repo stays clean; use this checklist so runtime and deployment stay secure.

---

## 7. Commit security report (per commit)

Every run of the pre-commit hook produces a **Commit Security Report**:

- **Passed** – Checks that passed (no action).
- **Failed (fix before next deploy)** – Warnings; commit is allowed but you should fix these before deploying.
- **Blocked (must fix to commit)** – Criticals; commit is blocked until fixed.

The report is printed in the terminal and **saved to** `reports/security-commit-report.txt` (or `.last-commit-security-report.txt` if `reports/` cannot be created). The file is overwritten on each run. `reports/` and `.last-commit-security-report.txt` are in `.gitignore` so they are not committed.

**Bypass (use sparingly):** If you must commit despite criticals (e.g. docs-only change), use:

```bash
git commit --no-verify -m "your message"
```

**Never use `--no-verify` to skip secret/credential checks.** Rotate any key that was ever committed.

---

## 8. Rate limiting – CI check (4b)

CI should **fail** until rate limiting is implemented. Run before deploy or in CI:

```bash
node scripts/check-rate-limiting.js
```

- **Fails** until you either:
  - Set env **`RATE_LIMIT_CONFIGURED=true`** in CI (after implementing limits), or
  - Create a marker file **`.rate-limit-configured`** in the project root (and add it to `.gitignore` if you don’t want to commit it).
- **Passes** when one of the above is set.

Required limits: API 100 req/IP/hour; login 10/IP/15 min; password reset 3/email/hour; costly endpoints (e.g. AI) per-user daily cap. See Section 3 and the script output for details.

---

## 9. Other vulnerabilities (protect your site even if not in this hook)

These are important to address in design, code, or infra; the pre-commit hook cannot fully enforce them.

| # | Vulnerability | What to do |
|---|----------------|------------|
| 21 | **CSRF (Cross-Site Request Forgery)** | For state-changing operations use SameSite cookies, CSRF tokens, or double-submit cookie. Supabase uses JWTs in headers (not cookies by default), which reduces CSRF; if you use cookie-based sessions elsewhere, protect them. |
| 22 | **Session fixation** | Don’t accept session IDs from the URL; regenerate session after login. Supabase Auth handles this; if you add custom sessions, rotate the identifier on privilege change. |
| 23 | **Dependency confusion / supply chain** | Use lockfile (`package-lock.json`) and `npm ci` in CI. Pin versions where possible. Run `npm audit` and Dependabot. Pre-commit warns on new deps and typosquats; verify packages on npm before adding. |
| 24 | **Insecure deserialization** | Don’t deserialize untrusted data (e.g. `JSON.parse` of user input that is then passed to eval or to a backend that treats it as code). Validate and sanitize all inputs. |
| 25 | **SSRF (Server-Side Request Forgery)** | If your backend fetches URLs provided by the user, an attacker can point it to internal services (e.g. `http://169.254.169.254/`). Allowlist allowed hosts/schemes; avoid proxying raw user URLs. |
| 26 | **Clickjacking** | Protect sensitive pages with `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'self'` so your app cannot be embedded in an iframe on a malicious site. |
| 27 | **Subdomain takeover** | If you ever point a DNS CNAME to a service you later delete, an attacker can claim that subdomain. Audit DNS records and remove stale CNAMEs. |
| 28 | **IDOR beyond RLS** | RLS protects by `auth.uid()`. If you expose “get by ID” APIs (e.g. `/api/orders/:id`), ensure the server checks that `id` belongs to the current user; don’t rely only on hiding IDs in the UI. |
| 29 | **Insecure direct object reference in Storage** | Same as above: Storage RLS should scope by `auth.uid()` and path; avoid predictable or enumerable object IDs that could allow access to other users’ files. |
| 30 | **Sensitive data in URLs** | Tokens or IDs in query params can leak via Referer, logs, and history. Prefer headers or POST body for tokens; use short-lived tokens for password reset. |
| 31 | **Broken access control on admin actions** | Every admin or privileged action must be gated server-side (RLS, Edge Function, or API) by role/profile. Pre-commit reminds; ensure no admin endpoint is callable without a server-side check. |
| 32 | **Insufficient logging / monitoring** | Log auth failures, role changes, payment events, and data exports to `audit_log`. Monitor for anomalies; alert on repeated failures or bulk exports. |
| 33 | **Missing security headers** | In production use: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options` or CSP `frame-ancestors`, and a restrictive `Content-Security-Policy` where feasible. |
| 34 | **Vendor/third-party risk** | Supabase, Stripe, Vercel, etc. have their own security. Use official SDKs, keep them updated, and follow their security best practices and incident advisories. |

Addressing these in architecture and deployment strengthens your app beyond what the pre-commit hook can enforce.
