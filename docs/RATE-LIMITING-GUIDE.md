# How to Add Rate Limiting (Step-by-Step)

Your app uses **Vercel** and talks to **Supabase** from the browser. This guide adds **per-IP rate limiting** so your site and any API routes are protected, and the security CI check can pass.

---

## What you’ll get

| Limit | Scope | Where it applies |
|-------|--------|-------------------|
| **100 requests / hour / IP** | Whole site (page loads + API) | Vercel Edge Middleware |
| **3 password reset / hour / email** | Forgot-password flow | Supabase Edge Function |
| Login / sign-up | Per IP | Supabase dashboard (e.g. 10 / 5 min) |

When a user hits a limit, they see a clear message (see “User-facing messages” below).

---

## Step 1: Create an Upstash Redis database (free)

1. Go to [console.upstash.com](https://console.upstash.com) and sign up (or log in).
2. Click **Create Database**.
3. Name it (e.g. `stratum-rate-limit`), pick a region close to your users, click **Create**.
4. Open the database → **REST API**.
5. Copy:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

Free tier is enough for moderate traffic.

---

## Step 2: Install packages

From the project root:

```bash
npm install @upstash/ratelimit @upstash/redis
```

---

## Step 3: Add environment variables

**Local (`.env` or `.env.local`):**

```env
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

**Vercel:**

1. Project → **Settings** → **Environment Variables**.
2. Add:
   - `UPSTASH_REDIS_REST_URL` = (paste URL)
   - `UPSTASH_REDIS_REST_TOKEN` = (paste token)
3. Choose Production (and Preview if you want limits in preview deploys).

Do **not** commit the token; it’s already in `.gitignore` via `.env*`.

---

## Step 4: Vercel Edge Middleware (nothing to do manually)

You **do not** need to create or edit any middleware yourself. A file named **`middleware.ts`** is already in the **project root** of this repo (next to `vercel.json`).

- As long as that file is **committed and deployed** to Vercel, it will run automatically on every request to your site.
- It uses the client IP, allows **100 requests per hour per IP**, and returns **429** when over the limit. Static assets (images, JS, CSS) are skipped so they don’t count.
- If the Upstash env vars are missing (e.g. local dev), the middleware does nothing and the app still works.

**Check:** In your repo root you should see `middleware.ts`. If it’s there and you’ve pushed to Vercel, you’re done for this step.

---

## Step 5: Mark rate limiting as configured (so CI passes)

The script `scripts/check-rate-limiting.js` only passes when it knows rate limiting is in place. Do **one** of the following.

**Option A – Vercel env (recommended, no new file)**  
1. In Vercel: open your project → **Settings** → **Environment Variables**.  
2. Click **Add New**.  
3. **Name:** `RATE_LIMIT_CONFIGURED`  
4. **Value:** `true`  
5. Select **Production** (and **Preview** if you run the check on preview builds).  
6. Save. Redeploy once so the new variable is available.

**Option B – Marker file (simplest: works in CI and locally)**  
- In the project root, create a file named `.rate-limit-configured` (can be empty, or one line: `rate limiting configured`).  
- Commit it. The script `scripts/check-rate-limiting.js` passes if it finds this file **or** the env var.  
- If you prefer not to commit it, add `.rate-limit-configured` to `.gitignore` and use Option A in whichever environment runs the check (e.g. Vercel or GitHub Actions).

**How to confirm Step 5:** Run `node scripts/check-rate-limiting.js`. It should print “Rate limiting marked as configured. CI check passed.” and exit with code 0.

---

## Auth-specific limits: what Supabase can and can’t do

Your security checklist asks for:

- **Login:** e.g. 10 attempts per IP per 15 minutes  
- **Password reset:** e.g. 3 requests per email per hour  

**What Supabase can do (dashboard rate limits):**  
- **Login / sign-up:** Yes. In Authentication → Rate Limits you can set “Sign-ups and sign-ins” to **10 per 5 minutes per IP**. That’s stricter than “10 per 15 min” and is applied by Supabase; no custom code needed.  
- **Token verification (OTP / magic link):** Yes. Same dashboard: “Token verifications” per 5 min per IP.  
- **Emails (e.g. password reset):** Only **project-wide**. You get one limit like “30 emails per hour” for the whole project. Supabase does **not** offer “3 per email per hour” in the dashboard; it doesn’t rate limit by recipient email.

**So:**  
- **Stricter login limits** → Use Supabase. Set “Sign-ups and sign-ins” to 10 per 5 min per IP (or whatever you prefer). Done.  
- **Stricter password-reset “per email”** → Not possible in Supabase alone. To get “3 per email per hour” you’d need your own API (e.g. Vercel serverless) that checks a counter per email (e.g. with Upstash keyed by `reset:${email}`) before calling Supabase’s “send reset” (or the client calls your API, which then calls Supabase). For low cost, many apps just rely on Supabase’s **project-wide** email limit (e.g. 30/h) and accept that one abusive actor could theoretically trigger up to 30 resets in an hour across different emails.

**Implemented:** This repo includes a **Supabase Edge Function** `rate-limited-reset-password` that enforces **3 requests per email per hour**. The Login page “Forgot password?” flow calls it. Deploy the function and set its secrets (see “Password reset Edge Function” below).

---

## How to test the site rate limit (100/hour)

**Option 1 – Script (recommended)**  
From the project root, run:

```bash
SITE_URL=https://your-production-site.vercel.app node scripts/test-rate-limit.js
```

Or with explicit URL and request count:

```bash
node scripts/test-rate-limit.js https://your-production-site.vercel.app 105
```

The script fetches your site repeatedly. After 100 requests in the current window, the next request should return **429**. The script prints when it gets 429 and exits. Use your real Vercel URL (e.g. `https://stratum-hub.vercel.app`).

**Option 2 – Manual**  
Open your site in a browser, then open DevTools → Console and run:

```javascript
let n = 0;
const url = location.origin + '/';
async function hit() {
  const r = await fetch(url);
  n++;
  if (r.status === 429) { console.log('429 at request', n); return; }
  if (n % 20 === 0) console.log(n, r.status);
  if (n < 105) setTimeout(hit, 200);
}
hit();
```

After about 100 requests you should see **429 at request 101** (or shortly after). The middleware returns an HTML page that says “Too many requests” and “Please wait 1 hour.”

---

## User-facing messages (what users see when limited)

| Limit | When they hit it | Message they see |
|-------|-------------------|-------------------|
| **Site (100/hour per IP)** | They load too many pages in an hour | A full page: “Too many requests. Too many requests from your network. Please wait **1 hour**, then try again.” with a link to home. |
| **Password reset (3/hour per email)** | They request a reset for the same email more than 3 times in an hour | In the “Forgot password?” dialog: “Too many reset requests for this email. Please try again in **1 hour**.” |

All limits are per **sliding** or **fixed** window (1 hour); we tell users to wait 1 hour so the limit can reset.

---

## Password reset Edge Function (3 per email per hour)

The function lives at **`supabase/functions/rate-limited-reset-password/index.ts`**. It uses Upstash Redis to count requests per email and calls Supabase Auth to send the reset email.

**Deploy (after linking your project):**

```bash
supabase functions deploy rate-limited-reset-password
```

**Secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets, or CLI):**

