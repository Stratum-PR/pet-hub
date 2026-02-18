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

export interface TaxSettingRow {
  id: string;
  business_id: string;
  label: string;
  rate: number;
  enabled: boolean;
  region: string | null;
}

export interface ReceiptSettingRow {
  header_text: string | null;
  footer_text: string | null;
  logo_url: string | null;
  tagline: string | null;
  thank_you_message: string | null;
  return_policy: string | null;
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
