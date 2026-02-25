/**
 * Checks what crawlers see: discovery files (sitemap, robots, llms.txt, ai-routes)
 * and home page meta. Works in two modes:
 *
 * 1. Offline (default): reads from dist/ after build. No server needed.
 *    Usage: node scripts/check-crawler-view.mjs
 *    or:    node scripts/check-crawler-view.mjs offline
 *
 * 2. Live: fetches from a running preview server.
 *    Usage: node scripts/check-crawler-view.mjs http://localhost:4173
 *    (Start preview first in another terminal: npm run preview)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const firstArg = process.argv[2];
const isOffline = !firstArg || firstArg === 'offline' || !firstArg.startsWith('http');
const BASE = firstArg && firstArg.startsWith('http') ? firstArg.replace(/\/$/, '') : null;

async function getFromServer(path) {
  const url = path === '/' ? BASE : `${BASE}${path}`;
  const res = await fetch(url);
  return { status: res.status, text: await res.text() };
}

function getFromDist(path) {
  const file = path === '/' ? 'index.html' : path;
  const fullPath = join(distDir, file);
  if (!existsSync(fullPath)) return { status: 404, text: '' };
  return { status: 200, text: readFileSync(fullPath, 'utf-8') };
}

async function main() {
  if (isOffline) {
    console.log('Checking dist/ (offline mode). Run "npm run build" first if dist/ is missing.');
  } else {
    console.log('Fetching from', BASE);
  }
  console.log('');

  const get = isOffline
    ? (path) => Promise.resolve(getFromDist(path))
    : (path) => getFromServer(path);

  const discovery = [
    ['sitemap.xml', /<urlset/, /<loc>/],
    ['robots.txt', /Sitemap:/, /Allow:\s*\//],
    ['llms.txt', /Pet Hub/, /Main links/],
    ['ai-routes.json', /"routes"/, /"baseUrl"/],
    ['content.json', /"pricing"/, /"pages"/],
  ];

  let discoveryOk = true;
  for (const [path, ...patterns] of discovery) {
    const { status, text } = await get(path);
    const ok = status === 200 && patterns.every((p) => p.test(text));
    if (!ok) discoveryOk = false;
    const statusNote = status !== 200 ? ` (HTTP ${status})` : '';
    console.log(ok ? 'OK' : 'FAIL', path + statusNote);
  }

  console.log('');
  const { status, text } = await get('/');
  if (status !== 200) {
    console.log('FAIL / (home page)' + (status ? ` HTTP ${status}` : ' - not found'));
    if (isOffline) console.log('  Run: npm run build');
    else console.log('  Start preview in another terminal: npm run preview');
    process.exit(1);
  }
  const hasTitle = /<title>[^<]+<\/title>/.test(text);
  const hasDesc = /<meta name="description" content=/.test(text);
  const hasOg = /<meta property="og:title"/.test(text);
  const hasJsonLd = /application\/ld\+json/.test(text);
  const metaOk = hasTitle && (hasDesc || hasOg || hasJsonLd);
  console.log(metaOk ? 'OK' : 'FAIL', 'Home page: <title>, description, og:*, or JSON-LD');
  if (!hasTitle) console.log('  - missing <title>');
  if (!hasDesc && !hasOg) console.log('  - missing meta description/og (check in browser with preview)');

  console.log('');
  if (discoveryOk && metaOk) {
    console.log('All checks passed. Crawlers and AI agents can discover and index your site.');
  } else {
    if (isOffline) console.log('Run "npm run build" then try again, or run with a URL to check a live server.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  if (isOffline) console.error('Run: npm run build');
  else console.error('Start preview in another terminal: npm run preview');
  process.exit(1);
});
