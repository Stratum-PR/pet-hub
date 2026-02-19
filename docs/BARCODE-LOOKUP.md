# Barcode Lookup Setup Guide

This guide explains how barcode lookup works and how to get automatic product data when you scan a barcode that isn’t already in your inventory.

**Free option (no setup):** The app uses **Open Food Facts** first—a free, open database. No API key or account is required. It works well for food and pet products (e.g. pet food, shampoo, treats). Just deploy the Edge Function and use “Scan Barcode”; if the product is in Open Food Facts, the form will auto-fill.

**Optional paid option:** If you add a **Barcode Lookup** API key (see below), the app will also try that service when Open Food Facts doesn’t have the barcode. That can help with non-food items or brands not in Open Food Facts.

---

## Free lookups (no key required)

1. Deploy the Edge Function (see [Step 3](#step-3-deploy-the-barcode-lookup-edge-function)).
2. Use **Scan Barcode** in Inventory. The app will look up the barcode in **Open Food Facts** first.
3. If the product is found there (common for food and many pet products), name, brand, category, and description will be filled in automatically.

You do **not** need to sign up or add any API key for this. If a barcode isn’t in Open Food Facts, you’ll see “Product not found in barcode database” and can enter details manually.

---

## Optional: Add a paid API key for more coverage

## Step 1: Get a Barcode Lookup API key

1. **Open Barcode Lookup**
   - Go to [https://www.barcodelookup.com/](https://www.barcodelookup.com/).

2. **Create an account**
   - Click **Sign Up** (or **Register**) and complete registration.
   - Confirm your email if required.

3. **Get your API key**
   - Log in and open the **API** or **Developer** section (often under your account/dashboard or [barcodelookup.com/api](https://www.barcodelookup.com/api)).
   - Find your **API key** (sometimes called “Key” or “API Key”).
   - Copy the key and keep it somewhere safe (you’ll paste it in Supabase in the next step).
   - Note: Many plans have a free tier with a limited number of lookups per month; check their pricing if you need high volume.

---

## Step 2: Add the API key as a Supabase secret

The API key must be stored as a **Supabase secret**, not in your app’s `.env` or frontend. That way it stays server-side and is never exposed to the browser.

### Option A: Using the Supabase Dashboard (recommended)

1. **Open your project**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
   - Select the project you use for Pet Hub (the one whose URL and anon key are in your app’s env).

2. **Open Edge Function secrets**
   - In the left sidebar, click the **gear icon** (**Project Settings**).
   - In the left menu under “Project Settings,” click **Edge Functions** (or **Secrets** / **Function Secrets**, depending on your dashboard).

3. **Create the secret**
   - Click **Add new secret** (or **New secret**).
   - **Name:** enter exactly:  
     `BARCODE_LOOKUP_API_KEY`  
     (case-sensitive)
   - **Value:** paste the API key you copied from Barcode Lookup.
   - Save/confirm.

### Option B: Using the Supabase CLI

1. **Install and log in** (if you haven’t)
   - Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
   - Log in:  
     `supabase login`

2. **Link your project** (if needed)
   - From your project root:  
     `supabase link --project-ref YOUR_PROJECT_REF`  
   - You can find the project ref in the dashboard URL:  
     `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

3. **Set the secret**
   - Run (replace with your real key):  
     `supabase secrets set BARCODE_LOOKUP_API_KEY=your_actual_api_key_here`
   - Confirm when prompted.

---

## Step 3: Deploy the barcode-lookup Edge Function

The app calls an Edge Function named `barcode-lookup`. It must be deployed to the same Supabase project where you set the secret.

1. **Open a terminal** in your Pet Hub repo root.

2. **Log in and link** (if not already):
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Deploy the function:**
   ```bash
   supabase functions deploy barcode-lookup
   ```

4. **Confirm**
   - When it finishes, the function is live and will use the `BARCODE_LOOKUP_API_KEY` secret you set in Step 2.

---

## Step 4: Test in the app

1. **Refresh your app** (or reopen the Inventory page).
2. **Open Inventory** and click **Scan Barcode**.
3. **Scan a product** (e.g. a common grocery or pet item with a UPC/EAN barcode).
4. **Expected behavior:**
   - If the barcode is **in the database**: the app adds the product with name, category, etc. filled in and shows “Product added from barcode.”
   - If the barcode is **not in the database**: you’ll see “Product not found in barcode database” and the add-product form opens with only the barcode prefilled so you can enter details manually.
   - If you see **“Barcode lookup is not set up”**: only relevant if you expected the paid API; for free lookups, ensure the function is deployed and you’re logged in.

---

## How it works

1. **Open Food Facts (free)** is always tried first. No API key needed. Good for food and pet products.
2. **Barcode Lookup (optional)** is tried only when Open Food Facts doesn’t have the barcode and you’ve set `BARCODE_LOOKUP_API_KEY`.

If neither has the product, you see “Product not found in barcode database” and the add-product form opens with only the barcode prefilled.

---

## Barcode vs SKU conventions

- **Barcode** = UPC/EAN/GTIN (the number on the product). It is the **primary identifier when scanning**: POS, stock adjustments, and inventory counts match by barcode first, then by SKU. Same product worldwide has the same barcode. Optional in the add-product form (leave blank for items without a barcode).
- **SKU** = Your internal code (e.g. `DS-001` or `BC-3017620422003`). Required for every product; used for display, reports, and reorders. You can use any format; for products added from a barcode lookup the app generates `BC-{barcode}` automatically.

---

## Troubleshooting

| What you see | What to do |
|--------------|------------|
| “Product not found in barcode database” | Neither Open Food Facts nor (if set) Barcode Lookup has that barcode. Enter details manually. |
| “Barcode lookup is not set up” | You only see this when the lookup failed and the app tried to show a reason. For free lookups, deploy the function and stay logged in. |
| “Lookup failed” / network errors | Check Supabase status and that the function deployed. Ensure you’re logged in when scanning. |

### Still not getting results after deploying?

1. **Be logged in** – The Edge Function requires a valid Supabase session. If you’re not signed in, it returns 401 and the form opens with only the barcode.
2. **Same Supabase project** – Your app’s `VITE_SUPABASE_URL` (in `.env` or `.env.local`) must be the same project where you ran `supabase functions deploy barcode-lookup`. If the URL points to another project, the function isn’t there.
3. **Test with a known barcode** – Scan or type a barcode that’s in Open Food Facts, e.g. **3017620422003** (Nutella). If that one fills the form, the pipeline works and the issue is that your product isn’t in the database.
4. **Browser DevTools** – In development, open the console (F12 → Console). After a scan you’ll see `[barcode-lookup]` with the response. If `error` is set, that’s the failure reason; if `data.found === false`, the barcode wasn’t found in Open Food Facts (or Barcode Lookup).
5. **Function logs** – In Supabase Dashboard → **Edge Functions** → **barcode-lookup** → **Logs**, check for errors (e.g. auth failure, timeout, or Open Food Facts returning an error).

---

## Summary

- **Free:** Deploy `barcode-lookup` and use Scan Barcode. Open Food Facts is used automatically (no key).
- **Optional paid:** Add `BARCODE_LOOKUP_API_KEY` in Supabase secrets to also try Barcode Lookup when Open Food Facts doesn’t have the product.
