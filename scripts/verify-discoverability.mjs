/**
 * Verifies that the SEO/AI discoverability build artifacts exist and contain expected data.
 * Run after `npm run build` (or use `npm run verify:discoverability` which builds first).
 *
 * Usage: node scripts/verify-discoverability.mjs
 * Exits 0 if all checks pass, 1 otherwise.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

  const requiredFiles = ['sitemap.xml', 'robots.txt', 'ai-routes.json', 'llms.txt', 'content.json'];
let failed = false;

// 1. All artifact files exist
console.log('Checking dist/ artifacts...');
for (const file of requiredFiles) {
  const path = join(distDir, file);
  if (!existsSync(path)) {
    console.error(`  FAIL: ${file} not found. Run "npm run build" first.`);
    failed = true;
  } else {
    console.log(`  OK: ${file}`);
  }
}

// 2. sitemap.xml is valid XML and has urlset
if (existsSync(join(distDir, 'sitemap.xml'))) {
  const sitemap = readFileSync(join(distDir, 'sitemap.xml'), 'utf-8');
  if (!sitemap.includes('<urlset') || !sitemap.includes('</url>')) {
    console.error('  FAIL: sitemap.xml missing <urlset> or <url> entries');
    failed = true;
  } else {
    const count = (sitemap.match(/<url>/g) || []).length;
    console.log(`  OK: sitemap.xml has ${count} URL(s)`);
  }
}

// 3. robots.txt mentions Sitemap
if (existsSync(join(distDir, 'robots.txt'))) {
  const robots = readFileSync(join(distDir, 'robots.txt'), 'utf-8');
  if (!robots.includes('Sitemap:')) {
    console.error('  FAIL: robots.txt missing "Sitemap:" line');
    failed = true;
  } else {
    console.log('  OK: robots.txt has Sitemap line');
  }
}

// 4. ai-routes.json is valid JSON and has routes
if (existsSync(join(distDir, 'ai-routes.json'))) {
  try {
    const json = JSON.parse(readFileSync(join(distDir, 'ai-routes.json'), 'utf-8'));
    if (!Array.isArray(json.routes) || json.routes.length === 0) {
      console.error('  FAIL: ai-routes.json has no routes array or empty');
      failed = true;
    } else {
      console.log(`  OK: ai-routes.json has ${json.routes.length} route(s)`);
    }
  } catch (e) {
    console.error('  FAIL: ai-routes.json invalid JSON:', e.message);
    failed = true;
  }
}

// 5. llms.txt has content and mentions main links
if (existsSync(join(distDir, 'llms.txt'))) {
  const llms = readFileSync(join(distDir, 'llms.txt'), 'utf-8');
  if (llms.length < 100 || !llms.includes('Pet Hub')) {
    console.error('  FAIL: llms.txt too short or missing "Pet Hub"');
    failed = true;
  } else {
    console.log('  OK: llms.txt has expected content');
  }
}

if (failed) {
  process.exit(1);
}
console.log('All discoverability checks passed.');
process.exit(0);