- `UPSTASH_REDIS_REST_URL` – same as in Vercel  
- `UPSTASH_REDIS_REST_TOKEN` – same as in Vercel  
- `SUPABASE_ANON_KEY` – your project’s anon key (so the function can call Auth)  
- `SUPABASE_URL` (optional) – your project URL, e.g. `https://xxxx.supabase.co` (can be derived from the request if omitted)

**Cost:** Supabase Edge Functions have a free tier; with low traffic, this stays free. Same Upstash Redis as the Vercel middleware.

---

## Summary checklist

- [ ] Upstash Redis created; URL and token copied.
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel (and in `.env.local` for local dev if you want middleware to run).
- [ ] `middleware.ts` at project root (already in this repo); deploy to Vercel.
- [ ] Test site limit: `SITE_URL=https://yoursite.vercel.app node scripts/test-rate-limit.js` (see “How to test” above).
- [ ] Deploy Edge Function: `supabase functions deploy rate-limited-reset-password` and set secrets (Upstash URL/token, `SUPABASE_ANON_KEY`, optional `SUPABASE_URL`).
- [ ] Set `RATE_LIMIT_CONFIGURED=true` in CI or create `.rate-limit-configured` so `node scripts/check-rate-limiting.js` passes.

---

## Supabase rate limits vs Upstash (is it duplicate?)

**Short answer: no.** They limit different things.

| What’s limited | Who limits it | Your setup |
|----------------|----------------|------------|
| **Requests to your website** (page loads, navigations) | Vercel + Upstash middleware | 100 requests/hour per IP to your Vercel domain. Supabase does **not** see these. |
| **Requests to Supabase** (auth, database, storage) | Supabase | Your dashboard limits (e.g. sign-in, token refresh, emails). |

So: **Supabase** limits its own API (auth, DB, storage). **Upstash middleware** limits traffic **to your app** on Vercel. Both are useful; they’re not duplicate.

**Your Supabase limits (from the screenshot):**  
- **Sign-ups and sign-ins:** 10 per 5 min per IP → good (matches “10 login attempts per 15 min” and is strict).  
- **Token verification (OTP/magic link):** 10 per 5 min per IP → fine.  
- **Token refresh:** 150 per 5 min per IP → plenty.  
- **Emails:** 30 per hour for the **whole project** (not per email). So password reset is capped at 30 emails/hour total. The security checklist’s “3 per email per hour” would need extra logic (e.g. an API that rate-limits by email with Upstash); for low cost, 30/h project-wide is a reasonable default.  
- **Anonymous sign-ins:** 30/h per IP → fine if you use anonymous auth.

**Recommendation:** Keep your current Supabase rate limits as they are. They’re sufficient for auth. Use Upstash middleware for “general API” style protection (100 req/hour per IP) on your **site**. No need to remove Upstash; it complements Supabase.

---

## What are Vercel Edge and Serverless? Do I need them?

**Edge (what you’re already using)**  
- Your **`middleware.ts`** runs on Vercel’s **Edge**: a lightweight layer that runs before the request hits your app.  
- It’s included in normal Vercel usage; you don’t pay extra for it.  
- You don’t need to “add” Edge separately; the middleware **is** Edge.

**Serverless (API routes / functions)**  
- A **serverless function** is a small backend (e.g. `https://yoursite.com/api/...`) that runs only when something calls it.  
- You do **not** need it for the rate limiting we set up. The middleware handles “100 req/hour per IP” for your site.  
- You’d only add a serverless function if you later want things like: a proxy that enforces “3 password reset per email per hour” (by calling Supabase after checking Upstash by email), or an “OpenAI dashboard” endpoint with “50 requests per user per day.” For now, **skip serverless** to keep things simple and low cost.

**Summary:** Edge = your existing middleware (no extra cost). Serverless = optional later, not required for current rate limiting.
