/**
 * Single source of truth for public routes used by:
 * - Per-route meta (Helmet)
 * - Sitemap generator
 * - ai-routes.json generator
 * - llms.txt and content.json
 *
 * When you add a new public page: add an entry here, then add its full text in
 * PAGE_CONTENT[path] in src/content/discoverable-content.ts so crawlers get the whole page.
 *
 * SECURITY: Do not put secrets, API keys, or PII in route title/description. This data
 * is served in sitemap, llms.txt, content.json, and meta tags. Paths must start with /.
 */

export interface DiscoverableRoute {
  path: string;
  title: string;
  description: string;
  /** If true, include in sitemap and allow indexing (default: true for marketing pages) */
  indexable?: boolean;
  /** If true, add noindex meta (e.g. for login/register to avoid indexing form pages) */
  noindex?: boolean;
  /** Optional sitemap changefreq */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Optional sitemap priority 0–1 */
  priority?: number;
}

export const DISCOVERABLE_ROUTES: DiscoverableRoute[] = [
  {
    path: '/',
    title: 'Pet Hub – Pet Grooming Business Management',
    description: 'Pet Hub - Pet Grooming Business Management. Manage appointments, clients, pets, and more.',
    indexable: true,
    changefreq: 'weekly',
    priority: 1,
  },
  {
    path: '/pricing',
    title: 'Pricing – Pet Hub',
    description: 'Simple, transparent pricing for pet grooming businesses. Choose the plan that fits. All plans include a 14-day free trial.',
    indexable: true,
    changefreq: 'monthly',
    priority: 0.9,
  },
  {
    path: '/login',
    title: 'Log in – Pet Hub',
    description: 'Log in to your Pet Hub account.',
    indexable: true,
    noindex: true,
    changefreq: 'monthly',
    priority: 0.5,
  },
  {
    path: '/registrarse',
    title: 'Sign up – Pet Hub',
    description: 'Create your Pet Hub account. Sign up as a business owner or client.',
    indexable: true,
    noindex: true,
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    path: '/signup/success',
    title: 'Signup successful – Pet Hub',
    description: 'Your Pet Hub account has been created. Check your email to activate.',
    indexable: true,
    noindex: true,
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/cliente',
    title: 'Client portal – Pet Hub',
    description: 'Pet Hub client portal. View your appointments and pet care info.',
    indexable: true,
    noindex: false,
    changefreq: 'weekly',
    priority: 0.5,
  },
  {
    path: '/demo',
    title: 'Demo – Pet Hub',
    description: 'Try Pet Hub with our interactive demo. No signup required.',
    indexable: true,
    changefreq: 'monthly',
    priority: 0.8,
  },
];

/** Routes that are public but we do not list in sitemap (e.g. auth callback) */
export const PUBLIC_NON_INDEXABLE_PATHS = ['/auth/callback'];

const SAFE_ORIGIN_REGEX = /^https?:\/\/[^/?#\s<>"']+\/?$/;

/**
 * Returns a safe base URL for canonical, og:url, and sitemap. Rejects non-http(s) or malformed
 * values to prevent open redirect / script injection via meta tags or generated files.
 */
function sanitizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed || /[\s<>"']/.test(trimmed)) return 'https://pet-hub.example.com';
  if (SAFE_ORIGIN_REGEX.test(trimmed)) return trimmed;
  if (typeof window !== 'undefined' && trimmed === window.location.origin) return trimmed;
  return 'https://pet-hub.example.com';
}

/** For use in meta/canonical URLs: path must start with / and not contain protocol or newlines. */
export function safePathForUrl(path: string): string {
  const p = path === '/' ? '/' : (path || '/').trim();
  if (p.startsWith('/') && !p.includes(':') && !/[\r\n]/.test(p)) return p;
  return '/';
}

/** Base URL for canonical and OG tags. Set at build time via VITE_PUBLIC_BASE_URL. */
export function getPublicBaseUrl(): string {
  const fromEnv =
    (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_PUBLIC_BASE_URL?: string } })?.env?.VITE_PUBLIC_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_PUBLIC_BASE_URL);
  if (fromEnv && typeof fromEnv === 'string') return sanitizeBaseUrl(fromEnv);
  if (typeof window !== 'undefined' && window.location?.origin) return sanitizeBaseUrl(window.location.origin);
  return 'https://pet-hub.example.com';
}

/** Default OG image path (resolved to absolute URL in PageMeta using getPublicBaseUrl) */
export const DEFAULT_OG_IMAGE = '/pet-hub-icon.svg';

export type { DiscoverableRoute as SitemapEntry };
