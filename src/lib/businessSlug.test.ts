import { describe, expect, it } from 'vitest';
import {
  isReservedPublicSlug,
  isValidPublicSlugFormat,
  normalizePublicSlugInput,
  slugifyBusinessBase,
} from '@/lib/businessSlug';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';

describe('businessSlug', () => {
  it('slugifies base like postgres (ascii)', () => {
    expect(slugifyBusinessBase('  Paws & Claws! ')).toBe('paws-claws');
  });

  it('normalizes public slug input', () => {
    expect(normalizePublicSlugInput('  My_Shop!! ')).toBe('my-shop');
  });

  it('validates slug format', () => {
    expect(isValidPublicSlugFormat('a')).toBe(false);
    expect(isValidPublicSlugFormat('ab')).toBe(true);
    expect(isValidPublicSlugFormat('my-shop-2')).toBe(true);
    expect(isValidPublicSlugFormat('MyShop')).toBe(false);
  });

  it('reserves app routes', () => {
    expect(isReservedPublicSlug('admin')).toBe(true);
    expect(isReservedPublicSlug('demo')).toBe(true);
  });

  it('demo workspace slug is memorable', () => {
    expect(DEMO_WORKSPACE_SLUG).toBe('demo');
  });
});
