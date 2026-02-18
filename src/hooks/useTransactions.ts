import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from './useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Transaction,
  TransactionLineItem,
  TransactionLineItemInput,
  TransactionRefund,
  TransactionStatus,
  PaymentMethod,
  TaxSettingRow,
  TaxSnapshotItem,
} from '@/types/transactions';

function mapRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    business_id: row.business_id,
    customer_id: row.customer_id ?? null,
    appointment_id: row.appointment_id ?? null,
    staff_id: row.staff_id ?? null,
    created_at: row.created_at,
    status: row.status,
    payment_method: row.payment_method,
    payment_method_secondary: row.payment_method_secondary ?? null,
    subtotal: Number(row.subtotal ?? 0),
    discount_amount: Number(row.discount_amount ?? 0),
    discount_label: row.discount_label ?? null,
    tax_snapshot: Array.isArray(row.tax_snapshot) ? row.tax_snapshot : null,
    tip_amount: Number(row.tip_amount ?? 0),
    total: Number(row.total ?? 0),
    amount_tendered: row.amount_tendered != null ? Number(row.amount_tendered) : null,
    change_given: row.change_given != null ? Number(row.change_given) : null,
    notes: row.notes ?? null,
    transaction_number: row.transaction_number ?? null,
  };
}

function mapRowToLineItem(row: any): TransactionLineItem {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    type: row.type,
    reference_id: row.reference_id ?? null,
    name: row.name,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
  };
}

function isDemoLocalMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/demo');
}

const DEMO_TX_STORAGE_KEY = 'pet-hub-demo-transactions';

function getDemoStorageKey(businessId: string): string {
  return `${DEMO_TX_STORAGE_KEY}-${businessId}`;
}

