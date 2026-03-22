import type { Transaction, TransactionLineItem } from '@/types/transactions';

/** Stable local demo transaction ids (sessionStorage seed, no server). */
const LOCAL_TX_IDS = ['local-demo-seed-tx-1', 'local-demo-seed-tx-2', 'local-demo-seed-tx-3'] as const;

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(14, 30, 0, 0);
  return d.toISOString();
}

function entry(
  businessId: string,
  index: 0 | 1 | 2,
  createdAt: string,
  serviceName: string,
  cents: number,
  appointmentId: string | null
): { transaction: Transaction; lineItems: TransactionLineItem[] } {
  const id = LOCAL_TX_IDS[index];
  const txn: Transaction = {
    id,
    business_id: businessId,
    customer_id: null,
    appointment_id: appointmentId,
    staff_id: null,
    created_at: createdAt,
    status: 'paid',
    payment_method: 'card',
    payment_method_secondary: null,
    subtotal: cents,
    discount_amount: 0,
    discount_label: null,
    tax_snapshot: null,
    tip_amount: 0,
    total: cents,
    amount_tendered: cents,
    change_given: null,
    notes: 'Demo sample sale',
    transaction_number: index + 1,
  };
  const lineItems: TransactionLineItem[] = [
    {
      id: `${id}-li-1`,
      transaction_id: id,
      type: 'service',
      reference_id: null,
      name: serviceName,
      quantity: 1,
      unit_price: cents,
      line_total: cents,
    },
  ];
  return { transaction: txn, lineItems };
}

/**
 * Sample paid service transactions for logged-out /demo POS (sessionStorage).
 * Dates are relative to “today” so dashboard charts stay fresh.
 */
export function buildDefaultDemoTransactionSeed(
  businessId: string
): { transaction: Transaction; lineItems: TransactionLineItem[] }[] {
  return [
    entry(businessId, 0, daysAgoIso(5), 'Arreglo Completo', 6500, null),
    entry(businessId, 1, daysAgoIso(2), 'Baño Básico', 3500, null),
    entry(businessId, 2, daysAgoIso(1), 'Corte de Uñas', 1500, null),
  ];
}
