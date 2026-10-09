#!/usr/bin/env node
// Start/stop the default local Supabase stack (supabase/config.toml, ports 54320-54329) on Windows, macOS and Linux.
// Replaces scripts/{start,stop,restart}-supabase.ps1 and the matching .sh files.
//
//   node scripts/supabase-local.mjs start     start it unless it is already running, then print `supabase status`
//   node scripts/supabase-local.mjs stop      `supabase stop`
//   node scripts/supabase-local.mjs restart   stop, wait 2 s, start
//   node scripts/supabase-local.mjs status    `supabase status`
//   add --dry-run to print the CLI commands instead of running them
//
// This is NOT the test stack (that is `npm run test:env:up`, scripts/test-env.mjs, ports 55420-55429).
// Uses the repo's Supabase CLI (devDependency, run with node, so no shell and no global install needed).
// Needs Docker running. Never touches the hosted project.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_JS = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const cmd = args.find((a) => !a.startsWith('-'));

/** Run the Supabase CLI. `capture` returns stdout instead of streaming it. */
function supabase(cliArgs, { capture = false } = {}) {
  if (DRY) {
    console.log(`[dry-run] supabase ${cliArgs.join(' ')}`);
    return { status: capture ? 1 : 0, stdout: '' };
  }
  const [bin, binArgs, shell] = existsSync(SUPABASE_JS)
    ? [process.execPath, [SUPABASE_JS, ...cliArgs], false]
    : ['supabase', cliArgs, process.platform === 'win32'];
  const r = spawnSync(bin, binArgs, {
    cwd: ROOT,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell,
  });
  if (r.error) {
    console.error('Could not run the Supabase CLI. Run `npm ci` first.');
    process.exit(1);
  }
  return { status: r.status, stdout: r.stdout ?? '' };
}

/** Running = `supabase status -o env` succeeds and reports an API URL. */
function isRunning() {
  const r = supabase(['status', '-o', 'env'], { capture: true });
  return r.status === 0 && /^API_URL=/m.test(r.stdout);
}

function start() {
  console.log('Checking if Supabase is already running...');
  if (isRunning()) {
    console.log('Supabase is already running!');
    supabase(['status']);
    return;
  }
  console.log('Starting Supabase local instance...');
  if (supabase(['start']).status === 0) {
    console.log('Supabase started successfully!');
    supabase(['status']);
  } else {
    console.error('Failed to start Supabase. Make sure Docker is running and ports are available.');
    process.exit(1);
  }
}

function stop() {
  console.log('Stopping Supabase local instance...');
  supabase(['stop']);
  console.log('Supabase stopped.');
}

switch (cmd) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'restart':
    console.log('Restarting Supabase local instance...');
    stop();
    if (!DRY) await new Promise((r) => setTimeout(r, 2000));
    start();
    break;
  case 'status':
    process.exit(supabase(['status']).status ?? 1);
    break;
  default:
    console.log('Usage: node scripts/supabase-local.mjs <start|stop|restart|status> [--dry-run]');
    process.exit(cmd || !args.some((a) => a === '--help' || a === '-h') ? 1 : 0);
}
