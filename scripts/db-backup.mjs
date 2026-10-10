#!/usr/bin/env node
// Full backup of a Grumi Supabase database (schema + data + what `supabase db dump` leaves out).
// Read-only against the source. Restore-test every backup with scripts/db-restore-check.mjs.
//
//   PowerShell:  $env:GRUMI_DB_URL = "<Session pooler connection string>"; node scripts/db-backup.mjs
//
// GRUMI_DB_URL  Postgres connection string of the database to back up. For production use the
//               "Session pooler" string from Dashboard → Connect (the direct host is IPv6-only).
//               It is read from the environment and never printed or written to the backup.
// GRUMI_BACKUP_DIR  Where backups go (default: <home>/grumi-backups). Must be outside the repo.
//
// Output: <GRUMI_BACKUP_DIR>/<UTC timestamp>/
//   roles.sql, schema.sql, data.sql   supabase db dump (data excludes storage vector tables; postgres can't restore them)
//   extras.sql                       migration history, auth/storage triggers and policies, exact API privileges
//   fingerprint.txt                  comparable summary used by db-restore-check.mjs
//   manifest.json                    timestamps, tool versions, sha256 of every file
// Needs Docker running (the CLI runs pg_dump in a container; psql runs in the same image).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// The CLI's own launcher, run with node and no shell, so the connection string is never parsed by cmd.exe.
const SUPABASE_JS = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const PG_IMAGE_REPO = 'public.ecr.aws/supabase/postgres';
const DATA_EXCLUDE = 'storage.buckets_vectors,storage.vector_indexes';

const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const dbUrl = process.env.GRUMI_DB_URL;
if (!dbUrl) fail('Set GRUMI_DB_URL to the connection string of the database to back up.');
let parsed;
try {
  parsed = new URL(dbUrl);
} catch {
  fail('GRUMI_DB_URL is not a valid postgres:// connection string (percent-encode special characters in the password).');
}
const host = parsed.hostname;
const isLocal = ['127.0.0.1', 'localhost'].includes(host);
const sourceLabel = `${host}:${parsed.port || 5432}${parsed.pathname}`; // never includes the password

const backupRoot = resolve(process.env.GRUMI_BACKUP_DIR || join(homedir(), 'grumi-backups'));
const rel = relative(ROOT, backupRoot);
if (!rel.startsWith('..') && !isAbsolute(rel)) fail(`Backups must be stored outside the repository (got ${backupRoot}).`);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(backupRoot, stamp);
mkdirSync(out, { recursive: true });

function run(cmd, args, { env, quiet = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.error) fail(`Could not run ${cmd}: ${r.error.message}`);
  const stderr = (r.stderr ?? '').split(/\r?\n/).filter((l) => l && !/new version of Supabase CLI|recommend updating/i.test(l));
  if (r.status !== 0) fail(`${cmd === process.execPath ? 'supabase' : cmd} ${cmd === process.execPath ? args[1] : args[0]} failed (exit ${r.status}):\n${stderr.join('\n').replaceAll(dbUrl, '<GRUMI_DB_URL>')}`);
  if (!quiet && stderr.length) console.log(stderr.map((l) => `    ${l}`).join('\n').replaceAll(dbUrl, '<GRUMI_DB_URL>'));
  return r.stdout;
}

/** psql in the Supabase postgres image, read-only session. The URL is passed by name, never on the command line. */
function psqlFile(image, file) {
  const url = isLocal ? dbUrl.replace(host, 'host.docker.internal') : dbUrl;
  return run('docker', [
    'run', '--rm',
    '-e', 'GRUMI_DB_URL',
    '-e', 'PGOPTIONS=-c default_transaction_read_only=on',
    '-v', `${join(ROOT, 'scripts', 'db-backup')}:/q:ro`,
    '--entrypoint', 'sh', image,
    '-c', `psql "$GRUMI_DB_URL" -X -q -v ON_ERROR_STOP=1 -f /q/${file}`,
  ], { env: { GRUMI_DB_URL: url }, quiet: true });
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

console.log(`\nBacking up ${sourceLabel} → ${out}\n`);
const dump = (args, file, label) => {
  console.log(`▶ ${label}`);
  run(process.execPath, [SUPABASE_JS, 'db', 'dump', '--db-url', dbUrl, '-f', join(out, file), ...args]);
};
dump(['--role-only'], 'roles.sql', 'roles');
dump([], 'schema.sql', 'schema');
dump(['--data-only', '--use-copy', '-x', DATA_EXCLUDE], 'data.sql', 'data (circular foreign-key warnings are expected; the restore disables triggers)');

const tag = run('docker', ['image', 'ls', PG_IMAGE_REPO, '--format', '{{.Tag}}'], { quiet: true })
  .split(/\r?\n/).filter(Boolean).sort().pop();
if (!tag) fail(`No ${PG_IMAGE_REPO} image found; the dumps above should have pulled one.`);
const image = `${PG_IMAGE_REPO}:${tag}`;

console.log('▶ extras (migration history, auth/storage triggers + policies, API privileges)');
writeFileSync(join(out, 'extras.sql'), psqlFile(image, 'capture-extras.sql'));
console.log('▶ fingerprint');
writeFileSync(join(out, 'fingerprint.txt'), psqlFile(image, 'fingerprint.sql'));

const files = ['roles.sql', 'schema.sql', 'data.sql', 'extras.sql', 'fingerprint.txt'];
const manifest = {
  createdAt: new Date().toISOString(),
  source: sourceLabel,
  supabaseCli: run(process.execPath, [SUPABASE_JS, '--version'], { quiet: true }).trim(),
  postgresImage: image,
  gitCommit: run('git', ['rev-parse', 'HEAD'], { quiet: true }).trim(),
  dataExcluded: DATA_EXCLUDE.split(','),
  notIncluded: ['storage file contents (only their metadata rows)', 'Edge Function secrets', 'Auth/project settings', 'Vault secrets'],
  files: Object.fromEntries(files.map((f) => [f, sha256(join(out, f))])),
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const fp = readFileSync(join(out, 'fingerprint.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
const rows = fp.filter((l) => l.startsWith('rows|')).reduce((n, l) => n + Number(l.split('|')[2] || 0), 0);
console.log(`\n✓ Backup complete: ${out}`);
console.log(`  ${fp.filter((l) => l.startsWith('schema|')).length} schema checks, ${rows} rows across ${fp.filter((l) => l.startsWith('rows|')).length} tables`);
console.log(`  Backup ID for FIX_LOG: ${stamp}`);
console.log(`  Next: node scripts/db-restore-check.mjs "${out}"\n`);
