#!/usr/bin/env node
// Grumi's separate local test stack for payments (security review G-12).
//
//   node scripts/test-env.mjs up      start: local Supabase (ports 55420-55429) + ATH Móvil simulator (55430)
//   node scripts/test-env.mjs test    run the payments end-to-end tests against it
//   node scripts/test-env.mjs reset   wipe the test database and re-apply every migration
//   node scripts/test-env.mjs status  show URLs
//   node scripts/test-env.mjs down    stop and remove everything (keeps nothing)
//
// It never touches the hosted project: it runs from its own folder (.test-env/) with project_id "grumi-test",
// so `supabase link`, supabase/config.toml and the default local ports (54320-54329) stay untouched.
// Needs Docker Desktop (or Docker Engine) running, Node 20+, and `npm install` done.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKDIR = join(ROOT, '.test-env');
const WIN = process.platform === 'win32';
const SUPABASE = join(ROOT, 'node_modules', '.bin', WIN ? 'supabase.cmd' : 'supabase');
const COMPOSE_FILE = join(ROOT, 'test-env', 'docker-compose.yml');
// Production schema as of this version is in test-env/supabase/prod-schema-snapshot.sql (bump both together).
const SNAPSHOT_VERSION = '20261007235900';

function run(cmd, args, { capture = false, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', shell: WIN, encoding: 'utf8' });
  if (r.error) {
    console.error(`\n✗ Could not run "${cmd}". ${cmd === 'docker' ? 'Is Docker installed and running?' : 'Did you run npm install?'}`);
    process.exit(1);
  }
  if (r.status !== 0 && !allowFail) {
    if (capture) process.stderr.write(r.stderr ?? '');
    console.error(`\n✗ "${cmd} ${args.join(' ')}" failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
  return r;
}

const supabase = (args, opts) => run(SUPABASE, ['--workdir', WORKDIR, ...args], opts);
const compose = (args, opts) => run('docker', ['compose', '-f', COMPOSE_FILE, ...args], opts);

/** Fresh copy of the test config, every migration and every Edge Function into .test-env/supabase. */
function prepareWorkdir() {
  const sb = join(WORKDIR, 'supabase');
  mkdirSync(sb, { recursive: true });
  for (const d of ['migrations', 'functions']) rmSync(join(sb, d), { recursive: true, force: true });
  cpSync(join(ROOT, 'test-env', 'supabase', 'config.toml'), join(sb, 'config.toml'));
  // The repo's migration history can't be replayed from scratch, so the stack starts from a snapshot of
  // production's schema and applies only repo migrations newer than it.
  mkdirSync(join(sb, 'migrations'), { recursive: true });
  cpSync(join(ROOT, 'test-env', 'supabase', 'prod-schema-snapshot.sql'), join(sb, 'migrations', `${SNAPSHOT_VERSION}_prod_schema_snapshot.sql`));
  for (const f of readdirSync(join(ROOT, 'supabase', 'migrations'))) {
    const version = f.split('_')[0];
    if (f.endsWith('.sql') && /^\d{14}$/.test(version) && version > SNAPSHOT_VERSION) {
      cpSync(join(ROOT, 'supabase', 'migrations', f), join(sb, 'migrations', f));
    }
  }
  cpSync(join(ROOT, 'supabase', 'functions'), join(sb, 'functions'), { recursive: true });
}

function checkDocker() {
  const r = run('docker', ['info', '--format', '{{.ServerVersion}}'], { capture: true, allowFail: true });
  if (r.status !== 0) {
    console.error('✗ Docker is not running. Start Docker Desktop and try again.');
    process.exit(1);
  }
}

/** API URL and keys of the running test stack (from `supabase status -o env`). */
export function stackEnv() {
  const r = supabase(['status', '-o', 'env'], { capture: true, allowFail: true });
  if (r.status !== 0) return null;
  const env = {};
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return {
    apiUrl: env.API_URL,
    anonKey: env.ANON_KEY ?? env.PUBLISHABLE_KEY,
    serviceKey: env.SERVICE_ROLE_KEY ?? env.SECRET_KEY,
    studioUrl: env.STUDIO_URL,
    dbUrl: env.DB_URL,
  };
}

function printStatus() {
  const e = stackEnv();
  if (!e?.apiUrl) {
    console.log('Test stack is not running. Start it with: npm run test:env:up');
    return;
  }
  console.log(`\nGrumi test stack is up (separate from the hosted project):
  API             ${e.apiUrl}
  Studio          ${e.studioUrl ?? 'http://127.0.0.1:55423'}
  Database        ${e.dbUrl ?? 'port 55422 (see: npx supabase --workdir .test-env status)'}
  ATH simulator   http://localhost:55430
Run the payments tests with: npm run test:payments\n`);
}

const cmd = process.argv[2] ?? 'status';
switch (cmd) {
  case 'up': {
    checkDocker();
    prepareWorkdir();
    console.log('▶ Starting the local Supabase test stack (first run downloads images; it can take several minutes)…');
    supabase(['start']);
    console.log('▶ Starting the ATH Móvil simulator…');
    compose(['up', '-d', '--build', '--wait']);
    printStatus();
    break;
  }
  case 'reset': {
    checkDocker();
    prepareWorkdir();
    supabase(['db', 'reset']);
    compose(['restart']);
    printStatus();
    break;
  }
  case 'down': {
    compose(['down', '--remove-orphans'], { allowFail: true });
    if (existsSync(join(WORKDIR, 'supabase', 'config.toml'))) supabase(['stop', '--no-backup'], { allowFail: true });
    console.log('Test stack stopped and removed.');
    break;
  }
  case 'status':
    printStatus();
    break;
  case 'test': {
    const e = stackEnv();
    if (!e?.apiUrl || !e.anonKey || !e.serviceKey) {
      console.error('✗ Test stack is not running. Start it with: npm run test:env:up');
      process.exit(1);
    }
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'test-env-payments.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, TEST_API_URL: e.apiUrl, TEST_ANON_KEY: e.anonKey, TEST_SERVICE_KEY: e.serviceKey, TEST_ATH_SIM_URL: 'http://localhost:55430' },
    });
    process.exit(r.status ?? 1);
  }
  default:
    console.error(`Unknown command "${cmd}". Use: up | test | reset | status | down`);
    process.exit(1);
}
