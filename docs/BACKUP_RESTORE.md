# Backup and restore (Grumi production database)

The free plan has no downloadable backups, so we take our own **before every production database or Edge Function change** (REMEDIATION_PLAN §9, rule 5). A person runs these steps; agent sessions never connect to production.

Rehearsed end to end on the local stacks on 2026-10-08 (P0-04): backup → restore into an empty project → **0 differences** in schema, policies, triggers, privileges, migration history and realtime publication, all rows equal, storage files byte-identical, and the restored copy works through the API (signup creates a profile, the P0-01 lock blocks a takeover).

## What a backup contains

| File | Contents |
|---|---|
| `roles.sql` · `schema.sql` · `data.sql` | `supabase db dump` of roles, the `public` schema, and data from `public`, `auth` (users, identities…) and `storage` (bucket and object **metadata**) |
| `extras.sql` | What `db dump` leaves out, captured read-only by `scripts/db-backup/capture-extras.sql`: migration history, app triggers on `auth.users` (`handle_new_user`…), storage/auth RLS policies (bucket policies), and the exact API privileges on every `public` function/table |
| `fingerprint.txt` | A comparable summary (object counts and hashes, privileges, row counts) used to verify a restore |
| `manifest.json` | Time, source host (no password), CLI and image versions, git commit, sha256 of every file |
| `files/<bucket>/…` | Storage file contents (separate step below) |

**Not included:** Edge Function secrets, Auth and project settings (dashboard), Vault secrets, Edge Function code (it's in git). Write the settings down in P0-03.

Why `extras.sql` exists (each one found by the rehearsal): without it a restore loses the `auth.users` triggers (new signups get no profile), the migration history, the bucket policies, and **re-opens `set_profile_business_id` to the API**, because a fresh project's default privileges grant every new function to `anon`/`authenticated`.

## Where backups live

A backup holds every customer's data and the users' password hashes. Keep it:
- **outside the repo** (the script refuses a folder inside it) — default `%USERPROFILE%\grumi-backups\<UTC timestamp>`;
- on an encrypted disk (BitLocker) or in an encrypted archive; never in a shared Drive folder, chat or email;
- at least the last 5, and the one taken before each change listed in `docs/FIX_LOG.md`.

## Take a backup

Prerequisites: Docker Desktop running, `npm ci` done, and for the file copy `npx supabase login` once.

1. Dashboard → **Connect** → copy the **Session pooler** connection string (port 5432; the direct host is IPv6-only and the transaction pooler on 6543 can't run `pg_dump`). Put your DB password in it; percent-encode special characters (`@` → `%40`, `#` → `%23`, `%` → `%25`).
2. In PowerShell, from the repo root (the variable lives only in this window; don't paste it anywhere else):
   ```powershell
   $env:GRUMI_DB_URL = "<session pooler connection string>"
   node scripts/db-backup.mjs
   ```
   It prints the backup folder and a **backup ID** (the timestamp). The circular foreign-key warnings during the data dump are expected.
3. Storage files. List the buckets, then copy each one into the backup folder (run from inside the folder: the CLI rejects absolute Windows paths as the destination):
   ```powershell
   $cli = "$PWD\node_modules\supabase\dist\supabase.js"   # run this line from the repo root
   cd "$env:USERPROFILE\grumi-backups\<backup ID>"
   node $cli storage ls ss:/// --project-ref <project ref> --experimental
   node $cli storage cp -r ss:///<bucket> files --project-ref <project ref> --experimental
   ```
   Buckets the app uses today include `business-logos`, `product-photos`, pet photos and staff photos; copy every bucket `ls` shows. (Rehearsed with `--local`; `--project-ref` is the same command against the hosted project.)
4. Prove it restores (local only, takes ~2 minutes):
   ```powershell
   node scripts/db-restore-check.mjs "$env:USERPROFILE\grumi-backups\<backup ID>"
   ```
   It must end with `✓ Restore works`. Row-count differences (`~`) are fine on a live database; any `✗` means don't rely on the backup.
5. `Remove-Item Env:GRUMI_DB_URL`, and write the backup ID in the FIX_LOG entry of the change you're about to apply.

## Restore

Decide first which situation you're in; both start from a local restored copy:
```powershell
node scripts/db-restore-check.mjs "<backup folder>" --keep
```
This leaves the restored database running locally (Studio `http://127.0.0.1:55523`, DB `postgresql://postgres:postgres@127.0.0.1:55522/postgres`).

**A. Some data is wrong or missing (most likely).** Compare the affected rows in the local copy with production and copy back only those rows (Studio export → SQL editor, or `COPY` in psql). Take a fresh backup of production first, so the repair itself can be undone.

**B. The database is lost or unusable.** Restore everything into an **empty** Supabase project (a new one; restoring over a database that still has tables fails or duplicates data). With its Session pooler string in `$env:TARGET_DB_URL`, from the backup folder:
```powershell
Select-String -NotMatch '^GRANT SET ON PARAMETER ' roles.sql | ForEach-Object Line | Set-Content -Encoding utf8 roles.restore.sql
docker run --rm -e TARGET_DB_URL -v "${PWD}:/b" --entrypoint psql public.ecr.aws/supabase/postgres:<postgresImage tag from manifest.json> "$env:TARGET_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f /b/roles.restore.sql -f /b/schema.sql -c "SET session_replication_role = replica" -f /b/data.sql -c "SET session_replication_role = origin" -f /b/extras.sql
```
(The `GRANT SET ON PARAMETER` line is a Supabase-managed grant every project already has; only a superuser may run it.) These are the same steps `db-restore-check.mjs` runs locally. Then upload the files (`supabase storage cp -r files/<bucket> ss:/// --project-ref <new ref> --experimental`), re-enter the Edge Function secrets and Auth settings from P0-03, deploy the Edge Functions, and point Vercel's `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` at the new project. Users keep their passwords (the hashes are in `auth.users`) but must sign in again.

## Notes

- `pg_dump` takes one snapshot per file, so a backup of a live database can be a few seconds inconsistent between `schema`, `data` and `extras`. Take backups at a quiet time.
- The restore check uses ports 55520-55529 (project `grumi-restore`), separate from the test stack (55420-55429) and Mezza.
- `extras.sql` grants are generated per object, so new locked-down functions (P2) are covered automatically. Column-level grants are included too.
