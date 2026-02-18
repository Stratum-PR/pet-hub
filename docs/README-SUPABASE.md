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
- **Supabase API**: Port 54321 (default)
- **Supabase DB**: Port 54322 (default)
- **Supabase Studio**: Port 54323 (default)

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

### Signup timeout (504) – "El servidor tardó demasiado"

If **Crear cuenta** takes ~30+ seconds and then shows a timeout and **no user or profile is created**:

1. **Disable email confirmation** (reduces work Auth does during signup):
   - Supabase Dashboard → **Authentication** → **Providers** → **Email**
   - Turn **off** "Confirm email"
   - Signup will return a session immediately and avoid waiting on the confirmation email.

2. **Apply the profile-insert fix** so the trigger doesn't block:
   - Run the migration `supabase/migrations/20260203100000_fix_profile_insert_trigger.sql` (or `npx supabase db push`) so the trigger can insert into `profiles` when `auth.uid()` is null.

3. **Use "Reintentar"** on the Registrarse page after a timeout; the form keeps your data.

4. **Hosted Supabase**: Check project health/region and that the database isn't overloaded; timeouts can also be due to cold starts or slow DB.

## Notes

- The `start-supabase` script automatically checks if Supabase is already running before starting
- This prevents the "too many ports in use" error
- Always use `npm run supabase:stop` before closing your terminal to clean up resources
