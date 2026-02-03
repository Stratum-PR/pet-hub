# Supabase Local Development Guide

## Quick Start

### Start Supabase (checks if already running)
```bash
npm run supabase:start
```

### Stop Supabase
```bash
npm run supabase:stop
```

### Restart Supabase
```bash
npm run supabase:restart
```

### Check Status
```bash
npm run supabase:status
```

## Manual Commands

If you prefer to use Supabase CLI directly:

```bash
# Start Supabase (will fail if already running)
supabase start

# Stop Supabase
supabase stop

# Check status
supabase status
```

## Port Configuration

- **Vite Dev Server**: Port 8080 (configured in `vite.config.ts`)

### Supabase Auth redirect URL (OAuth / PKCE)

For Google/Microsoft login to work locally, add this **exact** redirect URL in Supabase:

**Dashboard → Authentication → URL Configuration → Redirect URLs**

- `http://localhost:8080/auth/callback` (or your app’s OAuth callback path)
- `http://localhost:8080/reset-password` (for “Forgot password” flow; add your production URL too, e.g. `https://yourdomain.com/reset-password`)

Your app runs at `http://localhost:8080`, so the OAuth callback must use 8080. If you had 5173 or 3000 there before, replace or add 8080.
- **Supabase API**: Port 54321 (default)
- **Supabase DB**: Port 54322 (default)
- **Supabase Studio**: Port 54323 (default)

## Environment variables

Use a `.env` or `.env.local` file in the project root:

- `VITE_SUPABASE_URL` – your project URL (e.g. `https://xxxx.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` – the **anon/public** key from the **same project** as the URL

If you see **"Invalid API key"** when signing up or logging in, the URL and key are from different projects. In Supabase Dashboard → Project Settings → API, copy the **Project URL** and **anon public** key from the same project and update `.env`.

## Troubleshooting

### "Too many ports in use" Error

If you get this error, it means Supabase is already running or there are leftover processes:

1. **Stop existing instances:**
   ```bash
   npm run supabase:stop
   ```

2. **Or manually:**
   ```bash
   supabase stop
   ```

3. **Kill any remaining processes (Windows PowerShell):**
   ```powershell
   Get-Process | Where-Object { $_.ProcessName -like "*supabase*" -or $_.ProcessName -like "*postgres*" } | Stop-Process -Force
   ```

4. **Kill any remaining processes (Linux/Mac):**
   ```bash
   pkill -f supabase
   pkill -f postgres
   ```

5. **Then start fresh:**
   ```bash
   npm run supabase:start
   ```

### Port 8080 Already in Use

If port 8080 is already in use by another application:

1. **Find what's using port 8080 (Windows):**
   ```powershell
   netstat -ano | findstr :8080
   ```

2. **Find what's using port 8080 (Linux/Mac):**
   ```bash
   lsof -i :8080
   ```

3. **Kill the process or change Vite port in `vite.config.ts`**

## Security (Dashboard)

### Leaked password protection

Supabase Auth can check new passwords against [HaveIBeenPwned](https://haveibeenpwned.com/) to block compromised passwords.

**Where to find it:** **Dashboard** → **Authentication** → **Providers** → open **Email**. The password strength options (minimum length, required characters, **Prevent the use of leaked passwords**) are on that Email provider page.

**If you don’t see it:** Leaked password protection is only available on the **Pro Plan and above**. On the Free plan the option is not shown, so the Supabase linter warning for “Leaked password protection disabled” will stay until you upgrade. You can still use the other password strength settings (minimum length, required character types) on Free.

## Supabase extension in Cursor / VS Code

The [Supabase extension](https://marketplace.visualstudio.com/items?itemName=Supabase.vscode-supabase-extension) lets you inspect and edit your database (tables, views, migrations, storage) from the editor.

### 1. Requirements

- **Supabase CLI** – You already have it as a dev dependency. Use it via:
  ```bash
  npx supabase
  ```
  Or [install the CLI globally](https://supabase.com/docs/guides/cli/getting-started) so the extension can find it on your PATH.
- **Docker Desktop** – Required for running Supabase locally (start/stop scripts use it).
- **Local Supabase running** – The extension talks to your **local** instance, not the cloud dashboard.

### 2. One-time setup

1. **Open this project in Cursor** with the repo root as the workspace (so the `supabase/` folder is visible).
2. **Start local Supabase** (in a terminal from the project root):
   ```bash
   npm run supabase:start
   ```
3. **Optional – link your cloud project** (to pull schema or sync):
   ```bash
   npx supabase link
   ```
   When prompted, choose your project (or enter the project ref). Your `supabase/config.toml` already has a `project_id`; if you use a different project, run `supabase link` and pick it.
4. **Optional – pull latest schema from cloud** (if linked):
   ```bash
   npx supabase db pull
   ```

### 3. Using the extension

1. **Supabase sidebar** – Open the Supabase view in the Activity Bar (Supabase icon).
2. **Inspect database** – Once Supabase is running, you can:
   - **Tables & views** – Expand and see columns, types, and data.
   - **Migrations** – See migration history under `supabase/migrations/`.
   - **Functions** – List and inspect database functions.
   - **Storage** – List buckets.
3. **Run Supabase only when needed** – Use `npm run supabase:start` before using the extension, and `npm run supabase:stop` when you’re done to free ports.

### 4. If the extension doesn’t see your project

- Ensure the **workspace root** is the folder that contains `supabase/` (this repo root).
- Ensure **Supabase is running**: run `npm run supabase:status`; you should see API URL, DB URL, Studio URL.
- If the extension still can’t find the CLI, install it globally: `npm install -g supabase` (or use the [official install guide](https://supabase.com/docs/guides/cli/getting-started)), then restart Cursor.

## Notes

- The `start-supabase` script automatically checks if Supabase is already running before starting
- This prevents the "too many ports in use" error
- Always use `npm run supabase:stop` before closing your terminal to clean up resources
