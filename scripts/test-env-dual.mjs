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
// Older frontends legitimately miss fixes (and features) this branch's specs check. Those are listed per ref
// in EXPECTED below (title + reason + FIX_LOG link). Any failure is then re-run, same frontend, on the ref's
// OWN schema (`test-env.mjs reset` with TEST_ENV_MIGRATIONS_DIR = the ref's supabase/migrations): if it
// passes there, THIS branch's schema broke that frontend — a SCHEMA REGRESSION, which no EXPECTED entry can
// excuse. Whatever would fail the gate (a suspected regression, or a failure that isn't listed) is then re-run
// once more on a fresh seed of THIS branch's schema: the seed is relative to "today", so a run that crosses
// midnight in Puerto Rico, or a retry on data its first attempt already changed, can fail once with no schema
// cause. Only failures that reproduce count. The run FAILS on a schema regression, on a failure that isn't
// listed, when a listed test passes (the list is stale: remove the entry), or when the own-schema check or the
// confirmation could not run. A ref that won't even build is a finding, not a skip.
// `--no-baseline` skips the own-schema re-run (faster, but then failures can't be told apart).
//
// Speed (U07c): the gate's own Playwright runs pass `--retries=0` (playwright.config.ts retries once in CI): a
// failure is re-checked on the ref's own schema anyway, and whatever would fail the gate is confirmed on a fresh
// seed, which keeps `--retries=1` (2 for `mayPass` entries, see below) so "reproduces" still means "fails every
// attempt". Entries marked `unreachable` (the ref's UI has no such screen, so the flow can never get as far as
// anything the database decides) are not run on that ref at all: `--grep-invert`, reported as skipped.
import { spawnSync } from 'node:child_process';
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
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
 * link, and must also fail on the ref's OWN schema (checked on every run). Remove an entry once that ref gets
 * the fix or feature (the run fails until you do, so the list stays honest). `mayPass: true` marks an entry whose
 * failure depends on the time of day the run happens: it may pass without failing the run (it is still checked
 * on the ref's own schema like any failure, so a schema regression is still caught). Calibrated 2026-10-09 against
 * main ad0bfd9 and dev c3521c2 (P1-13 in FIX_LOG has the runs); dev re-calibrated 2026-10-10 at 428a060 (U07c).
 */
//
// `unreachable: true` (with `missingUi`): the ref's UI doesn't have the screen or button the flow needs, so it fails
// before any step whose outcome the database decides, on any schema. Such a flow is skipped on that ref (never run,
// never re-checked) and reported as "skipped: unreachable". `missingUi` lists source patterns from THIS branch's
// src/ that implement what's missing; the entry only stays unreachable while at least one of them is absent from the
// ref's src/. When the ref ships all of them the gate fails until the entry is re-verified (drop `unreachable`, or
// the whole entry). Its title must still match a test (like every entry).
const E1 = `${FIX_LOG} → E2E-1`;
const E2 = `${FIX_LOG} → E2E-2`;
const E3 = `${FIX_LOG} → E2E-3`;
const P13 = `${FIX_LOG} → P1-13 (CI)`;
const EXPECTED = {
  // main = production (April 2026 code). It predates the appointment-book rework the flows drive, so several
  // flows can't even reach what they check; none of these are schema problems (all fail on main's own schema).
  main: [
    { title: '3. manager books an appointment for an existing client', reason: 'main\'s appointment book (April UI) has no "Nueva cita" button', link: P13, unreachable: true, missingUi: [/Nueva cita/] },
    { title: '4. manager reschedules an appointment, then cancels it', reason: 'main\'s appointment book has no "Historial" tab (and no "Editar / reprogramar")', link: P13, unreachable: true, missingUi: [/apptBook\.listAndHistory/, /Editar \/ reprogramar/] },
    { title: '4b. in the evening, the edit dialog opens on the appointment date (E2E-2)', reason: 'no "Historial" tab on main, and no E2E-2 fix; main\'s login also stays on "Entrando…" with the browser clock pinned ahead of real time', link: E2, unreachable: true, missingUi: [/apptBook\.listAndHistory/, /Editar \/ reprogramar/] },
    { title: '4c. an appointment earlier today stays on today in the edit dialog (E2E-2)', reason: 'same as 4b', link: E2, unreachable: true, missingUi: [/apptBook\.listAndHistory/, /Editar \/ reprogramar/] },
    { title: '5. manager checks out an appointment in cash', reason: 'no "Historial" tab and no per-appointment "Cobrar" (Quick charge) on main', link: P13, unreachable: true, missingUi: [/apptBook\.listAndHistory/, /QuickChargeDialog/] },
    { title: '5c. header "Cobrar" opens Quick charge over the dashboard (second copy of useTransactions, E2E-1)', reason: 'main has no header "Cobrar" (Quick charge is dev-only)', link: E1, unreachable: true, missingUi: [/QuickChargeDialog/] },
    // Time-dependent (mayPass): U17 pins flow 7's browser clock to 12:00 Puerto Rico on the seed's day. Before
    // 12:00 PR (16:00 UTC) that is ahead of real time and main's login hangs on "Entrando…"; after it, it passes.
    { title: '7. payroll page loads with the right hours and pay', reason: 'main\'s login stays on "Entrando…" (auth.getSession timeout) with the browser clock pinned ahead of real time (U17 pins flow 7 to 12:00 PR); passes when the run is after 12:00 PR', link: P13, mayPass: true },
    { title: '9. public booking page sends a request that reaches the business', reason: 'main has no /<slug>/reservar public booking page (it falls through to the landing page)', link: P13, unreachable: true, missingUi: [/path="\/:businessSlug\/reservar"/] },
    // Not `unreachable`: flow 10 logs in a basic-plan manager and depends on the plan the app reads from the
    // database (which routes are hidden) before the routing bug shows; it fails in ~15 s, so keeping it is cheap.
    { title: '10. hidden features redirect a basic-plan manager to the dashboard (E2E-3)', reason: 'E2E-3 fix not on main: /<slug>/appointments goes to /appointments/dashboard', link: E3 },
  ],
  // dev = the dev page. Since 428a060 (remediation merged into dev, 2026-10-10) its src/ is the same as
  // remediation's: it has the E2E-1/E2E-2/E2E-3 fixes and U22's ProtectedRoute race fix, so every flow must pass.
  // (Removed then: flows 4 and 7 as `mayPass` for the U22 race, 4b/4c for E2E-2, 10 for E2E-3.)
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
        const firstLine = (r) => (r?.error?.message ?? r?.errors?.[0]?.message ?? '').replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0];
        // Every attempt (first run and retries): a retry can fail for a different reason than the first run
        // (e.g. on data the first attempt already changed), so the first attempt's page is often the telling one.
        const attempts = (t.results ?? []).map((r, i) => {
          const ctx = (r.attachments ?? []).find((a) => a.name === 'error-context' && a.path && existsSync(a.path));
          const trace = (r.attachments ?? []).find((a) => a.name === 'trace' && a.path && existsSync(a.path));
          return {
            label: i === 0 ? 'first run' : `retry #${i}`,
            status: r.status,
            error: firstLine(r),
            context: ctx ? readFileSync(ctx.path, 'utf8') : '',
            trace: r.status !== 'passed' && trace ? traceGist(trace.path) : '', // read now: the files move after the run
          };
        });
        const last = t.results?.[t.results.length - 1];
        out.push({ title: spec.title, file: spec.file, status: t.status, error: firstLine(last), attempts });
      }
    }
    for (const s of suite.suites ?? []) visit(s);
  };
  for (const s of report.suites ?? []) visit(s);
  return out;
}

