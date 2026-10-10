#!/usr/bin/env node
// Proves a backup from scripts/db-backup.mjs can be restored: restores it into a throwaway LOCAL Supabase
// stack (project "grumi-restore", ports 55520-55529) and compares the result with the backup's fingerprint.
// It takes no connection string and only talks to its own local container, so it can't touch production.
//
//   node scripts/db-restore-check.mjs <backup folder> [--keep]
//
// --keep leaves the restored stack running (Studio: http://127.0.0.1:55523) for a look around; stop it with
//   npx supabase --workdir <printed workdir> stop --no-backup
// The real restore into a hosted project follows the same steps by hand: see docs/BACKUP_RESTORE.md.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_JS = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const PROJECT = 'grumi-restore';
const CONTAINER = `supabase_db_${PROJECT}`;
const WORKDIR = join(tmpdir(), 'grumi-restore-check');
const FILES = ['roles.sql', 'schema.sql', 'data.sql', 'extras.sql', 'fingerprint.txt'];

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const dirArg = args.find((a) => !a.startsWith('--'));
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
if (!dirArg) fail('Usage: node scripts/db-restore-check.mjs <backup folder> [--keep]');
const backup = resolve(dirArg);

function run(cmd, cmdArgs, { allowFail = false, input } = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) fail(`Could not run ${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) fail(`${cmd} ${cmdArgs.slice(0, 3).join(' ')} failed (exit ${r.status}):\n${r.stderr}`);
  return r;
}
const supabase = (a, o) => run(process.execPath, [SUPABASE_JS, '--workdir', WORKDIR, ...a], o);
const dockerEnv = { MSYS_NO_PATHCONV: '1' };
const docker = (a, o) => {
  Object.assign(process.env, dockerEnv);
  return run('docker', a, o);
};

// 1. The backup is complete and unmodified.
const manifestPath = join(backup, 'manifest.json');
if (!existsSync(manifestPath)) fail(`${backup} has no manifest.json; is it a db-backup.mjs folder?`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const f of FILES) {
  const p = join(backup, f);
  if (!existsSync(p)) fail(`Missing ${f}`);
  const sum = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (sum !== manifest.files[f]) fail(`${f} does not match its checksum in manifest.json (file changed or corrupted).`);
}
console.log(`\nRestore check of backup ${manifest.createdAt} from ${manifest.source}`);
console.log('  ✓ all files present, checksums match');

// 2. A fresh, empty local stack: the test stack's config with its own name and ports, no Edge Functions.
mkdirSync(join(WORKDIR, 'supabase'), { recursive: true });
const config = readFileSync(join(ROOT, 'test-env', 'supabase', 'config.toml'), 'utf8')
  .replace(/^project_id = ".*"$/m, `project_id = "${PROJECT}"`)
  .replace(/^((?:shadow_|inspector_)?port\s*=\s*)554(\d\d)\s*$/gm, '$1555$2')
  .replace(/^\[functions\.[^\]]+\][^[]*/gm, '')
  .replace(/(\[edge_runtime\]\s*\nenabled\s*=\s*)true/, '$1false');
if (/5542\d/.test(config.replace(/^#.*$/gm, ''))) fail('Restore config still uses test-stack ports; refusing to start.');
writeFileSync(join(WORKDIR, 'supabase', 'config.toml'), config);
console.log(`▶ Starting an empty local stack "${PROJECT}" (workdir ${WORKDIR})…`);
supabase(['stop', '--no-backup'], { allowFail: true });
supabase(['start']);

// 3. Restore in one transaction: roles, schema, data (triggers/FK checks off while loading), then extras.
for (const f of ['schema.sql', 'data.sql', 'extras.sql']) docker(['cp', join(backup, f), `${CONTAINER}:/tmp/${f}`]);
// Supabase-managed parameter grants already exist on every project and only a superuser may re-run them.
const roles = readFileSync(join(backup, 'roles.sql'), 'utf8').split(/\r?\n/).filter((l) => !/^GRANT SET ON PARAMETER /.test(l)).join('\n');
writeFileSync(join(WORKDIR, 'roles.restore.sql'), roles);
docker(['cp', join(WORKDIR, 'roles.restore.sql'), `${CONTAINER}:/tmp/roles.restore.sql`]);
console.log('▶ Restoring roles → schema → data → extras (single transaction)…');
const r = docker(['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-q', '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
  '-f', '/tmp/roles.restore.sql', '-f', '/tmp/schema.sql',
  '-c', 'SET session_replication_role = replica', '-f', '/tmp/data.sql',
  '-c', 'SET session_replication_role = origin', '-f', '/tmp/extras.sql'], { allowFail: true });
const errors = (r.stderr ?? '').split(/\r?\n/).filter((l) => /ERROR|FATAL/.test(l));
if (r.status !== 0) fail(`Restore failed and was rolled back:\n${errors.join('\n') || r.stderr}`);
console.log('  ✓ restore committed');

// 4. Compare with the source's fingerprint.
docker(['cp', join(ROOT, 'scripts', 'db-backup', 'fingerprint.sql'), `${CONTAINER}:/tmp/fingerprint.sql`]);
const fp = docker(['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/fingerprint.sql']).stdout;
const toMap = (text) => new Map(text.split(/\r?\n/).filter(Boolean).map((l) => {
  const [section, item, ...v] = l.split('|');
  return [`${section}|${item}`, v.join('|')];
}));
const want = toMap(readFileSync(join(backup, 'fingerprint.txt'), 'utf8'));
const got = toMap(fp);
let mismatches = 0;
let rowDiffs = 0;
for (const [key, value] of want) {
  const actual = got.get(key);
  if (actual === value) continue;
  if (key.startsWith('rows|')) {
    rowDiffs++;
    console.log(`  ~ ${key}: source ${value}, restored ${actual ?? 'missing'}`);
  } else {
    mismatches++;
    console.log(`  ✗ ${key}: source ${value}, restored ${actual ?? 'missing'}`);
  }
}
for (const key of got.keys()) {
  if (!want.has(key) && !key.startsWith('rows|')) {
    mismatches++;
    console.log(`  ✗ ${key}: not in source, restored ${got.get(key)}`);
  }
}
const totalRows = [...want].filter(([k]) => k.startsWith('rows|')).reduce((n, [, v]) => n + Number(v), 0);
console.log(`  ${mismatches ? '✗' : '✓'} schema, policies, triggers, privileges, migration history: ${mismatches} difference(s)`);
console.log(`  ${rowDiffs ? '~' : '✓'} rows: ${totalRows} across ${[...want.keys()].filter((k) => k.startsWith('rows|')).length} tables, ${rowDiffs} table(s) differ`);

if (!keep) {
  supabase(['stop', '--no-backup'], { allowFail: true });
  console.log('  (restore stack stopped and removed)');
} else {
  console.log(`  Restore stack left running: Studio http://127.0.0.1:55523 · stop: npx supabase --workdir "${WORKDIR}" stop --no-backup`);
}
if (mismatches) fail('Restored database does not match the backup. Do not rely on this backup until fixed.');
console.log(rowDiffs
  ? '\n✓ Restore works. Some row counts differ: expected only if the source was being written to during the backup.\n'
  : '\n✓ Restore works and matches the source exactly.\n');
