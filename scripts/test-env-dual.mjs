#!/usr/bin/env node
// Dual-frontend gate (remediation plan P1-13, §9 rule 3): one database serves two app versions
// (`main` → production, `dev` → the dev page), so every migration or Edge Function change must keep BOTH
// frontends working. This runs THIS branch's smoke E2E (e2e/*.spec.ts) against ANOTHER ref's frontend,
// on the local test stack built from THIS branch's migrations (the schema production will have).
//
//   npm run test:env:up                         (once: the stack, from this branch)
//   node scripts/test-env-dual.mjs main         build + serve origin/main's frontend, run the smoke E2E
//   node scripts/test-env-dual.mjs dev          same for origin/dev
//   node scripts/test-env-dual.mjs HEAD         same for this commit (calibration: must match `npm run test:e2e`)
//
// Steps: fetch the ref → `git archive` it into a temp dir (DUAL_WORKDIR, default the OS temp dir) → drop its
// committed .env files → `npm ci` → `npm run build` (what Vercel runs) with the LOCAL stack's URL and anon
// key → check the bundle points at the local stack and not at whatever the ref's .env named → serve dist/
// on :55440 (SPA fallback, like vercel.json) → Playwright with this branch's specs and seed.
//
// Older frontends legitimately miss fixes this branch's specs check. Those are listed per ref in EXPECTED
// below (title + reason + FIX_LOG link). The run FAILS if a test fails that isn't listed, or if a listed
// test passes (the list is stale: remove the entry). A ref that won't even build is a finding, not a skip.
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, appendFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIN = process.platform === 'win32';
const PORT = 55440; // playwright.config.ts
const FIX_LOG = 'docs/FIX_LOG.md';

/**
 * Tests expected to FAIL against a ref's frontend, by exact test title. Each needs a reason and a FIX_LOG
 * link. Remove an entry once that ref gets the fix (the run fails until you do, so the list stays honest).
 */
const EXPECTED = {
  main: [],
  dev: [],
};

// ---------------------------------------------------------------- static server (`serve <dir> [port]`)
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.pdf': 'application/pdf',
};

