#!/usr/bin/env node
// Typecheck ratchet (P1-03): fails on any TypeScript error that isn't in scripts/typecheck-baseline.json.
// Errors are keyed by file + error code + message (no line numbers), so moving code doesn't trip it.
// The baseline may only shrink: after fixing errors, run `npm run typecheck:ratchet -- --update`.
//
// Machine independence (P1-04): TypeScript writes absolute paths into some messages, e.g.
//   import("C:/Users/Jovaniel/dev/Grumi/src/types/index").Pet          (Windows)
//   import("/home/runner/work/pet-hub/pet-hub/src/types/index").Pet    (CI)
// so every message is normalized to repo-relative form (`import("src/types/index")`) before it is keyed,
// and baseline keys are normalized the same way when they are read. Keys written before this change were
// truncated to 160 chars *before* normalization (a long Windows path ate part of the budget), so after
// normalization they are shorter than 160 and are matched as prefixes of current keys (see baselineIndex).
// `--update` writes normalized keys, so new baselines are the same on every machine.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'typecheck-baseline.json');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const update = process.argv.includes('--update');
const KEY_LEN = 160;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// This checkout's root as TypeScript prints it (forward slashes; drive-letter case may differ).
const OWN_ROOT = new RegExp(`${escapeRe(ROOT.replaceAll('\\', '/').replace(/\/+$/, ''))}/`, 'gi');
// Another machine's root (a baseline written elsewhere): a quoted absolute path, POSIX or Windows, up to the
// first segment that is a top-level entry of this repo (src/, supabase/, node_modules/, ...).
const TOP = readdirSync(ROOT).filter((n) => n !== '.git').map(escapeRe).join('|');
const FOREIGN_ROOT = new RegExp(`(["'])(?:[A-Za-z]:)?/[^"'\\n]*?/(?=(?:${TOP})(?:[/"']|$))`, 'g');
// A stored key cut off in the middle of an absolute path (`import("C:/Users/Jo`): keep only the quote.
const DANGLING_ROOT = /(["'])(?:[A-Za-z]:)?\/[^"'\n]*$/;

/** Repo-relative form of a TypeScript message or file path. */
const normalize = (text) => text.replaceAll('\\', '/').replace(OWN_ROOT, '').replace(FOREIGN_ROOT, '$1');

/** `file TSxxxx message` → { head: 'file TSxxxx', msg }. */
function splitKey(key) {
  const m = key.match(/^(\S+) (TS\d+) ([\s\S]*)$/);
  return m ? { head: `${m[1]} ${m[2]}`, msg: m[3] } : { head: key, msg: '' };
}

const counts = {};
for (const project of ['tsconfig.app.json', 'tsconfig.node.json']) {
  const r = spawnSync(process.execPath, [TSC, '-p', project, '--noEmit', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  for (const line of (r.stdout ?? '').split(/\r?\n/)) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
    if (m) {
      // Normalize first, then truncate, so the 160-char budget means the same thing on every machine.
      const key = `${normalize(m[1])} ${m[2]} ${normalize(m[3]).slice(0, KEY_LEN)}`;
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

/**
 * Baseline keys, normalized. A stored message of 160+ chars was truncated; if normalization shortened it
 * (it held an absolute path), equality no longer works, so it also becomes a prefix: it matches any current
 * key with the same file + code whose message starts with it. Normalized (new-style) keys never shrink, so
 * for them this is plain equality, exactly as before.
 */
function baselineIndex(errors) {
  const exact = new Map();
  const prefixes = [];
  for (const [rawKey, n] of Object.entries(errors)) {
    const { head, msg: rawMsg } = splitKey(rawKey);
    let msg = normalize(rawMsg);
    const truncated = rawMsg.length >= KEY_LEN && msg.length < KEY_LEN;
    if (truncated) msg = msg.replace(DANGLING_ROOT, '$1');
    const key = `${head} ${msg}`;
    exact.set(key, (exact.get(key) ?? 0) + n);
    if (truncated) prefixes.push({ head, msg, key });
  }
  prefixes.sort((a, b) => b.msg.length - a.msg.length); // most specific first
  return { exact, prefixes };
}

const { exact, prefixes } = baselineIndex(baseline.errors);
/** The baseline key a current key counts against (itself when it isn't in the baseline). */
function canonical(key) {
  if (exact.has(key)) return key;
  const { head, msg } = splitKey(key);
  return prefixes.find((p) => p.head === head && msg.startsWith(p.msg))?.key ?? key;
}
const grouped = {};
for (const [k, n] of Object.entries(counts)) {
  const c = canonical(k);
  grouped[c] = (grouped[c] ?? 0) + n;
}

const added = Object.entries(grouped).filter(([k, n]) => n > (exact.get(k) ?? 0));
if (added.length) {
  console.error(`✗ ${added.length} new TypeScript error kind(s) (not in the baseline):`);
  for (const [k, n] of added) console.error(`  ${k}  (${exact.get(k) ?? 0} → ${n})`);
  console.error('Run `npx tsc -p tsconfig.app.json --noEmit` for line numbers.');
  process.exit(1);
}
const note = total < baseline.total ? ` (down from ${baseline.total}: run with --update to lock it in)` : '';
console.log(`✓ Typecheck ratchet: ${total} known errors, none new${note}.`);
