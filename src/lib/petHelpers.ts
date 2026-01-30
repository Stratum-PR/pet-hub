/**
 * Utility functions for pet data management
 */

/**
 * Calculate pet age in years from birth month and year
 * Accounts for whether the birthday has occurred this year yet
 */
export function calculatePetAge(birthMonth: number | null, birthYear: number | null): number | null {
  if (birthMonth === null || birthYear === null) {
    return null;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
  const currentYear = now.getFullYear();

  let age = currentYear - birthYear;

  // If birthday hasn't occurred this year yet, subtract 1
  if (currentMonth < birthMonth) {
    age -= 1;
  }

  return Math.max(0, age);
}

/**
 * Format age for display in Spanish
 * - "1 año" (singular)
 * - "X años" (plural)
 * - "Menos de 1 año" (for 0 or null)
 */
export function formatAgeSpanish(age: number | null): string {
  if (age === null || age === undefined) {
    return 'Menos de 1 año';
  }

  if (age === 0) {
    return 'Menos de 1 año';
  }

  if (age === 1) {
    return '1 año';
  }

  return `${age} años`;
}

/**
 * Format age from birth month/year for display in Spanish
 */
export function formatAgeFromBirth(birthMonth: number | null, birthYear: number | null): string {
  const age = calculatePetAge(birthMonth, birthYear);
  return formatAgeSpanish(age);
}

/**
 * Determine vaccination status from date
 * Vaccines are valid for 12 months
 */
export function calculateVaccinationStatus(lastVaccinationDate: string | null | undefined): 'up_to_date' | 'out_of_date' | 'unknown' {
  if (!lastVaccinationDate) {
    return 'unknown';
  }

  const vaccinationDate = new Date(lastVaccinationDate);
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  if (vaccinationDate >= twelveMonthsAgo) {
    return 'up_to_date';
  }

  return 'out_of_date';
}

/**
 * Format vaccination status for display in Spanish
 */
export function formatVaccinationStatusSpanish(status: string | null | undefined): string {
  switch (status) {
    case 'up_to_date':
      return 'Al día';
    case 'out_of_date':
      return 'Vencido';
    case 'unknown':
    default:
      return 'Desconocido';
  }
}

/**
 * Get vaccination status color class for UI
 */
export function getVaccinationStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'up_to_date':
      return 'bg-green-100 text-green-800';
    case 'out_of_date':
      return 'bg-red-100 text-red-800';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Spanish month names
 */
export const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Get Spanish month name by number (1-12)
 */
export function getSpanishMonthName(month: number | null): string {
  if (month === null || month < 1 || month > 12) {
    return '';
  }
  return SPANISH_MONTHS[month - 1];
}
