#!/usr/bin/env node
// Lint ratchet (P1-05): fails on any ESLint problem that isn't in scripts/lint-baseline.json.
// Problems are keyed by file + rule + message (no line numbers), so moving code doesn't trip it.
// The baseline may only shrink: after fixing problems, run `npm run lint:ratchet -- --update`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'lint-baseline.json');
const ESLINT = join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const update = process.argv.includes('--update');

const r = spawnSync(process.execPath, [ESLINT, '.', '-f', 'json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 });
let results;
try {
  results = JSON.parse(r.stdout);
} catch {
  console.error(`✗ ESLint did not produce a report:\n${r.stderr}`);
  process.exit(1);
}
const counts = {};
for (const file of results) {
  const path = relative(ROOT, file.filePath).replaceAll('\\', '/');
  for (const m of file.messages) {
    const key = `${path} ${m.ruleId ?? 'parse'} ${m.message.slice(0, 160)}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;

if (update || !baseline) {
  if (baseline && total > baseline.total) {
    console.error(`✗ Refusing to grow the baseline (${baseline.total} → ${total}). Fix the new problems instead.`);
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify({ total, problems: Object.fromEntries(Object.entries(counts).sort()) }, null, 2) + '\n');
  console.log(`Baseline written: ${total} known lint problems.`);
  process.exit(0);
}

const added = Object.entries(counts).filter(([k, n]) => n > (baseline.problems[k] ?? 0));
if (added.length) {
  console.error(`✗ ${added.length} new lint problem kind(s) (not in the baseline):`);
  for (const [k, n] of added) console.error(`  ${k}  (${baseline.problems[k] ?? 0} → ${n})`);
  console.error('Run `npx eslint <file>` for line numbers.');
  process.exit(1);
}
const note = total < baseline.total ? ` (down from ${baseline.total}: run with --update to lock it in)` : '';
console.log(`✓ Lint ratchet: ${total} known problems, none new${note}.`);
