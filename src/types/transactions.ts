/** All monetary values in cents (integer). */

export type TransactionStatus =
  | 'pending'
  | 'in_progress'
  | 'paid'
  | 'partial'
  | 'refunded'
  | 'partial_refund'
  | 'void';

export type PaymentMethod = 'cash' | 'card' | 'ath_movil' | 'other';

export interface Transaction {
  id: string;
  business_id: string;
  customer_id: string | null;
  appointment_id: string | null;
  staff_id: string | null;
  created_at: string;
  status: TransactionStatus;
  payment_method: PaymentMethod;
  payment_method_secondary: PaymentMethod | null;
  subtotal: number;
  discount_amount: number;
  discount_label: string | null;
  tax_snapshot: TaxSnapshotItem[] | null;
  tip_amount: number;
  total: number;
  amount_tendered: number | null;
  change_given: number | null;
  notes: string | null;
  transaction_number: number | null;
}

export interface TaxSnapshotItem {
  label: string;
  rate: number;
  amount: number;
}

export interface TransactionLineItem {
  id: string;
  transaction_id: string;
  type: 'product' | 'service';
  reference_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface TransactionRefund {
  id: string;
  transaction_id: string;
  amount: number;
  reason: string | null;
  created_at: string;
  staff_id: string | null;
  restock_applied: boolean;
}

export type TaxAppliesTo = 'both' | 'service' | 'product';

export interface TaxSettingRow {
  id: string;
  business_id: string;
  label: string;
  rate: number;
  enabled: boolean;
  region: string | null;
  sort_order?: number;
  applies_to?: TaxAppliesTo;
}

export interface ReceiptSettingRow {
  header_text: string | null;
  footer_text: string | null;
  logo_url: string | null;
  tagline: string | null;
  thank_you_message: string | null;
  return_policy: string | null;
  receipt_phone: string | null;
  receipt_location: string | null;
}

/** One entry in transaction edit history. */
export interface TransactionHistoryEntry {
  id: string;
  transaction_id: string;
  business_id: string;
  changed_at: string;
  changed_by_user_id: string | null;
  /** Display name for who made the change (from profiles). */
  changed_by_display?: string | null;
  change_summary: { field: string; old_value: unknown; new_value: unknown }[];
}

/** Payment status label from amount paid vs total. Use amount_tendered ?? 0 as amountPaid. */
export function getPaymentStatusLabel(amountPaid: number, total: number): 'Unpaid' | 'Partial' | 'Paid' {
  if (amountPaid === 0) return 'Unpaid';
  if (amountPaid < total) return 'Partial';
  return 'Paid';
}

/** DB status value for payment state (pending = Unpaid, partial = Partial, paid = Paid). */
export function getPaymentStatusFromAmount(amountPaid: number, total: number): 'pending' | 'partial' | 'paid' {
  if (amountPaid === 0) return 'pending';
  if (amountPaid < total) return 'partial';
  return 'paid';
}

/** Line item for building a new transaction (before save). */
export interface TransactionLineItemInput {
  type: 'product' | 'service';
  reference_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}
