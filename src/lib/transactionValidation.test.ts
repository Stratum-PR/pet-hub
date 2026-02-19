import { describe, it, expect } from 'vitest';
import {
  validateCreatePayload,
  validateRefundPayload,
  validateUpdatePayload,
  type CreateTransactionPayload,
} from './transactionValidation';
import { getPaymentStatusLabel, getPaymentStatusFromAmount } from '@/types/transactions';

const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const minimalValidCreatePayload: CreateTransactionPayload = {
  customer_id: null,
  appointment_id: null,
  line_items: [
    { type: 'service', reference_id: validUuid, name: 'Test Service', quantity: 1, unit_price: 1000, line_total: 1000 },
  ],
  discount_amount: 0,
  discount_label: null,
  tip_amount: 0,
  payment_method: 'cash',
  payment_method_secondary: null,
  amount_tendered: 1000,
  change_given: 0,
  status: 'paid',
  notes: null,
};

describe('validateCreatePayload', () => {
  it('returns valid for minimal valid payload', () => {
    expect(validateCreatePayload(minimalValidCreatePayload)).toEqual({ valid: true });
  });

  it('returns error when line_items is empty', () => {
    const result = validateCreatePayload({ ...minimalValidCreatePayload, line_items: [] });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('at least one line item');
  });

  it('returns error when line_items has zero quantity', () => {
    const payload: CreateTransactionPayload = {
      ...minimalValidCreatePayload,
      line_items: [
        { type: 'service', reference_id: validUuid, name: 'X', quantity: 0, unit_price: 100, line_total: 0 },
      ],
    };
    const result = validateCreatePayload(payload);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('quantity');
  });

  it('returns error when line item has negative price', () => {
    const payload: CreateTransactionPayload = {
      ...minimalValidCreatePayload,
      line_items: [
        { type: 'service', reference_id: validUuid, name: 'X', quantity: 1, unit_price: -100, line_total: -100 },
      ],
    };
    const result = validateCreatePayload(payload);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('negative');
  });

  it('returns error when product line item has invalid reference_id', () => {
    const payload: CreateTransactionPayload = {
      ...minimalValidCreatePayload,
      line_items: [
        { type: 'product', reference_id: 'not-a-uuid', name: 'X', quantity: 1, unit_price: 100, line_total: 100 },
      ],
    };
    const result = validateCreatePayload(payload);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('product');
  });

  it('accepts service line item with non-UUID reference_id (e.g. appointment)', () => {
    const payload: CreateTransactionPayload = {
      ...minimalValidCreatePayload,
      line_items: [
        { type: 'service', reference_id: 'appointment', name: 'Appointment', quantity: 1, unit_price: 5000, line_total: 5000 },
      ],
    };
    expect(validateCreatePayload(payload)).toEqual({ valid: true });
  });

  it('returns error when discount_amount is negative', () => {
    const result = validateCreatePayload({ ...minimalValidCreatePayload, discount_amount: -100 });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Discount');
  });

  it('returns error when customer_id is invalid UUID', () => {
    const result = validateCreatePayload({ ...minimalValidCreatePayload, customer_id: 'invalid' });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('customer');
  });

  it('accepts null customer_id and appointment_id', () => {
    expect(validateCreatePayload({ ...minimalValidCreatePayload, customer_id: null, appointment_id: null })).toEqual({
      valid: true,
    });
  });
});

describe('validateRefundPayload', () => {
  it('returns valid for amount within total and empty restock', () => {
    expect(validateRefundPayload(500, 1000, [], [])).toEqual({ valid: true });
  });

  it('returns error when amount is zero', () => {
    const result = validateRefundPayload(0, 1000, [], []);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('greater than zero');
  });

  it('returns error when amount exceeds transaction total', () => {
    const result = validateRefundPayload(1500, 1000, [], []);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('exceed');
  });

  it('returns valid when amount equals total', () => {
    expect(validateRefundPayload(1000, 1000, [], [])).toEqual({ valid: true });
  });

  it('returns error when restock product ID is not on transaction', () => {
    const otherUuid = 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const result = validateRefundPayload(500, 1000, [validUuid], [otherUuid]);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('line item');
  });

  it('returns valid when restock IDs are subset of product line item refs', () => {
    expect(validateRefundPayload(500, 1000, [validUuid], [validUuid])).toEqual({ valid: true });
  });
});

describe('validateUpdatePayload', () => {
  it('returns valid for empty patch', () => {
    expect(validateUpdatePayload({})).toEqual({ valid: true });
  });

  it('returns error when total is negative', () => {
    const result = validateUpdatePayload({ total: -100 });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Total');
  });

  it('returns error when amount_tendered is negative', () => {
    const result = validateUpdatePayload({ amount_tendered: -50 });
    expect(result.valid).toBe(false);
  });

  it('returns error when status is invalid', () => {
    const result = validateUpdatePayload({ status: 'invalid_status' as any });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('status');
  });

  it('accepts valid statuses', () => {
    expect(validateUpdatePayload({ status: 'paid' })).toEqual({ valid: true });
    expect(validateUpdatePayload({ status: 'void' })).toEqual({ valid: true });
    expect(validateUpdatePayload({ status: 'partial' })).toEqual({ valid: true });
  });
});

describe('getPaymentStatusLabel', () => {
  it('returns Unpaid when amountPaid is 0', () => {
    expect(getPaymentStatusLabel(0, 100)).toBe('Unpaid');
  });
  it('returns Partial when amountPaid is less than total', () => {
    expect(getPaymentStatusLabel(50, 100)).toBe('Partial');
  });
  it('returns Paid when amountPaid equals total', () => {
    expect(getPaymentStatusLabel(100, 100)).toBe('Paid');
  });
  it('returns Paid when amountPaid exceeds total', () => {
    expect(getPaymentStatusLabel(150, 100)).toBe('Paid');
  });
});

describe('getPaymentStatusFromAmount', () => {
  it('returns pending when amountPaid is 0', () => {
    expect(getPaymentStatusFromAmount(0, 100)).toBe('pending');
  });
  it('returns partial when amountPaid is less than total', () => {
    expect(getPaymentStatusFromAmount(50, 100)).toBe('partial');
  });
  it('returns paid when amountPaid equals total', () => {
    expect(getPaymentStatusFromAmount(100, 100)).toBe('paid');
  });
});
