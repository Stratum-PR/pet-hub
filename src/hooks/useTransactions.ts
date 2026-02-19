import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from './useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeTaxLabelForStorage } from '@/lib/taxLabels';
import { validateCreatePayload, validateRefundPayload, validateUpdatePayload } from '@/lib/transactionValidation';
import type {
  Transaction,
  TransactionLineItem,
  TransactionLineItemInput,
  TransactionRefund,
  TransactionStatus,
  PaymentMethod,
  TaxSettingRow,
  TaxSnapshotItem,
  TransactionHistoryEntry,
} from '@/types/transactions';

export type FetchTransactionByIdResult =
  | { ok: true; transaction: Transaction; lineItems: TransactionLineItem[] }
  | { ok: false; notFound: true }
  | { ok: false; error: string };

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
const TRANSACTIONS_PAGE_SIZE = 50;

/** Columns needed for list view (excludes tax_snapshot, notes to reduce payload). */
const TRANSACTIONS_LIST_COLUMNS =
  'id,business_id,customer_id,appointment_id,staff_id,created_at,status,payment_method,payment_method_secondary,subtotal,discount_amount,discount_label,tip_amount,total,amount_tendered,change_given,transaction_number';

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
  const [totalCount, setTotalCount] = useState(0);
  const [localDemoEntries, setLocalDemoEntries] = useState<{ transaction: Transaction; lineItems: TransactionLineItem[] }[]>([]);
  const localDemoEntriesRef = useRef(localDemoEntries);
  localDemoEntriesRef.current = localDemoEntries;
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const taxSettingsCacheRef = useRef<{ businessId: string; rows: TaxSettingRow[] } | null>(null);
  const receiptSettingsCacheRef = useRef<{ businessId: string; data: any } | null>(null);

  // Invalidate caches when business changes
  useEffect(() => {
    taxSettingsCacheRef.current = null;
    receiptSettingsCacheRef.current = null;
  }, [businessId]);

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
    setFetchError(null);
    const { data, error, count } = await supabase
      .from('transactions' as any)
      .select(TRANSACTIONS_LIST_COLUMNS, { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(0, TRANSACTIONS_PAGE_SIZE - 1);
    if (error) {
      setFetchError(error.message ?? 'Failed to load transactions');
      // Do not overwrite serverTransactions so existing data stays visible
    } else if (data) {
      setServerTransactions((data as any[]).map(mapRowToTransaction));
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [businessId]);

  const refetch = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    await fetchTransactions();
  }, [fetchTransactions]);

  const loadMoreTransactions = useCallback(async () => {
    if (!businessId || loadingMore || serverTransactions.length >= totalCount) return;
    setLoadingMore(true);
    const from = serverTransactions.length;
    const to = from + TRANSACTIONS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('transactions' as any)
      .select(TRANSACTIONS_LIST_COLUMNS)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(from, to);
    setLoadingMore(false);
    if (!error && data && data.length > 0) {
      setServerTransactions((prev) => [...prev, ...(data as any[]).map(mapRowToTransaction)]);
    }
  }, [businessId, loadingMore, serverTransactions.length, totalCount]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    fetchTransactions();
  }, [businessId, fetchTransactions]);

  const fetchTransactionById = useCallback(async (id: string): Promise<FetchTransactionByIdResult> => {
    if (id.startsWith('local-')) {
      const entry = localDemoEntriesRef.current.find((e) => e.transaction.id === id);
      return entry ? { ok: true, transaction: entry.transaction, lineItems: entry.lineItems } : { ok: false, notFound: true };
    }
    if (!businessId) return { ok: false, error: 'No business selected.' };
    const [txnResult, itemsResult] = await Promise.all([
      supabase.from('transactions' as any).select('*').eq('id', id).eq('business_id', businessId).single(),
      supabase.from('transaction_line_items' as any).select('*').eq('transaction_id', id),
    ]);
    const { data: txn, error: txnError } = txnResult;
    const { data: items, error: itemsError } = itemsResult;
    if (txnError) {
      if (txnError.code === 'PGRST116') return { ok: false, notFound: true };
      return { ok: false, error: txnError.message ?? 'Failed to load transaction' };
    }
    if (!txn) return { ok: false, notFound: true };
    const lineItems = !itemsError && items ? (items as any[]).map(mapRowToLineItem) : [];
    return { ok: true, transaction: mapRowToTransaction(txn), lineItems };
  }, [businessId]);

  const fetchTaxSettings = async (): Promise<TaxSettingRow[]> => {
    if (!businessId) return [];
    const cached = taxSettingsCacheRef.current;
    if (cached && cached.businessId === businessId) return cached.rows;
    const { data, error } = await supabase
      .from('tax_settings' as any)
      .select('*')
      .eq('business_id', businessId)
      .eq('enabled', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return [];
    const rows = (data as any[]).map((r) => ({ ...r, applies_to: r.applies_to ?? 'both' }));
    taxSettingsCacheRef.current = { businessId, rows };
    return rows;
  };

  const fetchReceiptSettings = async () => {
    if (!businessId) return null;
    const cached = receiptSettingsCacheRef.current;
    if (cached && cached.businessId === businessId) return cached.data;
    const { data, error } = await supabase
      .from('receipt_settings' as any)
      .select('header_text, footer_text, logo_url, tagline, thank_you_message, return_policy, receipt_phone, receipt_location')
      .eq('business_id', businessId)
      .maybeSingle();
    if (error || !data) return null;
    receiptSettingsCacheRef.current = { businessId, data };
    return data as any;
  };

  /**
   * Compute tax snapshot from service and product taxable amounts (cents).
   * Each tax row can apply to: both, service only, or product only.
   * Uses Puerto Rico defaults (State Tax 10.5%, Municipal Tax 1%) when no tax_settings exist.
   * Memoized so TransactionCreate's useEffect doesn't re-run every render (infinite loop).
   */
  const computeTax = useCallback(
    async (
      serviceTaxableCents: number,
      productTaxableCents: number
    ): Promise<{ taxSnapshot: TaxSnapshotItem[]; totalTaxCents: number }> => {
      const rows = await fetchTaxSettings();
      const taxSnapshot: TaxSnapshotItem[] = [];
      let totalTaxCents = 0;
      const defaultPR: TaxSettingRow[] = [
        { label: 'State Tax', rate: 10.5, enabled: true, sort_order: 0, applies_to: 'both' } as TaxSettingRow,
        { label: 'Municipal Tax', rate: 1, enabled: true, sort_order: 1, applies_to: 'both' } as TaxSettingRow,
      ];
      const effectiveRows = rows.length > 0 ? rows : defaultPR;
      const appliesTo = (row: TaxSettingRow) => row.applies_to ?? 'both';
      for (const row of effectiveRows) {
        const rate = Number(row.rate);
        let taxable = 0;
        if (appliesTo(row) === 'both') taxable = serviceTaxableCents + productTaxableCents;
        else if (appliesTo(row) === 'service') taxable = serviceTaxableCents;
        else taxable = productTaxableCents;
        const amount = Math.round((taxable * rate) / 100);
        taxSnapshot.push({ label: normalizeTaxLabelForStorage(row.label), rate, amount });
        totalTaxCents += amount;
      }
      return { taxSnapshot, totalTaxCents };
    },
    [businessId]
  );

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
    const validation = validateCreatePayload(payload as any);
    if (!validation.valid) return { data: null, error: validation.error };
    const subtotalCents = payload.line_items.reduce((sum, li) => sum + li.line_total, 0);
    const serviceSubtotalCents = payload.line_items.filter((li) => li.type === 'service').reduce((sum, li) => sum + li.line_total, 0);
    const productSubtotalCents = payload.line_items.filter((li) => li.type === 'product').reduce((sum, li) => sum + li.line_total, 0);
    const discountAmount = payload.discount_amount;
    const serviceTaxableCents = subtotalCents <= 0 ? 0 : Math.round(Math.max(0, serviceSubtotalCents - (discountAmount * serviceSubtotalCents) / subtotalCents));
    const productTaxableCents = subtotalCents <= 0 ? 0 : Math.round(Math.max(0, productSubtotalCents - (discountAmount * productSubtotalCents) / subtotalCents));
    const { taxSnapshot, totalTaxCents } = await computeTax(serviceTaxableCents, productTaxableCents);
    const taxableCents = serviceTaxableCents + productTaxableCents;
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
      if (import.meta.env.DEV) console.error('[useTransactions] createTransaction insert error', txnError);
      return { data: null, error: txnError.message || 'Failed to create transaction.' };
    }
    if (!txn) return { data: null, error: 'Failed to create transaction.' };

    const txnId = (txn as any).id;
    const txnNum = (txn as any).transaction_number ?? txnId;
    const lineRows = payload.line_items.map((li) => ({
      transaction_id: txnId,
      type: li.type,
      reference_id: li.reference_id,
      name: li.name,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
    }));
    const { error: lineError } = await supabase.from('transaction_line_items' as any).insert(lineRows);
    if (lineError) {
      if (import.meta.env.DEV) console.error('[useTransactions] line items insert error', lineError);
      return { data: null, error: lineError.message || 'Failed to save line items.' };
    }

    const productLineItems = payload.line_items.filter((li) => li.type === 'product');
    if (productLineItems.length > 0) {
      const quantityByProduct = new Map<string, number>();
      for (const li of productLineItems) {
        quantityByProduct.set(li.reference_id, (quantityByProduct.get(li.reference_id) ?? 0) + li.quantity);
      }
      const productIds = [...quantityByProduct.keys()];
      const { data: products } = await supabase
        .from('inventory' as any)
        .select('id, quantity_on_hand')
        .in('id', productIds)
        .eq('business_id', businessId);
      const qtyByProduct = new Map((products ?? []).map((p: any) => [p.id, Number(p.quantity_on_hand ?? 0)]));
      for (const [productId, deductQty] of quantityByProduct) {
        const current = qtyByProduct.get(productId) ?? 0;
        const newQty = Math.max(0, current - deductQty);
        await supabase.from('inventory' as any).update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() }).eq('id', productId).eq('business_id', businessId);
        await supabase.from('inventory_stock_movements' as any).insert({
          business_id: businessId,
          product_id: productId,
          quantity: -deductQty,
          movement_type: 'sale',
          notes: `Transaction ${txnNum}`,
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
    if (id.startsWith('local-')) {
      setLocalDemoEntries((prev) => prev.map((e) => (e.transaction.id === id ? { ...e, transaction: { ...e.transaction, status } } : e)));
      return true;
    }
    const { data: current } = await supabase.from('transactions' as any).select('status').eq('id', id).eq('business_id', businessId).single();
    const { error } = await supabase.from('transactions' as any).update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('business_id', businessId);
    if (!error) {
      setServerTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      if (user?.id && current?.status !== status) {
        await supabase.from('transaction_history' as any).insert({
          transaction_id: id,
          business_id: businessId,
          changed_by_user_id: user.id,
          change_summary: [{ field: 'status', old_value: current?.status, new_value: status }],
        });
      }
      return true;
    }
    return false;
  };

  type TransactionUpdatePatch = Partial<Pick<Transaction, 'payment_method' | 'payment_method_secondary' | 'total' | 'amount_tendered' | 'change_given' | 'notes' | 'status'>>;

  const updateTransaction = async (id: string, patch: TransactionUpdatePatch): Promise<boolean> => {
    if (!businessId) return false;
    const validation = validateUpdatePayload(patch as any);
    if (!validation.valid) return false;
    if (id.startsWith('local-') && isDemoLocalMode()) {
      setLocalDemoEntries((prev) =>
        prev.map((e) =>
          e.transaction.id === id ? { ...e, transaction: { ...e.transaction, ...patch } } : e
        )
      );
      return true;
    }
    const { data: current } = await supabase.from('transactions' as any).select('payment_method, payment_method_secondary, total, amount_tendered, change_given, notes, status').eq('id', id).eq('business_id', businessId).single();
    const payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('transactions' as any).update(payload).eq('id', id).eq('business_id', businessId);
    if (!error) {
      setServerTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if (current) {
        const summary: { field: string; old_value: unknown; new_value: unknown }[] = [];
        const keys = ['payment_method', 'payment_method_secondary', 'total', 'amount_tendered', 'change_given', 'notes', 'status'] as const;
        for (const k of keys) {
          if (k in patch && (current as any)[k] !== (patch as any)[k]) {
            summary.push({ field: k, old_value: (current as any)[k], new_value: (patch as any)[k] });
          }
        }
        if (summary.length > 0) {
          await supabase.from('transaction_history' as any).insert({
            transaction_id: id,
            business_id: businessId,
            changed_by_user_id: user?.id ?? null,
            change_summary: summary,
          });
        }
      }
      return true;
    }
    return false;
  };

  const createRefund = async (
    transactionId: string,
    amountCents: number,
    reason: string | null,
    restockProductIds: string[]
  ): Promise<{ data: TransactionRefund | null; error: string | null }> => {
    if (!businessId) return { data: null, error: 'No business selected.' };
    if (transactionId.startsWith('local-') && isDemoLocalMode()) {
      const entry = localDemoEntriesRef.current.find((e) => e.transaction.id === transactionId);
      if (!entry) return { data: null, error: 'Transaction not found.' };
      const newStatus = amountCents >= entry.transaction.total ? 'refunded' : 'partial_refund';
      setLocalDemoEntries((prev) => prev.map((e) => (e.transaction.id === transactionId ? { ...e, transaction: { ...e.transaction, status: newStatus } } : e)));
      return { data: { id: 'local-refund-' + crypto.randomUUID(), transaction_id: transactionId, amount: amountCents, reason, created_at: new Date().toISOString(), staff_id: null, restock_applied: false }, error: null };
    }
    if (!user?.id) return { data: null, error: 'You must be signed in to issue a refund.' };
    const { data: txn, error: txnErr } = await supabase.from('transactions' as any).select('*').eq('id', transactionId).eq('business_id', businessId).single();
    if (txnErr || !txn) return { data: null, error: txnErr?.message ?? 'Transaction not found.' };

    const { data: productItems } = await supabase.from('transaction_line_items' as any).select('*').eq('transaction_id', transactionId).eq('type', 'product');
    const items = (productItems ?? []) as any[];
    const productRefIds = items.map((i) => i.reference_id).filter(Boolean);
    const refundValidation = validateRefundPayload(amountCents, (txn as any).total, restockProductIds, productRefIds);
    if (!refundValidation.valid) return { data: null, error: refundValidation.error };

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
    if (refundErr || !refund) return { data: null, error: refundErr?.message ?? 'Failed to create refund.' };

    if (restockProductIds.length > 0) {
      const { data: inventoryRows } = await supabase
        .from('inventory' as any)
        .select('id, quantity_on_hand')
        .in('id', restockProductIds)
        .eq('business_id', businessId);
      const currentByProduct = new Map((inventoryRows ?? []).map((p: any) => [p.id, Number(p.quantity_on_hand ?? 0)]));
      for (const item of items) {
        if (!restockProductIds.includes((item as any).reference_id)) continue;
        const qty = (item as any).quantity;
        const refId = (item as any).reference_id;
        const current = currentByProduct.get(refId) ?? 0;
        await supabase.from('inventory' as any).update({ quantity_on_hand: current + qty, updated_at: new Date().toISOString() }).eq('id', refId).eq('business_id', businessId);
        await supabase.from('inventory_stock_movements' as any).insert({
          business_id: businessId,
          product_id: refId,
          quantity: qty,
          movement_type: 'adjustment',
          notes: 'Refund restock',
        });
        currentByProduct.set(refId, current + qty);
      }
    }

    const newStatus = amountCents >= (txn as any).total ? 'refunded' : 'partial_refund';
    await supabase.from('transactions' as any).update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', transactionId).eq('business_id', businessId);
    setServerTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, status: newStatus } : t)));

    return { data: refund as TransactionRefund, error: null };
  };

  const fetchTransactionHistory = useCallback(async (transactionId: string): Promise<TransactionHistoryEntry[]> => {
    if (!businessId) return [];
    if (transactionId.startsWith('local-')) return [];
    const { data, error } = await supabase
      .from('transaction_history' as any)
      .select('id, transaction_id, business_id, changed_at, changed_by_user_id, change_summary')
      .eq('transaction_id', transactionId)
      .eq('business_id', businessId)
      .order('changed_at', { ascending: false });
    if (error) return [];
    const entries = (data ?? []) as TransactionHistoryEntry[];
    const userIds = [...new Set(entries.map((e) => e.changed_by_user_id).filter(Boolean))] as string[];
    if (userIds.length === 0) return entries;
    const { data: profiles } = await supabase.from('profiles' as any).select('id, full_name, email').in('id', userIds);
    const byId = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, (p.full_name || p.email || null) as string]));
    return entries.map((e) => ({
      ...e,
      changed_by_display: e.changed_by_user_id ? (byId.get(e.changed_by_user_id) ?? null) : null,
    }));
  }, [businessId]);

  const hasMore = serverTransactions.length < totalCount;

  return {
    transactions,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    error: fetchError,
    refetch,
    loadMore: loadMoreTransactions,
    fetchTransactionById,
    fetchTransactionHistory,
    fetchTaxSettings,
    fetchReceiptSettings,
    computeTax,
    createTransaction,
    updateTransactionStatus,
    updateTransaction,
    createRefund,
  };
}
