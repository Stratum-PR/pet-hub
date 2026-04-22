/**
 * Common Puerto Rico ABA routing numbers for ACH / direct deposit setup.
 * Users should confirm with their bank; numbers can change.
 */
export const PUERTO_RICO_BANK_ROUTING: readonly { routing: string; name: string }[] = [
  { routing: '021502011', name: 'Banco Popular de Puerto Rico' },
  { routing: '221571473', name: 'First Bank' },
  { routing: '221571415', name: 'Oriental Bank' },
  { routing: '021502341', name: 'Santander' },
  { routing: '021502383', name: 'Banco Cooperativo de Puerto Rico (Coop)' },
] as const;

const byRouting = new Map(PUERTO_RICO_BANK_ROUTING.map((b) => [b.routing, b]));

export function normalizeRoutingDigits(input: string): string {
  return input.replace(/\D/g, '').slice(0, 9);
}

export function findPuertoRicoBankByRouting(digits: string): { routing: string; name: string } | null {
  if (digits.length !== 9) return null;
  return byRouting.get(digits) ?? null;
}
