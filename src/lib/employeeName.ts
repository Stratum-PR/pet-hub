import type { Employee } from '@/types';

/** Display full name: prefers split fields when present, else legacy `name`. */
export function employeeFullName(e: Pick<Employee, 'name' | 'first_name' | 'last_name'>): string {
  const fn = (e.first_name ?? '').trim();
  const ln = (e.last_name ?? '').trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
  return (e.name ?? '').trim();
}