// ---------------------------------------------------------------- main
let stackEnv;

async function main() {
  const [arg, ...argv] = process.argv.slice(2);
  const noBaseline = argv.includes('--no-baseline');
  const rest = argv.filter((a) => a !== '--no-baseline');
  if (arg === 'serve') return serve(rest[0], Number(rest[1] ?? PORT));
  if (!arg || arg.startsWith('-')) {
    console.error('Usage: node scripts/test-env-dual.mjs <main|dev|HEAD|branch> [--no-baseline] [extra playwright args]');
    process.exit(1);
  }
  const ref = arg;
  const expected = EXPECTED[ref] ?? [];
  const unreachable = expected.filter((x) => x.unreachable);

  ({ stackEnv } = await import('./test-env.mjs'));
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

  // 1b. `unreachable` entries: still unreachable only while the ref lacks at least one `missingUi` pattern. Each
  //     pattern must match THIS branch's src/ (else it's stale and would never notice the ref catching up).
  const srcText = (root) => (existsSync(join(root, 'src')) ? walk(join(root, 'src')).filter((f) => /\.(tsx?|jsx?)$/.test(f)).map((f) => readFileSync(f, 'utf8')) : []);
  const unreachableProblems = [];
  if (unreachable.length) {
    const own = srcText(ROOT);
    const theirs = srcText(dir);
    for (const x of unreachable) {
      const patterns = x.missingUi ?? [];
      if (!patterns.length) unreachableProblems.push(`${x.title}: \`unreachable\` needs \`missingUi\` patterns`);
      for (const re of patterns.filter((r) => !own.some((t) => r.test(t)))) unreachableProblems.push(`${x.title}: \`missingUi\` ${re} matches nothing in this branch's src/ (stale pattern)`);
      if (patterns.length && patterns.every((r) => theirs.some((t) => r.test(t)))) {
        unreachableProblems.push(`${x.title}: ${ref} (${short}) now has every \`missingUi\` pattern (${patterns.join(', ')}), so the screen may exist there; run the flow and drop \`unreachable\` (or the entry)`);
      }
    }
  }

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

  // 4. This branch's smoke E2E against it, on THIS branch's schema.
  const safe = ref.replace(/[^\w.-]/g, '_');
  const serveCmd = `node ${JSON.stringify(join(ROOT, 'scripts', 'test-env-dual.mjs'))} serve ${JSON.stringify(dist)} ${PORT}`;
  const pwEnv = { TEST_API_URL: e.apiUrl, TEST_ANON_KEY: e.anonKey, TEST_SERVICE_KEY: e.serviceKey, E2E_WEB_COMMAND: serveCmd };
  // Unreachable entries are left out with --grep-invert; a listing checks the pattern removes exactly them (and
  // that each one's title still names a test).
  const skipArgs = unreachable.length ? ['--grep-invert', unreachable.map((x) => grepLiteral(x.title)).join('|')] : [];
  const listedAll = listTitles([], pwEnv);
  const unreachableMissing = unreachable.filter((x) => !listedAll.includes(x.title));
  if (unreachable.length) {
    const kept = listTitles(skipArgs, pwEnv);
    const wrong = listedAll.filter((t) => !kept.includes(t) && !unreachable.some((x) => x.title === t));
    if (wrong.length) fail(`The unreachable-entry filter would also skip: ${wrong.join('; ')}. Make the titles distinct.`);
    console.log(`▶ Skipping ${unreachable.length} flow(s) unreachable on ${ref} (its UI lacks the screen; see EXPECTED.${ref}). Verify them whenever ${ref} changes.`);
  }
  console.log(`▶ Smoke E2E against ${ref}'s frontend, on this branch's schema…`);
  const all = runSuite(join(ROOT, 'test-results', `dual-${safe}.json`), [...NO_RETRIES, ...skipArgs, ...rest], pwEnv, `${ref}'s frontend`);
  keepArtifacts(`dual-${safe}`);

  const known = new Map(expected.map((x) => [x.title, x]));
  const failed = all.filter((t) => t.status === 'unexpected');
  const passed = all.filter((t) => t.status === 'expected' || t.status === 'flaky');
  const skipped = all.filter((t) => t.status === 'skipped');

  // 5. Every failure is re-run with the SAME frontend on the ref's OWN schema (its supabase/migrations on top of
  //    the production snapshot: what that frontend runs on today). Fails there too → the ref's own bug (or a
  //    feature/fix it doesn't have yet). Passes there → THIS branch's schema broke it: a schema regression,
  //    never acceptable as an expected failure.
  const testEnv = join(ROOT, 'scripts', 'test-env.mjs');
  let stackOnRefSchema = false; // the stack has been reset to the ref's migrations
  const baseline = new Map(); // title → 'fail' | 'pass' | 'skipped'
  const baselineRuns = new Map(); // title → that test's result on the ref's own schema
  let baselineNote = '';
  if (failed.length && ref !== 'HEAD' && !noBaseline) {
    const migrations = join(dir, 'supabase', 'migrations');
    if (!existsSync(migrations)) {
      baselineNote = `${ref} has no supabase/migrations; failures could not be checked on its own schema.`;
    } else {
      console.log(`\n▶ ${failed.length} failure(s). Re-running them on ${ref}'s own schema to tell its bugs from schema regressions…`);
      const reset = sh(process.execPath, [testEnv, 'reset'], { allowFail: true, env: { ...process.env, TEST_ENV_MIGRATIONS_DIR: migrations } });
      stackOnRefSchema = true; // even a failed reset may have left it half-way
      const e2 = reset.status === 0 ? stackEnv() : null;
      if (!e2?.apiUrl) {
        baselineNote = `Resetting the stack to ${ref}'s schema failed; failures could not be checked on it.`;
      } else {
        const grep = failed.map((t) => grepLiteral(t.title)).join('|');
        const env2 = { ...pwEnv, TEST_API_URL: e2.apiUrl, TEST_ANON_KEY: e2.anonKey, TEST_SERVICE_KEY: e2.serviceKey };
        const base = runSuite(join(ROOT, 'test-results', `dual-${safe}-own-schema.json`), [...NO_RETRIES, '--grep', grep], env2, `${ref}'s frontend on its own schema`, { allowEmpty: true });
        keepArtifacts(`dual-${safe}-own-schema`);
        for (const t of base) {
          baseline.set(t.title, t.status === 'unexpected' ? 'fail' : t.status === 'skipped' ? 'skipped' : 'pass');
          baselineRuns.set(t.title, t);
        }
        if (!base.length) baselineNote = `The re-run on ${ref}'s own schema ran no tests; see the log.`;
      }
    }
  }

  // 5b. Confirm on a FRESH seed of this branch's schema whatever would fail the gate: a suspected schema regression
  //     (passed on the ref's own schema) or a failure that isn't listed. The seed is relative to "today" (Puerto
  //     Rico), so a run that crosses midnight, or a flow whose retry runs on data its first attempt already
  //     changed, can fail once without any schema or frontend cause. Reproduces → it stands (the gate fails).
  //     Doesn't → reported as NOT REPRODUCED, which does not fail the gate. Expected failures need no confirmation.
  const confirm = new Map(); // title → 'fail' | 'pass' | 'skipped'
  const confirmRuns = new Map();
  let confirmNote = '';
  const suspects = failed.filter((t) => baseline.get(t.title) === 'pass' || !known.has(t.title));
  if (suspects.length) {
    console.log(`\n▶ ${suspects.length} failure(s) would fail the gate. Re-running them on a fresh seed of this branch's schema to confirm…`);
    // Every Playwright run seeds a fresh business (e2e/global-setup.ts), so the stack only needs a reset when the
    // own-schema check moved it to the ref's migrations.
    const reset = stackOnRefSchema ? sh(process.execPath, [testEnv, 'reset'], { allowFail: true }) : { status: 0 };
    stackOnRefSchema = reset.status !== 0;
    const e3 = reset.status === 0 ? stackEnv() : null;
    if (!e3?.apiUrl) {
      confirmNote = "Resetting the stack to this branch's schema failed; the failures could not be confirmed.";
    } else {
      const env3 = { ...pwEnv, TEST_API_URL: e3.apiUrl, TEST_ANON_KEY: e3.anonKey, TEST_SERVICE_KEY: e3.serviceKey };
      // "Reproduces" = fails every attempt. One retry, as the gate had before U07c; `mayPass` entries (a frontend
      // race or the time of day) get two, in their own run, so a race must lose three times in a row here (after
      // losing on this schema and winning on the ref's own) before it counts as a regression.
      const groups = [
        ['confirm', suspects.filter((t) => !known.get(t.title)?.mayPass), 1],
        ['confirm-maypass', suspects.filter((t) => known.get(t.title)?.mayPass), 2],
      ];
      for (const [suffix, group, retries] of groups) {
        if (!group.length) continue;
        const grep = group.map((t) => grepLiteral(t.title)).join('|');
        const again = runSuite(join(ROOT, 'test-results', `dual-${safe}-${suffix}.json`), [`--retries=${retries}`, '--grep', grep], env3, `${ref}'s frontend (confirmation)`, { allowEmpty: true });
        keepArtifacts(`dual-${safe}-${suffix}`);
        for (const t of again) {
          confirm.set(t.title, t.status === 'unexpected' ? 'fail' : t.status === 'skipped' ? 'skipped' : 'pass');
          confirmRuns.set(t.title, t);
        }
      }
      const unconfirmed = suspects.filter((t) => !['fail', 'pass'].includes(confirm.get(t.title)));
      if (unconfirmed.length) confirmNote = `no pass/fail result in the confirmation run for: ${unconfirmed.map((t) => t.title).join('; ')}.`;
    }
  }
  if (stackOnRefSchema && !process.env.CI) {
    console.log("▶ Putting the stack back on this branch's schema…");
    sh(process.execPath, [testEnv, 'reset'], { allowFail: true });
  }

  // A failure that has no pass/fail result on the ref's own schema (not re-run, skipped there) can't be told
  // from a schema regression either.
  if (failed.length && ref !== 'HEAD' && !noBaseline && !baselineNote) {
    const unchecked = failed.filter((t) => !['fail', 'pass'].includes(baseline.get(t.title)));
    if (unchecked.length) baselineNote = `no pass/fail result on ${ref}'s own schema for: ${unchecked.map((t) => t.title).join('; ')}.`;
  }

  // 6. Classify against EXPECTED.
  const notReproduced = suspects.filter((t) => confirm.get(t.title) === 'pass');
  const regressions = failed.filter((t) => baseline.get(t.title) === 'pass' && !notReproduced.includes(t));
  const expectedFailures = failed.filter((t) => known.has(t.title) && !regressions.includes(t) && !notReproduced.includes(t));
  const unexpectedFailures = failed.filter((t) => !known.has(t.title) && !regressions.includes(t) && !notReproduced.includes(t));
  const stale = passed.filter((t) => known.has(t.title) && !known.get(t.title).mayPass);
  const passedMayPass = passed.filter((t) => known.get(t.title)?.mayPass);
  const missing = [...expected.filter((x) => !x.unreachable && !all.some((t) => t.title === x.title)), ...unreachableMissing];
  const where = (t) =>
    baseline.get(t.title) === 'fail' ? `fails on ${ref}'s own schema too` : baseline.has(t.title) ? `${baseline.get(t.title)} on ${ref}'s own schema` : 'not re-run on its own schema';

  const lines = [];
  lines.push(`## Dual-frontend gate: \`${ref}\` (${short}) frontend vs this branch's schema`);
  lines.push('');
  lines.push(
    `**${passed.length - stale.length - passedMayPass.length} passed · ${expectedFailures.length} expected failures · ${unreachable.length} skipped as unreachable · ${regressions.length} schema regressions · ${unexpectedFailures.length} unexpected failures · ${passedMayPass.length} mayPass passes · ${stale.length} expected failures that passed · ${notReproduced.length} not reproduced** (${all.length} tests run${skipped.length ? `, ${skipped.length} skipped by Playwright` : ''})`,
  );
  lines.push('');
  for (const t of regressions) lines.push(`- **SCHEMA REGRESSION** (passes on ${ref}'s own schema, fails on this branch's): ${t.title} (${t.file}) — ${t.error}`);
  for (const t of unexpectedFailures) lines.push(`- **UNEXPECTED FAILURE** (${where(t)}): ${t.title} (${t.file}) — ${t.error}`);
  for (const t of notReproduced) lines.push(`- not reproduced (failed, ${where(t)}, then passed on a fresh seed of this branch's schema; not counted): ${t.title} — ${t.error}`);
  for (const t of stale) lines.push(`- **EXPECTED FAILURE PASSED** (remove it from EXPECTED.${ref} in scripts/test-env-dual.mjs): ${t.title}`);
  for (const t of passedMayPass) lines.push(`- expected failure passed this time (time-dependent, allowed): ${t.title} — ${known.get(t.title).reason}`);
  for (const x of missing) lines.push(`- **EXPECTED-FAILURE ENTRY MATCHES NO TEST** (stale title?): ${x.title}`);
  for (const p of unreachableProblems) lines.push(`- **UNREACHABLE ENTRY NEEDS A LOOK**: ${p}`);
  for (const t of expectedFailures) lines.push(`- expected failure (${where(t)}): ${t.title} — ${known.get(t.title).reason} (${known.get(t.title).link})`);
  for (const x of unreachable.filter((u) => !unreachableMissing.includes(u))) lines.push(`- skipped: unreachable on ${ref} (${x.reason}): ${x.title} (${x.link})`);
  if (unreachable.length) lines.push(`- ${unreachable.length} flow(s) not run on ${ref} as unreachable: re-verify them (EXPECTED.${ref} in scripts/test-env-dual.mjs) whenever ${ref} changes.`);
  for (const t of skipped) lines.push(`- skipped: ${t.title}`);
  if (confirmNote) lines.push(`- **NOT CONFIRMED** (so a flake can't be told from a real failure): ${confirmNote}`);
  if (baselineNote) lines.push(`- **NOT CHECKED ON ITS OWN SCHEMA** (so failures can't be told from schema regressions): ${baselineNote}`);
  const text = lines.join('\n');

  // For anything that needs a human: the page as Playwright saw it when the test failed (its error context).
  // Printed before the summary, so the summary stays at the end of the log.
  for (const t of [...regressions, ...unexpectedFailures, ...notReproduced]) {
    const runs = [['this branch\'s schema', t], [`${ref}'s own schema`, baselineRuns.get(t.title)], ['confirmation, fresh seed', confirmRuns.get(t.title)]];
    for (const [schema, run] of runs) {
      for (const a of run?.attempts ?? []) {
        if (a.status === 'passed') continue;
        console.log(`\n── ${t.title} · ${schema} · ${a.label} (${a.status}): ${a.error} ──${a.context ? `\n${pageGist(a.context)}` : ' (no page snapshot)'}`);
        if (a.trace) console.log(a.trace);
      }
    }
  }
  console.log(`\n${text.replace(/\*\*/g, '')}\n`);
  summary(text);

  const ok =
    !baselineNote && !confirmNote && regressions.length === 0 && unexpectedFailures.length === 0 && stale.length === 0 && missing.length === 0 && unreachableProblems.length === 0;
  console.log(
    ok
      ? `✓ ${ref}: ${passed.length} passed, ${expectedFailures.length} expected failures, ${unreachable.length} skipped as unreachable.`
      : `✗ ${ref}: the dual-frontend gate failed (see above).`,
  );
  process.exit(ok ? 0 : 1);
}

