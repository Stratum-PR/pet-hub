import type { SupabaseClient } from '@supabase/supabase-js';
import type { Business } from '@/lib/auth';

/** Match Postgres `slugify` in signup migrations (accent strip + alnum + hyphens). */
export function slugifyBusinessBase(name: string): string {
  const stripped = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return stripped || 'negocio';
}

/** Reserved URL segments (app routes, marketing, auth). */
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'assets',
  'auth',
  'cliente',
  'demo',
  'login',
  'pricing',
  'registrarse',
  'signup',
  'static',
  'null',
  'undefined',
]);

export function isReservedPublicSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Normalize user-entered public slug (same rules as name slugify). */
export function normalizePublicSlugInput(raw: string): string {
  return slugifyBusinessBase(raw);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidPublicSlugFormat(slug: string): boolean {
  if (!slug || slug.length < 2 || slug.length > 80) return false;
  return SLUG_PATTERN.test(slug);
}

/** Resolve a row by `businesses.slug` or legacy `business_slug_aliases.old_slug`. */
export async function fetchBusinessByPublicSlug(
  client: SupabaseClient,
  slug: string,
): Promise<Business | null> {
  const { data: direct, error: dErr } = await client.from('businesses').select('*').eq('slug', slug).maybeSingle();
  if (dErr) return null;
  if (direct) return direct as Business;

  const { data: alias, error: aErr } = await client
    .from('business_slug_aliases')
    .select('business_id')
    .eq('old_slug', slug)
    .maybeSingle();
  if (aErr || !alias?.business_id) return null;

  const { data: biz, error: bErr } = await client
    .from('businesses')
    .select('*')
    .eq('id', alias.business_id)
    .maybeSingle();
  if (bErr || !biz) return null;
  return biz as Business;
}

/**
 * True if another business already uses this slug.
 * Uses a SECURITY DEFINER RPC — direct `businesses` SELECT is hidden by RLS for other tenants.
 */
export async function isPublicSlugTakenByOtherBusiness(
  client: SupabaseClient,
  slug: string,
  ownBusinessId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('is_public_business_slug_taken_by_other', {
    p_slug: slug,
    p_own_business_id: ownBusinessId,
  });
  if (error) {
    if (import.meta.env.DEV) console.warn('[businessSlug] is_public_business_slug_taken_by_other', error);
    return true;
  }
  return data === true;
}
