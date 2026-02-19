/**
 * Centralized validation for transaction create, update, and refund.
 * Used by useTransactions and by UI for immediate feedback.
 */

import type { TransactionLineItemInput, TransactionStatus } from '@/types/transactions';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidOrNull(value: string | null): boolean {
  if (value === null || value === '') return true;
  return UUID_REGEX.test(value);
}

export interface CreateTransactionPayload {
  customer_id: string | null;
  appointment_id: string | null;
  line_items: TransactionLineItemInput[];
  discount_amount: number;
  discount_label: string | null;
  tip_amount: number;
  payment_method: string;
  payment_method_secondary: string | null;
  amount_tendered: number | null;
  change_given: number | null;
  status: TransactionStatus;
  notes: string | null;
}

export type ValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Validate payload for creating a transaction.
 */
export function validateCreatePayload(payload: CreateTransactionPayload): ValidationResult {
  if (!payload.line_items || payload.line_items.length === 0) {
    return { valid: false, error: 'Add at least one line item.' };
  }

  for (const li of payload.line_items) {
    if (li.quantity < 1) return { valid: false, error: 'Each line item must have quantity at least 1.' };
    if (li.unit_price < 0) return { valid: false, error: 'Line item price cannot be negative.' };
    if (li.line_total < 0) return { valid: false, error: 'Line item total cannot be negative.' };
    if (!li.name?.trim()) return { valid: false, error: 'Line item name is required.' };
    if (li.type === 'product' && !isUuidOrNull(li.reference_id)) {
      return { valid: false, error: 'Product line item must have a valid product reference.' };
    }
  }

  if (payload.discount_amount < 0) return { valid: false, error: 'Discount cannot be negative.' };
  if (payload.tip_amount < 0) return { valid: false, error: 'Tip cannot be negative.' };
  if (payload.amount_tendered != null && payload.amount_tendered < 0) {
    return { valid: false, error: 'Amount tendered cannot be negative.' };
  }
  if (payload.change_given != null && payload.change_given < 0) {
    return { valid: false, error: 'Change given cannot be negative.' };
  }

  if (!isUuidOrNull(payload.customer_id)) return { valid: false, error: 'Invalid customer ID.' };
  if (!isUuidOrNull(payload.appointment_id)) return { valid: false, error: 'Invalid appointment ID.' };

  return { valid: true };
}

/**
 * Validate refund request: amount and restock product IDs.
 */
export function validateRefundPayload(
  amountCents: number,
  transactionTotal: number,
  restockProductIds: string[],
  productLineItemReferenceIds: string[]
): ValidationResult {
  if (amountCents <= 0) return { valid: false, error: 'Refund amount must be greater than zero.' };
  if (amountCents > transactionTotal) {
    return { valid: false, error: 'Refund amount cannot exceed transaction total.' };
  }

  const validRefIds = new Set(productLineItemReferenceIds);
  for (const id of restockProductIds) {
    if (!isUuidOrNull(id)) return { valid: false, error: 'Invalid product ID for restock.' };
    if (!validRefIds.has(id)) {
      return { valid: false, error: 'Restock product must be a product line item on this transaction.' };
    }
  }

  return { valid: true };
}

export type TransactionUpdatePatch = Partial<{
  payment_method: string;
  payment_method_secondary: string | null;
  total: number;
  amount_tendered: number | null;
  change_given: number | null;
  notes: string | null;
  status: TransactionStatus;
}>;

/**
 * Validate update patch for a transaction.
 */
export function validateUpdatePayload(patch: TransactionUpdatePatch): ValidationResult {
  if (patch.total != null && patch.total < 0) {
    return { valid: false, error: 'Total cannot be negative.' };
  }
  if (patch.amount_tendered != null && patch.amount_tendered < 0) {
    return { valid: false, error: 'Amount tendered cannot be negative.' };
  }
  if (patch.change_given != null && patch.change_given < 0) {
    return { valid: false, error: 'Change given cannot be negative.' };
  }
  const validStatuses: TransactionStatus[] = [
    'pending', 'in_progress', 'paid', 'partial', 'refunded', 'partial_refund', 'void'
  ];
  if (patch.status != null && !validStatuses.includes(patch.status)) {
    return { valid: false, error: 'Invalid status.' };
  }
  return { valid: true };
}