function serve(dir, port) {
  const root = resolve(dir);
  const index = join(root, 'index.html');
  createServer((req, res) => {
    let file;
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      file = normalize(join(root, path));
    } catch {
      file = index;
    }
    if (!(file === root || file.startsWith(root + sep))) file = index;
    if (!existsSync(file) || !statSync(file).isFile()) file = index; // SPA fallback (vercel.json rewrites)
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
}

// ---------------------------------------------------------------- helpers
function sh(cmd, args, { cwd = ROOT, env = process.env, capture = false, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', shell: WIN, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail) {
    if (capture) process.stderr.write(r.stderr ?? '');
    fail(`"${cmd} ${args.join(' ')}" failed (exit ${r.status}).`);
  }
  return r;
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  summary(`### ✗ ${msg}`);
  process.exit(1);
}

/** Appends to the GitHub Actions job summary when running in CI. */
function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Resolves `ref` to a commit, fetching it from origin when it's a branch name. */
function resolveRef(ref) {
  if (ref === 'HEAD') return sh('git', ['rev-parse', 'HEAD'], { capture: true }).stdout.trim();
  const shallow = sh('git', ['rev-parse', '--is-shallow-repository'], { capture: true }).stdout.trim() === 'true';
  const fetched = sh('git', ['fetch', '--no-tags', ...(shallow ? ['--depth=1'] : []), 'origin', `+refs/heads/${ref}:refs/remotes/origin/${ref}`], { allowFail: true });
  if (fetched.status !== 0) console.warn(`! Could not fetch origin/${ref}; using the local copy if there is one.`);
  const r = sh('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${ref}^{commit}`], { capture: true, allowFail: true });
  if (r.status !== 0) fail(`Unknown ref "${ref}" (no origin/${ref}).`);
  return r.stdout.trim();
}

/** Production (or any non-local) Supabase URLs named in the ref's committed .env files; they get deleted. */
function dropEnvFiles(dir) {
  const urls = [];
  for (const f of readdirSync(dir)) {
    if (!/^\.env/.test(f) || !statSync(join(dir, f)).isFile()) continue;
    for (const line of readFileSync(join(dir, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?([^"'\s]+)/);
      if (m && !/127\.0\.0\.1|localhost|placeholder/.test(m[1])) urls.push(m[1].replace(/\/+$/, ''));
    }
    rmSync(join(dir, f));
  }
  return urls;
}

/** Flattens Playwright's JSON report into [{ title, file, status, error }]. */
function results(report) {
  const out = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const err = last?.error?.message ?? last?.errors?.[0]?.message ?? '';
        out.push({ title: spec.title, file: spec.file, status: t.status, error: err.replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0] });
      }
    }
    for (const s of suite.suites ?? []) visit(s);
  };
  for (const s of report.suites ?? []) visit(s);
  return out;
}

// ---------------------------------------------------------------- main
async function main() {
  const [arg, ...rest] = process.argv.slice(2);
  if (arg === 'serve') return serve(rest[0], Number(rest[1] ?? PORT));
  if (!arg || arg.startsWith('-')) {
    console.error('Usage: node scripts/test-env-dual.mjs <main|dev|HEAD|branch> [extra playwright args]');
    process.exit(1);
  }
  const ref = arg;
  const expected = EXPECTED[ref] ?? [];

  const { stackEnv } = await import('./test-env.mjs');
  const e = stackEnv();
  if (!e?.apiUrl || !e.anonKey || !e.serviceKey) fail('Test stack is not running. Start it with: npm run test:env:up');

  const sha = resolveRef(ref);
  const short = sha.slice(0, 7);
  console.log(`▶ Dual-frontend gate: ${ref} (${short})'s frontend against this branch's schema and smoke E2E`);

  // 1. Export the ref's tree into a clean dir outside the repo.
  const base = resolve(process.env.DUAL_WORKDIR ?? join(tmpdir(), 'grumi-dual'));
  const dir = join(base, ref.replace(/[^\w.-]/g, '_'));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const tar = join(base, `${ref.replace(/[^\w.-]/g, '_')}.tar`);
  sh('git', ['archive', '--format=tar', '-o', tar, sha]);
  sh('tar', ['-xf', tar, '-C', dir]);
  rmSync(tar, { force: true });
  const foreignUrls = dropEnvFiles(dir);

  // 2. Install and build exactly like the deploy does, but pointed at the local stack.
  const buildEnv = {
    ...process.env,
    HUSKY: '0',
    VITE_SUPABASE_URL: e.apiUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: e.anonKey,
    VITE_SUPABASE_PROJECT_ID: 'grumi-test',
  };
  console.log(`▶ npm ci (${ref})…`);
  if (sh('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, env: buildEnv, allowFail: true }).status !== 0) {
    fail(`FINDING: ${ref} (${short}) — \`npm ci\` fails, so its frontend can't be built at all.`);
  }
  console.log(`▶ npm run build (${ref})…`);
  if (sh('npm', ['run', 'build'], { cwd: dir, env: buildEnv, allowFail: true }).status !== 0) {
    fail(`FINDING: ${ref} (${short}) — \`npm run build\` fails, so its frontend can't run at all. See the log above.`);
  }
  const dist = join(dir, 'dist');
  if (!existsSync(join(dist, 'index.html'))) fail(`FINDING: ${ref} (${short}) — the build produced no dist/index.html.`);

  // 3. Safety: the bundle must talk to the local stack, never to the URL in the ref's committed .env.
  const js = walk(dist).filter((f) => /\.(m?js|html)$/.test(f)).map((f) => readFileSync(f, 'utf8'));
  if (!js.some((s) => s.includes(e.apiUrl))) fail(`The ${ref} bundle doesn't contain the local stack URL; refusing to run.`);
  if (foreignUrls.some((u) => js.some((s) => s.includes(u)))) fail(`The ${ref} bundle still contains a non-local Supabase URL from its .env; refusing to run.`);

  // 4. This branch's smoke E2E against it.
  const report = join(ROOT, 'test-results', `dual-${ref.replace(/[^\w.-]/g, '_')}.json`);
  rmSync(report, { force: true });
  const serveCmd = `node ${JSON.stringify(join(ROOT, 'scripts', 'test-env-dual.mjs'))} serve ${JSON.stringify(dist)} ${PORT}`;
  console.log(`▶ Smoke E2E against ${ref}'s frontend…`);
  sh(join(ROOT, 'node_modules', '.bin', WIN ? 'playwright.cmd' : 'playwright'), ['test', ...rest], {
    allowFail: true,
    env: {
      ...process.env,
      TEST_API_URL: e.apiUrl,
      TEST_ANON_KEY: e.anonKey,
      TEST_SERVICE_KEY: e.serviceKey,
      E2E_WEB_COMMAND: serveCmd,
      E2E_JSON_REPORT: report,
    },
  });
  if (!existsSync(report)) fail(`Playwright wrote no report (${report}); see the log above.`);
  const json = JSON.parse(readFileSync(report, 'utf8'));
  const all = results(json);
  const globalErrors = (json.errors ?? []).map((x) => (x.message ?? '').split('\n')[0]);
  if (!all.length) fail(`No tests ran against ${ref}'s frontend. ${globalErrors.join(' | ')}`);

  // 5. Compare with the expected-failure list.
  const known = new Map(expected.map((x) => [x.title, x]));
  const failed = all.filter((t) => t.status === 'unexpected');
  const passed = all.filter((t) => t.status === 'expected' || t.status === 'flaky');
  const skipped = all.filter((t) => t.status === 'skipped');
  const expectedFailures = failed.filter((t) => known.has(t.title));
  const unexpectedFailures = failed.filter((t) => !known.has(t.title));
  const stale = passed.filter((t) => known.has(t.title));
  const missing = expected.filter((x) => !all.some((t) => t.title === x.title));

  const lines = [];
  lines.push(`## Dual-frontend gate: \`${ref}\` (${short}) frontend vs this branch's schema`);
  lines.push('');
  lines.push(`**${passed.length - stale.length} passed · ${expectedFailures.length} expected failures · ${unexpectedFailures.length} unexpected failures · ${stale.length} expected failures that passed** (${all.length} tests${skipped.length ? `, ${skipped.length} skipped` : ''})`);
  lines.push('');
  for (const t of expectedFailures) lines.push(`- expected failure: ${t.title} — ${known.get(t.title).reason} (${known.get(t.title).link})`);
  for (const t of unexpectedFailures) lines.push(`- **UNEXPECTED FAILURE**: ${t.title} (${t.file}) — ${t.error}`);
  for (const t of stale) lines.push(`- **EXPECTED FAILURE PASSED** (remove it from EXPECTED.${ref} in scripts/test-env-dual.mjs): ${t.title}`);
  for (const x of missing) lines.push(`- **EXPECTED-FAILURE ENTRY MATCHES NO TEST** (stale title?): ${x.title}`);
  for (const t of skipped) lines.push(`- skipped: ${t.title}`);
  const text = lines.join('\n');
  console.log(`\n${text.replace(/\*\*/g, '')}\n`);
  summary(text);

  const ok = unexpectedFailures.length === 0 && stale.length === 0 && missing.length === 0;
  console.log(ok ? `✓ ${ref}: ${passed.length} passed, ${expectedFailures.length} expected failures.` : `✗ ${ref}: the dual-frontend gate failed (see above).`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