function loadDemoEntriesFromStorage(businessId: string): { transaction: Transaction; lineItems: TransactionLineItem[] }[] {
  try {
    const raw = sessionStorage.getItem(getDemoStorageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useTransactions() {
  const businessId = useBusinessId();
  const { user } = useAuth();
  const [serverTransactions, setServerTransactions] = useState<Transaction[]>([]);
  const [localDemoEntries, setLocalDemoEntries] = useState<{ transaction: Transaction; lineItems: TransactionLineItem[] }[]>([]);
  const localDemoEntriesRef = useRef(localDemoEntries);
  localDemoEntriesRef.current = localDemoEntries;
  const [loading, setLoading] = useState(true);

  // Sync demo transactions from sessionStorage when on demo route so list and detail see them
  useEffect(() => {
    if (isDemoLocalMode() && businessId) {
      const stored = loadDemoEntriesFromStorage(businessId);
      setLocalDemoEntries(stored);
    }
  }, [businessId]);

  const transactions = [
    ...localDemoEntries.map((e) => e.transaction),
    ...serverTransactions.filter((t) => !t.id.startsWith('local-')),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const fetchTransactions = useCallback(async () => {
    if (!businessId) return;
    const { data, error } = await supabase
      .from('transactions' as any)
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (!error && data) setServerTransactions((data as any[]).map(mapRowToTransaction));
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    fetchTransactions();
  }, [businessId, fetchTransactions]);

  const fetchTransactionById = async (id: string): Promise<{ transaction: Transaction; lineItems: TransactionLineItem[] } | null> => {
    if (id.startsWith('local-')) {
      const entry = localDemoEntriesRef.current.find((e) => e.transaction.id === id);
      return entry ? { transaction: entry.transaction, lineItems: entry.lineItems } : null;
    }
    const { data: txn, error: txnError } = await supabase
      .from('transactions' as any)
      .select('*')
      .eq('id', id)
      .eq('business_id', businessId!)
      .single();
    if (txnError || !txn) return null;
    const { data: items, error: itemsError } = await supabase
      .from('transaction_line_items' as any)
      .select('*')
      .eq('transaction_id', id);
    const lineItems = !itemsError && items ? (items as any[]).map(mapRowToLineItem) : [];
    return { transaction: mapRowToTransaction(txn), lineItems };
  };

  const fetchTaxSettings = async (): Promise<TaxSettingRow[]> => {
    if (!businessId) return [];
    const { data, error } = await supabase
      .from('tax_settings' as any)
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    return data as TaxSettingRow[];
  };

  const fetchReceiptSettings = async () => {
    if (!businessId) return null;
    const { data, error } = await supabase
      .from('receipt_settings' as any)
      .select('header_text, footer_text, logo_url, tagline, thank_you_message, return_policy')
      .eq('business_id', businessId)
      .maybeSingle();
    if (error || !data) return null;
    return data as any;
  };

  /** Compute tax snapshot and amounts from taxable amount (cents). Returns { taxSnapshot, totalTaxCents }. Uses PR state+municipal default when no tax_settings. */
  const computeTax = async (taxableCents: number): Promise<{ taxSnapshot: TaxSnapshotItem[]; totalTaxCents: number }> => {
    const rows = await fetchTaxSettings();
    const taxSnapshot: TaxSnapshotItem[] = [];
    let totalTaxCents = 0;
    const defaultPR: TaxSettingRow[] = [
      { label: 'State (IVU)', rate: 10.5, enabled: true, sort_order: 0 } as TaxSettingRow,
      { label: 'Municipal', rate: 1, enabled: true, sort_order: 1 } as TaxSettingRow,
    ];
    const effectiveRows = rows.length > 0 ? rows : defaultPR;
    for (const row of effectiveRows) {
      const rate = Number(row.rate);
      const amount = Math.round((taxableCents * rate) / 100);
      taxSnapshot.push({ label: row.label, rate, amount });
      totalTaxCents += amount;
    }
    return { taxSnapshot, totalTaxCents };
  };

  interface CreateTransactionPayload {
    customer_id: string | null;
    appointment_id: string | null;
    line_items: TransactionLineItemInput[];
    discount_amount: number;
    discount_label: string | null;
    tip_amount: number;
    payment_method: PaymentMethod;
    payment_method_secondary: PaymentMethod | null;
    amount_tendered: number | null;
    change_given: number | null;
    status: TransactionStatus;
    notes: string | null;
  }

  const createTransaction = async (payload: CreateTransactionPayload): Promise<{ data: Transaction | null; error: string | null }> => {
    if (!businessId) return { data: null, error: 'No business selected.' };
    const subtotalCents = payload.line_items.reduce((sum, li) => sum + li.line_total, 0);
    const taxableCents = Math.max(0, subtotalCents - payload.discount_amount);
    const { taxSnapshot, totalTaxCents } = await computeTax(taxableCents);
    const totalCents = taxableCents + totalTaxCents + payload.tip_amount;

    const isDemoLocal = isDemoLocalMode() && !user?.id;
    if (isDemoLocal) {
      const localId = 'local-' + crypto.randomUUID();
      const currentEntries = localDemoEntriesRef.current;
      const localNum = currentEntries.length + 1;
      const created: Transaction = {
        id: localId,
        business_id: businessId,
        customer_id: payload.customer_id,
        appointment_id: payload.appointment_id,
        staff_id: null,
        created_at: new Date().toISOString(),
        status: payload.status,
        payment_method: payload.payment_method,
        payment_method_secondary: payload.payment_method_secondary,
        subtotal: subtotalCents,
        discount_amount: payload.discount_amount,
        discount_label: payload.discount_label,
        tax_snapshot: taxSnapshot,
        tip_amount: payload.tip_amount,
        total: totalCents,
        amount_tendered: payload.amount_tendered,
        change_given: payload.change_given,
        notes: payload.notes,
        transaction_number: localNum,
      };
      const lineItems: TransactionLineItem[] = payload.line_items.map((li, i) => ({
        id: `local-li-${localId}-${i}`,
        transaction_id: localId,
        type: li.type,
        reference_id: li.reference_id,
        name: li.name,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      }));
      const newList = [{ transaction: created, lineItems }, ...currentEntries];
      setLocalDemoEntries(newList);
      sessionStorage.setItem(getDemoStorageKey(businessId), JSON.stringify(newList));
      return { data: created, error: null, lineItems };
    }

    if (!user?.id) return { data: null, error: 'You must be signed in to create a transaction.' };

    const txnPayload = {
      business_id: businessId,
      customer_id: payload.customer_id,
      appointment_id: payload.appointment_id,
      staff_id: user.id,
      status: payload.status,
      payment_method: payload.payment_method,
      payment_method_secondary: payload.payment_method_secondary,
      subtotal: subtotalCents,
      discount_amount: payload.discount_amount,
      discount_label: payload.discount_label,
      tax_snapshot: taxSnapshot,
      tip_amount: payload.tip_amount,
      total: totalCents,
      amount_tendered: payload.amount_tendered,
      change_given: payload.change_given,
      notes: payload.notes,
    };

    const { data: txn, error: txnError } = await supabase
      .from('transactions' as any)
      .insert(txnPayload)
      .select()
      .single();
    if (txnError) {
      console.error('[useTransactions] createTransaction insert error', txnError);
      return { data: null, error: txnError.message || 'Failed to create transaction.' };
    }
    if (!txn) return { data: null, error: 'Failed to create transaction.' };

    const txnId = (txn as any).id;
    for (const li of payload.line_items) {
      await supabase.from('transaction_line_items' as any).insert({
        transaction_id: txnId,
        type: li.type,
        reference_id: li.reference_id,
        name: li.name,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      });
    }

    for (const li of payload.line_items) {
      if (li.type === 'product') {
        const { data: product } = await supabase.from('inventory' as any).select('quantity_on_hand').eq('id', li.reference_id).eq('business_id', businessId).single();
        const qty = product?.quantity_on_hand ?? 0;
        const newQty = Math.max(0, qty - li.quantity);
        await supabase.from('inventory' as any).update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() }).eq('id', li.reference_id).eq('business_id', businessId);
        await supabase.from('inventory_stock_movements' as any).insert({
          business_id: businessId,
          product_id: li.reference_id,
          quantity: -li.quantity,
          movement_type: 'sale',
          notes: `Transaction ${(txn as any).transaction_number ?? txnId}`,
        });
      }
    }

    if (payload.appointment_id) {
      await supabase.from('appointments' as any).update({ transaction_id: txnId, billed: true, updated_at: new Date().toISOString() }).eq('id', payload.appointment_id);
    }

    const created = mapRowToTransaction(txn);
    setServerTransactions((prev) => [created, ...prev]);
    return { data: created, error: null };
  };

  const updateTransactionStatus = async (id: string, status: TransactionStatus): Promise<boolean> => {
    if (!businessId) return false;
    const { error } = await supabase.from('transactions' as any).update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('business_id', businessId);
    if (!error) {
      setServerTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      return true;
    }
    if (id.startsWith('local-')) {
      setLocalDemoEntries((prev) => prev.map((e) => (e.transaction.id === id ? { ...e, transaction: { ...e.transaction, status } } : e)));
      return true;
    }
    return false;
  };

  const createRefund = async (
    transactionId: string,
    amountCents: number,
    reason: string | null,
    restockProductIds: string[]
  ): Promise<TransactionRefund | null> => {
    if (!businessId) return null;
    if (transactionId.startsWith('local-') && isDemoLocalMode()) {
      const entry = localDemoEntriesRef.current.find((e) => e.transaction.id === transactionId);
      if (!entry) return null;
      const newStatus = amountCents >= entry.transaction.total ? 'refunded' : 'partial_refund';
      setLocalDemoEntries((prev) => prev.map((e) => (e.transaction.id === transactionId ? { ...e, transaction: { ...e.transaction, status: newStatus } } : e)));
      return { id: 'local-refund-' + crypto.randomUUID(), transaction_id: transactionId, amount: amountCents, reason, created_at: new Date().toISOString(), staff_id: null, restock_applied: false };
    }
    if (!user?.id) return null;
    const { data: txn, error: txnErr } = await supabase.from('transactions' as any).select('*').eq('id', transactionId).eq('business_id', businessId).single();
    if (txnErr || !txn) return null;

    const { data: refund, error: refundErr } = await supabase
      .from('transaction_refunds' as any)
      .insert({
        transaction_id: transactionId,
        amount: amountCents,
        reason,
        staff_id: user.id,
        restock_applied: restockProductIds.length > 0,
      })
      .select()
      .single();
    if (refundErr || !refund) return null;

    if (restockProductIds.length > 0) {
      const { data: items } = await supabase.from('transaction_line_items' as any).select('*').eq('transaction_id', transactionId).eq('type', 'product');
      for (const item of items || []) {
        if (!restockProductIds.includes((item as any).reference_id)) continue;
        const qty = (item as any).quantity;
        const refId = (item as any).reference_id;
        const { data: product } = await supabase.from('inventory' as any).select('quantity_on_hand').eq('id', refId).eq('business_id', businessId).single();
        const current = (product as any)?.quantity_on_hand ?? 0;
        await supabase.from('inventory' as any).update({ quantity_on_hand: current + qty, updated_at: new Date().toISOString() }).eq('id', refId).eq('business_id', businessId);
        await supabase.from('inventory_stock_movements' as any).insert({
          business_id: businessId,
          product_id: refId,
          quantity: qty,
          movement_type: 'adjustment',
          notes: 'Refund restock',
        });
      }
    }

    const newStatus = amountCents >= (txn as any).total ? 'refunded' : 'partial_refund';
    await supabase.from('transactions' as any).update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', transactionId).eq('business_id', businessId);
    setServerTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, status: newStatus } : t)));

    return refund as TransactionRefund;
  };

  return {
    transactions,
    loading,
    refetch: fetchTransactions,
    fetchTransactionById,
    fetchTaxSettings,
    fetchReceiptSettings,
    computeTax,
    createTransaction,
    updateTransactionStatus,
    createRefund,
  };
}
