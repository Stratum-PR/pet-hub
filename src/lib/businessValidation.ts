/**
 * Validation for clients, pets, services, and appointments.
 * Used by useBusinessData hooks and UI for immediate feedback.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export type ValidationResult = { valid: true } | { valid: false; error: string };

// --- Client ---

export interface ClientInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  notes?: string | null;
}

export function validateClientPayload(payload: Partial<ClientInput>): ValidationResult {
  const first = payload.first_name?.trim();
  const last = payload.last_name?.trim();
  if (!first) return { valid: false, error: 'First name is required.' };
  if (!last) return { valid: false, error: 'Last name is required.' };
  if (!payload.phone?.trim()) return { valid: false, error: 'Phone is required.' };
  if (payload.email != null && payload.email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { valid: false, error: 'Invalid email format.' };
  }
  return { valid: true };
}

// --- Pet ---

export interface PetInput {
  client_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed?: string | null;
  birth_month?: number | null;
  birth_year?: number | null;
  weight?: number | null;
  color?: string | null;
  notes?: string | null;
  special_instructions?: string | null;
  vaccination_status?: 'up_to_date' | 'out_of_date' | 'unknown' | null;
  last_vaccination_date?: string | null;
  photo_url?: string | null;
}

const PET_SPECIES = new Set(['dog', 'cat', 'other']);
const PET_VACCINATION = new Set(['up_to_date', 'out_of_date', 'unknown']);

export function validatePetPayload(payload: Partial<PetInput>): ValidationResult {
  if (!payload.client_id || !isUuid(payload.client_id)) {
    return { valid: false, error: 'Valid client is required.' };
  }
  if (!payload.name?.trim()) return { valid: false, error: 'Pet name is required.' };
  if (!payload.species || !PET_SPECIES.has(payload.species)) {
    return { valid: false, error: 'Species must be dog, cat, or other.' };
  }
  if (payload.birth_month != null && (payload.birth_month < 1 || payload.birth_month > 12)) {
    return { valid: false, error: 'Birth month must be 1–12.' };
  }
  if (payload.birth_year != null && (payload.birth_year < 1900 || payload.birth_year > new Date().getFullYear())) {
    return { valid: false, error: 'Birth year is invalid.' };
  }
  if (payload.weight != null && payload.weight < 0) {
    return { valid: false, error: 'Weight cannot be negative.' };
  }
  if (payload.vaccination_status != null && payload.vaccination_status !== '' && !PET_VACCINATION.has(payload.vaccination_status)) {
    return { valid: false, error: 'Invalid vaccination status.' };
  }
  return { valid: true };
}

// --- Service ---

export interface ServiceInput {
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
  is_active?: boolean;
  category?: string | null;
  color?: string | null;
}

export function validateServicePayload(payload: Partial<ServiceInput>): ValidationResult {
  if (!payload.name?.trim()) return { valid: false, error: 'Service name is required.' };
  if (payload.price == null || payload.price < 0) return { valid: false, error: 'Price must be zero or greater.' };
  if (payload.duration_minutes == null || payload.duration_minutes < 1) {
    return { valid: false, error: 'Duration must be at least 1 minute.' };
  }
  return { valid: true };
}

// --- Appointment ---

export interface AppointmentInput {
  client_id: string;
  pet_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status?: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'canceled' | 'no_show';
  notes?: string | null;
  total_price?: number | null;
}

const APPOINTMENT_STATUS = new Set(['scheduled', 'confirmed', 'in_progress', 'completed', 'canceled', 'no_show']);
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateAppointmentPayload(payload: Partial<AppointmentInput>): ValidationResult {
  if (!payload.client_id || !isUuid(payload.client_id)) {
    return { valid: false, error: 'Valid client is required.' };
  }
  if (!payload.pet_id || !isUuid(payload.pet_id)) {
    return { valid: false, error: 'Valid pet is required.' };
  }
  if (!payload.service_id || !isUuid(payload.service_id)) {
    return { valid: false, error: 'Valid service is required.' };
  }
  if (!payload.appointment_date?.trim() || !DATE_REGEX.test(payload.appointment_date)) {
    return { valid: false, error: 'Appointment date must be YYYY-MM-DD.' };
  }
  if (!payload.start_time?.trim() || !TIME_REGEX.test(payload.start_time)) {
    return { valid: false, error: 'Start time must be HH:MM or HH:MM:SS.' };
  }
  if (!payload.end_time?.trim() || !TIME_REGEX.test(payload.end_time)) {
    return { valid: false, error: 'End time must be HH:MM or HH:MM:SS.' };
  }
  if (payload.status != null && !APPOINTMENT_STATUS.has(payload.status)) {
    return { valid: false, error: 'Invalid appointment status.' };
  }
  if (payload.total_price != null && payload.total_price < 0) {
    return { valid: false, error: 'Total price cannot be negative.' };
  }
  return { valid: true };
}
