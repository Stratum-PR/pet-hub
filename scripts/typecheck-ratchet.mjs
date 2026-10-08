#!/usr/bin/env node
// Typecheck ratchet (P1-03): fails on any TypeScript error that isn't in scripts/typecheck-baseline.json.
// Errors are keyed by file + error code + message (no line numbers), so moving code doesn't trip it.
// The baseline may only shrink: after fixing errors, run `npm run typecheck:ratchet -- --update`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'typecheck-baseline.json');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const update = process.argv.includes('--update');

const counts = {};
for (const project of ['tsconfig.app.json', 'tsconfig.node.json']) {
  const r = spawnSync(process.execPath, [TSC, '-p', project, '--noEmit', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  for (const line of (r.stdout ?? '').split(/\r?\n/)) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
    if (m) {
      const key = `${m[1].replaceAll('\\', '/')} ${m[2]} ${m[3].slice(0, 160)}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;

if (update || !baseline) {
  if (baseline && total > baseline.total) {
    console.error(`✗ Refusing to grow the baseline (${baseline.total} → ${total}). Fix the new errors instead.`);
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify({ total, errors: Object.fromEntries(Object.entries(counts).sort()) }, null, 2) + '\n');
  console.log(`Baseline written: ${total} known TypeScript errors.`);
  process.exit(0);
}

const added = Object.entries(counts).filter(([k, n]) => n > (baseline.errors[k] ?? 0));
if (added.length) {
  console.error(`✗ ${added.length} new TypeScript error kind(s) (not in the baseline):`);
  for (const [k, n] of added) console.error(`  ${k}  (${baseline.errors[k] ?? 0} → ${n})`);
  console.error('Run `npx tsc -p tsconfig.app.json --noEmit` for line numbers.');
  process.exit(1);
}
const note = total < baseline.total ? ` (down from ${baseline.total}: run with --update to lock it in)` : '';
console.log(`✓ Typecheck ratchet: ${total} known errors, none new${note}.`);
