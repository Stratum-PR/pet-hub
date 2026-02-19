import { describe, it, expect } from 'vitest';
import {
  validateClientPayload,
  validatePetPayload,
  validateServicePayload,
  validateAppointmentPayload,
  type ClientInput,
  type PetInput,
  type ServiceInput,
  type AppointmentInput,
} from './businessValidation';

const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('validateClientPayload', () => {
  const valid: ClientInput = { first_name: 'Jane', last_name: 'Doe', phone: '7875551234' };

  it('returns valid for minimal valid payload', () => {
    expect(validateClientPayload(valid)).toEqual({ valid: true });
  });

  it('returns valid with email', () => {
    expect(validateClientPayload({ ...valid, email: 'jane@example.com' })).toEqual({ valid: true });
  });

  it('returns error when first_name is missing or empty', () => {
    expect(validateClientPayload({ ...valid, first_name: '' }).valid).toBe(false);
    expect(validateClientPayload({ ...valid, first_name: '   ' }).valid).toBe(false);
  });

  it('returns error when last_name is missing or empty', () => {
    expect(validateClientPayload({ ...valid, last_name: '' }).valid).toBe(false);
  });

  it('returns error when phone is missing or empty', () => {
    expect(validateClientPayload({ ...valid, phone: '' }).valid).toBe(false);
  });

  it('returns error for invalid email', () => {
    const r = validateClientPayload({ ...valid, email: 'not-an-email' });
    expect(r.valid).toBe(false);
    expect((r as { error: string }).error).toContain('email');
  });

  it('accepts null email', () => {
    expect(validateClientPayload({ ...valid, email: null })).toEqual({ valid: true });
  });
});

describe('validatePetPayload', () => {
  const valid: PetInput = { client_id: validUuid, name: 'Buddy', species: 'dog' };

  it('returns valid for minimal payload', () => {
    expect(validatePetPayload(valid)).toEqual({ valid: true });
  });

  it('returns valid for cat and other', () => {
    expect(validatePetPayload({ ...valid, species: 'cat' })).toEqual({ valid: true });
    expect(validatePetPayload({ ...valid, species: 'other' })).toEqual({ valid: true });
  });

  it('returns error when client_id is invalid', () => {
    expect(validatePetPayload({ ...valid, client_id: '' }).valid).toBe(false);
    expect(validatePetPayload({ ...valid, client_id: 'not-a-uuid' }).valid).toBe(false);
  });

  it('returns error when name is empty', () => {
    expect(validatePetPayload({ ...valid, name: '' }).valid).toBe(false);
  });

  it('returns error for invalid species', () => {
    expect(validatePetPayload({ ...valid, species: 'bird' as any }).valid).toBe(false);
  });

  it('returns error for birth_month out of range', () => {
    expect(validatePetPayload({ ...valid, birth_month: 0 }).valid).toBe(false);
    expect(validatePetPayload({ ...valid, birth_month: 13 }).valid).toBe(false);
  });

  it('returns error for negative weight', () => {
    expect(validatePetPayload({ ...valid, weight: -1 }).valid).toBe(false);
  });

  it('accepts valid optional fields', () => {
    expect(validatePetPayload({ ...valid, birth_month: 6, birth_year: 2020, weight: 10 })).toEqual({ valid: true });
  });
});

describe('validateServicePayload', () => {
  const valid: ServiceInput = { name: 'Grooming', price: 50, duration_minutes: 60 };

  it('returns valid for minimal payload', () => {
    expect(validateServicePayload(valid)).toEqual({ valid: true });
  });

  it('returns error when name is empty', () => {
    expect(validateServicePayload({ ...valid, name: '' }).valid).toBe(false);
  });

  it('returns error when price is negative', () => {
    expect(validateServicePayload({ ...valid, price: -1 }).valid).toBe(false);
  });

  it('accepts zero price', () => {
    expect(validateServicePayload({ ...valid, price: 0 })).toEqual({ valid: true });
  });

  it('returns error when duration_minutes is less than 1', () => {
    expect(validateServicePayload({ ...valid, duration_minutes: 0 }).valid).toBe(false);
  });
});

describe('validateAppointmentPayload', () => {
  const valid: AppointmentInput = {
    client_id: validUuid,
    pet_id: validUuid,
    service_id: validUuid,
    appointment_date: '2025-06-15',
    start_time: '09:00',
    end_time: '10:00',
  };

  it('returns valid for minimal payload', () => {
    expect(validateAppointmentPayload(valid)).toEqual({ valid: true });
  });

  it('returns error when client_id is invalid', () => {
    expect(validateAppointmentPayload({ ...valid, client_id: 'x' }).valid).toBe(false);
  });

  it('returns error when pet_id is invalid', () => {
    expect(validateAppointmentPayload({ ...valid, pet_id: '' }).valid).toBe(false);
  });

  it('returns error when service_id is invalid', () => {
    expect(validateAppointmentPayload({ ...valid, service_id: 'not-uuid' }).valid).toBe(false);
  });

  it('returns error for invalid date format', () => {
    expect(validateAppointmentPayload({ ...valid, appointment_date: '15/06/2025' }).valid).toBe(false);
    expect(validateAppointmentPayload({ ...valid, appointment_date: '' }).valid).toBe(false);
  });

  it('returns error for invalid start_time', () => {
    expect(validateAppointmentPayload({ ...valid, start_time: '25:00' }).valid).toBe(false);
    expect(validateAppointmentPayload({ ...valid, start_time: '9:00:00' }).valid).toBe(true);
  });

  it('returns error for invalid end_time', () => {
    expect(validateAppointmentPayload({ ...valid, end_time: '' }).valid).toBe(false);
  });

  it('returns error for invalid status', () => {
    expect(validateAppointmentPayload({ ...valid, status: 'pending' as any }).valid).toBe(false);
  });

  it('returns error for negative total_price', () => {
    expect(validateAppointmentPayload({ ...valid, total_price: -1 }).valid).toBe(false);
  });

  it('accepts valid status values', () => {
    for (const status of ['scheduled', 'confirmed', 'completed', 'canceled', 'no_show']) {
      expect(validateAppointmentPayload({ ...valid, status: status as any })).toEqual({ valid: true });
    }
  });
});
