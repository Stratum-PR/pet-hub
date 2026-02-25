/**
 * Build-time script: generates sitemap.xml, robots.txt, and ai-routes.json into dist/.
 * Run after `vite build`. Uses VITE_PUBLIC_BASE_URL for absolute URLs (default: https://pet-hub.example.com).
 *
 * Usage: npx tsx scripts/generate-discoverability.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DISCOVERABLE_ROUTES, getPublicBaseUrl } from '../src/config/discoverable-routes';
import { PRICING_TIERS, FAQ_ENTRIES, PAGE_CONTENT } from '../src/content/discoverable-content';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

/** Paths must be relative (start with /) and must not contain protocol or newlines. */
function safePath(path: string): string {
  const p = path === '/' ? '/' : (path || '/').trim();
  if (p.startsWith('/') && !p.includes(':') && !/[\r\n]/.test(p)) return p;
  return '/';
}

function ensureDist() {
  if (!existsSync(distDir)) {
    console.warn('dist/ not found; run "vite build" first. Creating dist/ for artifact output.');
    mkdirSync(distDir, { recursive: true });
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemap() {
  const baseUrl = getPublicBaseUrl().replace(/\/$/, '');
  const now = new Date().toISOString().slice(0, 10);
  const entries = DISCOVERABLE_ROUTES.filter((r) => r.indexable !== false).map((r) => {
    const path = safePath(r.path);
    const loc = `${baseUrl}${path === '/' ? '' : path}`;
    const lastmod = now;
    const changefreq = r.changefreq ?? 'monthly';
    const priority = r.priority ?? 0.5;
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
  writeFileSync(join(distDir, 'sitemap.xml'), xml, 'utf-8');
  console.log('Wrote dist/sitemap.xml');
}

function generateRobots() {
  const baseUrl = getPublicBaseUrl().replace(/\/$/, '');
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const content = `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
  writeFileSync(join(distDir, 'robots.txt'), content, 'utf-8');
  console.log('Wrote dist/robots.txt');
}

function generateAiRoutes() {
  const baseUrl = getPublicBaseUrl().replace(/\/$/, '');
  const routes = DISCOVERABLE_ROUTES.map((r) => {
    const path = safePath(r.path);
    return {
      path: path || '/',
      url: `${baseUrl}${path === '/' ? '' : path}`,
      title: r.title,
      description: r.description,
      public: true,
    };
  });
  const json = JSON.stringify({ baseUrl, routes }, null, 2);
  writeFileSync(join(distDir, 'ai-routes.json'), json, 'utf-8');
  console.log('Wrote dist/ai-routes.json');
}

function generateLlmsTxt() {
  const baseUrl = getPublicBaseUrl().replace(/\/$/, '');
  const lines: string[] = [
    '# Pet Hub',
    '',
    'Pet Hub is a pet grooming business management platform. Manage appointments, clients, pets, inventory, and employees in one place.',
    '',
    '## Main links',
    ...DISCOVERABLE_ROUTES.filter((r) => r.indexable !== false).map((r) => {
      const path = safePath(r.path);
      const url = `${baseUrl}${path === '/' ? '' : path}`;
      return `- ${url} - ${r.description}`;
    }),
    '',
  ];
  // Full text of every page (so crawlers and AI get the whole site)
  for (const route of DISCOVERABLE_ROUTES.filter((r) => r.indexable !== false)) {
    const path = safePath(route.path);
    const url = `${baseUrl}${path === '/' ? '' : path}`;
    lines.push(`## Page: ${path || '/'}`, `URL: ${url}`, `Title: ${route.title}`, route.description, '');
    const content = PAGE_CONTENT[route.path];
    if (content?.sections?.length) {
      for (const sec of content.sections) {
        lines.push(`### ${sec.heading}`, sec.body, '');
      }
    }
  }
  lines.push('## For AI agents', 'You may fetch any URL above for full HTML, or use /content.json for structured text of every page.');
  writeFileSync(join(distDir, 'llms.txt'), lines.join('\n'), 'utf-8');
  console.log('Wrote dist/llms.txt');
}

function generateContentJson() {
  const baseUrl = getPublicBaseUrl().replace(/\/$/, '');
  const pages = DISCOVERABLE_ROUTES.map((r) => {
    const path = safePath(r.path);
    return {
      path: path || '/',
      url: `${baseUrl}${path === '/' ? '' : path}`,
      title: r.title,
      description: r.description,
      sections: PAGE_CONTENT[r.path]?.sections ?? [],
    };
  });
  const content = {
    baseUrl,
    pages,
    pricing: {
      note: 'All plans include a 14-day free trial.',
      tiers: PRICING_TIERS.map((t) => ({
        id: t.tier,
        name: t.name,
        price: t.price,
        description: t.description,
        features: t.features,
        popular: t.popular ?? false,
      })),
    },
    faq: FAQ_ENTRIES.map((f) => ({ question: f.question, answer: f.answer })),
    _meta: { generatedAt: new Date().toISOString() },
  };
  writeFileSync(join(distDir, 'content.json'), JSON.stringify(content, null, 2), 'utf-8');
  console.log('Wrote dist/content.json');
}

ensureDist();
generateSitemap();
generateRobots();
generateAiRoutes();
generateLlmsTxt();
generateContentJson();
