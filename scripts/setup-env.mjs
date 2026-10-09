#!/usr/bin/env node
// Create .env.local for `npm run dev` (Windows, macOS, Linux). Replaces scripts/setup-env.ps1.
//
//   node scripts/setup-env.mjs                 write <repo>/.env.local
//   node scripts/setup-env.mjs --out <file>    write somewhere else (e.g. to try it out)
//
// Never overwrites an existing file. If the default local Supabase stack (`npm run supabase:start`) is running,
// fills in its API URL and publishable/anon key; otherwise writes a template to edit by hand.
// Only local values are ever written; it never contacts the hosted project.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_JS = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/setup-env.mjs [--out <file>]   (default: .env.local in the repo root)');
  process.exit(0);
}
const outIdx = args.indexOf('--out');
if (outIdx !== -1 && !args[outIdx + 1]) {
  console.error('--out needs a file path.');
  process.exit(1);
}
const envFile = outIdx !== -1 ? resolve(args[outIdx + 1]) : join(ROOT, '.env.local');

console.log('Setting up .env.local file...');
if (existsSync(envFile)) {
  console.log(`${envFile} already exists. Skipping creation.`);
  console.log('If you need to update it, edit it manually.');
  process.exit(0);
}

/** API URL and publishable (anon) key of the running default local stack, or null. */
function localSupabase() {
  const [bin, binArgs] = existsSync(SUPABASE_JS)
    ? [process.execPath, [SUPABASE_JS, 'status', '-o', 'env']]
    : ['supabase', ['status', '-o', 'env']];
  const r = spawnSync(bin, binArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: !existsSync(SUPABASE_JS) && process.platform === 'win32',
  });
  if (r.error || r.status !== 0) return null;
  const env = {};
  for (const line of (r.stdout ?? '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  const apiUrl = env.API_URL;
  const key = env.ANON_KEY ?? env.PUBLISHABLE_KEY; // same order as scripts/test-env.mjs
  return apiUrl && key ? { apiUrl, key } : { apiUrl: null, key: null };
}

console.log('\nChecking for local Supabase instance...');
const local = localSupabase();

if (local?.apiUrl) {
  console.log('Found local Supabase instance!');
  console.log('\nCreating .env.local with local Supabase values...');
  writeFileSync(
    envFile,
    `# Supabase Configuration (Local)
VITE_SUPABASE_URL=${local.apiUrl}
VITE_SUPABASE_PUBLISHABLE_KEY=${local.key}

# App URL
VITE_APP_URL=http://localhost:8080
`,
  );
  console.log('.env.local created successfully!');
  console.log('\nValues:');
  console.log(`  VITE_SUPABASE_URL=${local.apiUrl}`);
  console.log(`  VITE_SUPABASE_PUBLISHABLE_KEY=${local.key}`);
  console.log('\nPlease restart your dev server (npm run dev)');
} else if (local) {
  console.error('Could not extract Supabase values. Please set up .env.local manually.');
  console.error('\nRun: npx supabase status');
  console.error('Then create .env.local with the API URL and publishable (anon) key.');
} else {
  console.log('No local Supabase instance found.');
  console.log('\nCreating .env.local template...');
  writeFileSync(
    envFile,
    `# Supabase Configuration
# Replace these with your Supabase project values

# For Local Supabase:
# 1. Run: npm run supabase:start   (then: npx supabase status)
# 2. Copy the API URL and publishable (anon) key
# 3. Update the values below

# For Remote Supabase:
# 1. Go to Supabase Dashboard > Project Settings > API
# 2. Copy the Project URL and anon/public key
# 3. Update the values below

VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here

# App URL
VITE_APP_URL=http://localhost:8080
`,
  );
  console.log('.env.local created with template values.');
  console.log('Please edit .env.local and add your Supabase credentials.');
  console.log('Then restart your dev server (npm run dev)');
}