/** The gate's own runs don't retry (playwright.config.ts retries once in CI): see the header. */
const NO_RETRIES = ['--retries=0'];

/** A test title as a literal for Playwright's --grep / --grep-invert. */
function grepLiteral(title) {
  return title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Titles of the tests Playwright would run with `args` (no browser, no web server, no seed). */
function listTitles(args, env) {
  const r = sh(join(ROOT, 'node_modules', '.bin', WIN ? 'playwright.cmd' : 'playwright'), ['test', '--list', '--reporter=json', ...args], {
    capture: true,
    allowFail: true,
    env: { ...process.env, ...env, E2E_JSON_REPORT: '' },
  });
  try {
    return results(JSON.parse(r.stdout)).map((t) => t.title);
  } catch {
    process.stderr.write(r.stderr ?? '');
    return fail(`Could not list the smoke E2E tests (playwright test --list, exit ${r.status}).`);
  }
}

/** Runs Playwright (this branch's specs) with `env` and returns the flattened results of its JSON report. */
function runSuite(report, args, env, what, { allowEmpty = false } = {}) {
  rmSync(report, { force: true });
  sh(join(ROOT, 'node_modules', '.bin', WIN ? 'playwright.cmd' : 'playwright'), ['test', ...args], {
    allowFail: true,
    env: { ...process.env, ...env, E2E_JSON_REPORT: report },
  });
  if (!existsSync(report)) fail(`Playwright wrote no report (${report}); see the log above.`);
  const json = JSON.parse(readFileSync(report, 'utf8'));
  const all = results(json);
  const globalErrors = (json.errors ?? []).map((x) => (x.message ?? '').split('\n')[0]);
  if (!all.length && !allowEmpty) fail(`No tests ran against ${what}. ${globalErrors.join(' | ')}`);
  if (globalErrors.length) console.warn(`! Playwright errors (${what}): ${globalErrors.join(' | ')}`);
  return all;
}

/** The telling lines of Playwright's page snapshot (headings, dialogs, alerts, buttons, text), not the whole tree. */
function pageGist(context) {
  const telling = /heading|dialog|alert|button "|tab "|paragraph|text:|Error|textbox/;
  const lines = context.split('\n').filter((l) => telling.test(l)).map((l) => `  ${l.trim().slice(0, 200)}`);
  return (lines.length ? lines : context.split('\n')).slice(0, 40).join('\n');
}

/**
 * What the browser did, from a Playwright trace: page URLs, console warnings/errors, uncaught page errors and
 * failed requests (status >= 400). The traces themselves are in the uploaded artifact; this makes the log
 * readable on its own. Best effort: any problem reading the trace is reported, never fatal.
 */
function traceGist(zip) {
  const read = (entry) => {
    const r = spawnSync('unzip', ['-p', zip, entry], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : '';
  };
  const events = [];
  const parse = (text) => {
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        /* skip partial lines */
      }
    }
  };
  const listing = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' });
  if (listing.status !== 0) return `  (trace: could not list ${zip})`;
  for (const entry of listing.stdout.split('\n').filter((x) => /\.(trace|network)$/.test(x))) parse(read(entry));
  const out = [];
  let lastUrl = '';
  for (const e of events) {
    const url = e.type === 'frame-snapshot' ? e.snapshot?.frameUrl : null;
    if (url && url !== lastUrl && !url.startsWith('about:')) {
      out.push(`  url: ${url}`);
      lastUrl = url;
    }
    if (e.type === 'console' && /^(error|warning)$/.test(e.messageType ?? '')) out.push(`  console.${e.messageType}: ${String(e.text ?? '').slice(0, 300)}`);
    if (e.type === 'event' && e.method === 'pageError') out.push(`  pageerror: ${String(e.params?.error?.error?.message ?? JSON.stringify(e.params)).slice(0, 300)}`);
    if (e.type === 'resource-snapshot') {
      const status = e.snapshot?.response?.status ?? 0;
      const u = e.snapshot?.request?.url ?? '';
      if ((status >= 400 || status === -1) && !/\.(png|jpe?g|svg|ico|woff2?)(\?|$)/.test(u)) {
        out.push(`  http ${status}: ${e.snapshot?.request?.method ?? ''} ${u.slice(0, 200)}`);
      }
    }
  }
  const dedup = out.filter((l, i) => l !== out[i - 1]);
  return dedup.length ? `  trace (${dedup.length} lines):\n${dedup.slice(0, 80).join('\n')}` : '  trace: no navigations, console errors or failed requests recorded';
}

/** Moves a run's HTML report and traces aside (the next run would wipe them); the workflow uploads them. */
function keepArtifacts(name) {
  const moves = [
    [join(ROOT, 'reports', 'e2e'), join(ROOT, 'reports', `e2e-${name}`)],
    [join(ROOT, 'test-results', 'e2e'), join(ROOT, 'test-results', `e2e-${name}`)],
  ];
  for (const [from, to] of moves) {
    if (!existsSync(from)) continue;
    rmSync(to, { recursive: true, force: true });
    renameSync(from, to);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
