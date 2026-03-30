import type { Business } from '@/lib/auth';

/** Canonical first screen for staff with role `employee` (business slug routes). */
export function getEmployeePostLoginPath(business: Pick<Business, 'slug'> | null | undefined): string {
  const slug = business?.slug?.trim();
  if (slug) return `/${slug}/clients`;
  return '/employee/hub';
}
