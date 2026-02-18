import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Printer, Mail, DollarSign, XCircle, Pencil, ChevronDown, FileText, Receipt, Eye, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions } from '@/hooks/useTransactions';
import { useClients } from '@/hooks/useSupabaseData';
import { useSettings } from '@/hooks/useSupabaseData';
import { printReceipt, viewReceipt } from '@/components/ReceiptPrint';
import { printInvoice, viewInvoice } from '@/components/InvoicePrint';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Transaction, TransactionLineItem } from '@/types/transactions';
import { getPaymentStatusLabel, getPaymentStatusFromAmount } from '@/types/transactions';
import { normalizeTaxLabelForDisplay } from '@/lib/taxLabels';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  ath_movil: 'ATH Móvil',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Unpaid',
  in_progress: 'In Progress',
  paid: 'Paid',
  partial: 'Partial',
  refunded: 'Refunded',
  partial_refund: 'Partial Refund',
  void: 'Void',
};

function fromCents(c: number): number {
  return c / 100;
}

/** Format a single change_summary line for display (status labels, dollar amounts). */
function formatHistoryChangeLine(c: { field: string; old_value: unknown; new_value: unknown }): string {
  const label = (v: unknown) => (v != null && typeof v === 'string' && STATUS_LABELS[v] ? STATUS_LABELS[v] : String(v ?? '—'));
  const moneyFields = ['amount_tendered', 'total', 'change_given', 'discount_amount'];
  if (moneyFields.includes(c.field)) {
    const toDollars = (v: unknown) => (typeof v === 'number' ? `$${fromCents(v).toFixed(2)}` : (v == null ? '—' : `$${fromCents(Number(v)).toFixed(2)}`));
    return `${c.field === 'amount_tendered' ? (t('transactions.amountPaid') ?? 'Amount paid') : c.field}: ${toDollars(c.old_value)} → ${toDollars(c.new_value)}`;
  }
  if (c.field === 'status') {
    return `${t('transactions.status') ?? 'Status'}: ${label(c.old_value)} → ${label(c.new_value)}`;
  }
  return `${c.field}: ${label(c.old_value)} → ${label(c.new_value)}`;
}

/** If this entry is a "marked as paid" change, return a single friendly line; otherwise null. */
function getMarkedAsPaidLine(change_summary: { field: string; old_value: unknown; new_value: unknown }[]): string | null {
  if (!Array.isArray(change_summary) || change_summary.length === 0) return null;
  const statusChange = change_summary.find((c) => c.field === 'status' && c.new_value === 'paid');
  const amountChange = change_summary.find((c) => c.field === 'amount_tendered');
  if (!statusChange || !amountChange) return null;
  const amount = typeof amountChange.new_value === 'number' ? amountChange.new_value : Number(amountChange.new_value);
  const formatted = Number.isFinite(amount) ? `$${fromCents(amount).toFixed(2)}` : '';
  return formatted ? `${t('transactions.markedAsPaid') ?? 'Marked as paid'} (${formatted})` : (t('transactions.markedAsPaid') ?? 'Marked as paid');
}

export function TransactionDetail() {
  const { businessSlug, transactionId } = useParams<{ businessSlug: string; transactionId: string }>();
  const location = useLocation();
  const { fetchTransactionById, fetchTransactionHistory, updateTransactionStatus, updateTransaction, createRefund, fetchReceiptSettings } = useTransactions();
  const { clients } = useClients();
  const { settings } = useSettings();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [restockProducts, setRestockProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [emailReceiptOpen, setEmailReceiptOpen] = useState(false);
  const [walkInEmail, setWalkInEmail] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<Transaction['payment_method']>(transaction?.payment_method ?? 'cash');
  const [editTotal, setEditTotal] = useState('');
  const [editAmountTendered, setEditAmountTendered] = useState('');
  const [editNotes, setEditNotes] = useState(transaction?.notes ?? '');
  const [historyEntries, setHistoryEntries] = useState<import('@/types/transactions').TransactionHistoryEntry[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogType, setEmailDialogType] = useState<'receipt' | 'invoice' | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [receiptMenuOpen, setReceiptMenuOpen] = useState(false);
  const [invoiceMenuOpen, setInvoiceMenuOpen] = useState(false);
  const receiptLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invoiceLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWalkIn = !transaction?.customer_id;
  const customerEmail = transaction?.customer_id
    ? clients.find((x) => x.id === transaction.customer_id)?.email
    : null;

  useEffect(() => {
    if (!transactionId) return;
    const state = location.state as { transaction?: Transaction; lineItems?: TransactionLineItem[] } | null;
    fetchTransactionById(transactionId).then((data) => {
      if (data) {
        setTransaction(data.transaction);
        setLineItems(data.lineItems);
      } else if (state?.transaction && state?.lineItems && state.transaction.id === transactionId) {
        setTransaction(state.transaction);
        setLineItems(state.lineItems);
      }
      setLoading(false);
    });
  }, [transactionId, fetchTransactionById]);

  useEffect(() => {
    if (transaction) {
      setEditPaymentMethod(transaction.payment_method);
      setEditTotal((transaction.total / 100).toFixed(2));
      setEditAmountTendered(transaction.amount_tendered != null ? (transaction.amount_tendered / 100).toFixed(2) : (transaction.total / 100).toFixed(2));
      setEditNotes(transaction.notes ?? '');
    }
  }, [transaction]);

  useEffect(() => {
    if (!transactionId || transaction?.id?.startsWith('local-')) return;
    fetchTransactionHistory(transactionId).then(setHistoryEntries);
  }, [transactionId, transaction?.id, fetchTransactionHistory]);

  const customerName = transaction?.customer_id
    ? (() => {
        const c = clients.find((x) => x.id === transaction.customer_id);
        return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email : '—';
      })()
    : 'Walk-in';

  const displayId =
    transaction?.transaction_number != null
      ? `TXN-${String(transaction.transaction_number).padStart(5, '0')}`
      : transaction?.id?.slice(0, 8) ?? '—';

  const handlePrint = async () => {
    if (!transaction || lineItems.length === 0) return;
    const receiptSettings = await fetchReceiptSettings();
    const footer = receiptSettings?.footer_text ?? receiptSettings?.thank_you_message ?? undefined;
    printReceipt({
      businessName: settings?.business_name ?? 'Pet Hub',
      headerText: receiptSettings?.header_text ?? undefined,
      footerText: footer ?? undefined,
      receiptPhone: receiptSettings?.receipt_phone ?? undefined,
      receiptLocation: receiptSettings?.receipt_location ?? undefined,
      transaction,
      lineItems,
      displayId,
    });
  };

  const handlePrintInvoice = async () => {
    if (!transaction || lineItems.length === 0) return;
    const [receiptRes, bizRes] = await Promise.all([
      fetchReceiptSettings(),
      supabase.from('businesses' as any).select('logo_url').eq('id', transaction.business_id).maybeSingle(),
    ]);
    const receiptSettings = receiptRes;
    const biz = bizRes.data as { logo_url?: string | null } | null;
    printInvoice({
      businessName: settings?.business_name ?? 'Pet Hub',
      businessPhone: receiptSettings?.receipt_phone ?? undefined,
      businessAddress: receiptSettings?.receipt_location ?? undefined,
      logoUrl: biz?.logo_url ?? undefined,
      transaction,
      lineItems,
      displayId,
      customerName,
    });
  };

  const openEmailDialog = (type: 'receipt' | 'invoice') => {
    setEmailDialogType(type);
    setEmailTo(customerEmail || walkInEmail || '');
    setEmailDialogOpen(true);
  };

  const handleEmailDialogSend = () => {
    const trimmed = emailTo?.trim();
    if (!trimmed) {
      toast.error(t('transactions.enterEmail'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error(t('transactions.invalidEmail'));
      return;
    }
    const subject = emailDialogType === 'receipt' ? `Receipt ${displayId}` : `Invoice ${displayId}`;
    const body = [
      `${emailDialogType === 'invoice' ? 'Invoice' : 'Receipt'} ${displayId}`,
      `Date: ${transaction ? format(new Date(transaction.created_at), 'PPpp') : ''}`,
      `Total: ${transaction ? `$${(transaction.total / 100).toFixed(2)}` : ''}`,
    ].join('\n');
    window.location.href = `mailto:${encodeURIComponent(trimmed)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setEmailDialogOpen(false);
    setEmailDialogType(null);
    setEmailTo('');
  };

  const openEmailReceipt = () => {
    if (isWalkIn) {
      setWalkInEmail('');
      setEmailReceiptOpen(true);
      return;
    }
    if (customerEmail) {
      sendReceiptTo(customerEmail);
    } else {
      toast.error(t('transactions.noEmailForCustomer'));
    }
  };

  const sendReceiptTo = (email: string) => {
    if (!transaction) return;
    const body = [
      `Transaction ${displayId}`,
      `Date: ${format(new Date(transaction.created_at), 'PPpp')}`,
      `Total: $${fromCents(transaction.total).toFixed(2)}`,
    ].join('\n');
    const mailto = `mailto:${email}?subject=Receipt ${displayId}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handleWalkInEmailSubmit = () => {
    const trimmed = walkInEmail?.trim();
    if (!trimmed) {
      toast.error(t('transactions.enterEmail'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error(t('transactions.invalidEmail'));
      return;
    }
    setEmailReceiptOpen(false);
    sendReceiptTo(trimmed);
  };

  const handleEditSave = async () => {
    if (!transactionId || !transaction) return;
    const totalCents = Math.round(parseFloat(editTotal || '0') * 100);
    const amountTendered = editAmountTendered === '' ? null : Math.round(parseFloat(editAmountTendered || '0') * 100);
    const amountPaid = amountTendered ?? 0;
    const status = getPaymentStatusFromAmount(amountPaid, totalCents);
    const ok = await updateTransaction(transactionId, {
      payment_method: editPaymentMethod as Transaction['payment_method'],
      total: totalCents,
      amount_tendered: amountTendered,
      notes: editNotes.trim() || null,
      status,
    });
    if (ok) {
      setTransaction((t) => t ? { ...t, payment_method: editPaymentMethod as Transaction['payment_method'], total: totalCents, amount_tendered: amountTendered, notes: editNotes.trim() || null, status } : null);
      setEditOpen(false);
      if (transactionId) fetchTransactionHistory(transactionId).then(setHistoryEntries);
      toast.success(t('common.saved'));
    } else {
      toast.error(t('common.genericError'));
    }
  };

  const handleVoid = async () => {
    if (!transactionId || !transaction) return;
    const ok = await updateTransactionStatus(transactionId, 'void');
    if (ok) {
      setTransaction((t) => (t ? { ...t, status: 'void' } : null));
      if (transactionId) fetchTransactionHistory(transactionId).then(setHistoryEntries);
      toast.success(t('transactions.voided'));
    } else toast.error(t('common.genericError'));
  };

  const handleRefundSubmit = async () => {
    if (!transactionId || !transaction) return;
    const amount = Math.round(parseFloat(refundAmount || '0') * 100);
    if (amount <= 0) {
      toast.error(t('transactions.refundAmountRequired'));
      return;
    }
    if (amount > transaction.total) {
      toast.error(t('transactions.refundExceedsTotal'));
      return;
    }
    setSubmitting(true);
    const productIds = restockProducts ? lineItems.filter((li) => li.type === 'product').map((li) => li.reference_id) : [];
    const refund = await createRefund(transactionId, amount, refundReason || null, productIds);
    setSubmitting(false);
    setRefundOpen(false);
    setRefundAmount('');
    setRefundReason('');
    if (refund) {
      setTransaction((t) => (t ? { ...t, status: amount >= t.total ? 'refunded' : 'partial_refund' } : null));
      toast.success(t('transactions.refundIssued'));
    } else toast.error(t('common.genericError'));
  };

  if (loading || !transaction) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to={`/${businessSlug}/transactions`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('transactions.backToList')}
          </Link>
        </Button>
        <p className="text-muted-foreground">{loading ? 'Loading…' : 'Transaction not found.'}</p>
      </div>
    );
  }

  const canVoid = transaction.status !== 'void' && transaction.status !== 'refunded';
  const canRefund = transaction.status === 'paid' || transaction.status === 'partial' || transaction.status === 'partial_refund';
  const isFullyPaid =
    (transaction.amount_tendered ?? 0) >= transaction.total ||
    transaction.status === 'paid' ||
    transaction.status === 'void' ||
    transaction.status === 'refunded' ||
    transaction.status === 'partial_refund';

  const handleMarkAsPaid = async () => {
    if (!transactionId || !transaction) return;
    const ok = await updateTransaction(transactionId, {
      amount_tendered: transaction.total,
      status: 'paid',
      change_given: 0,
    });
    if (ok) {
      setTransaction((t) => (t ? { ...t, amount_tendered: transaction.total, status: 'paid' } : null));
      // Show "Marked as paid" in history immediately and keep it visible
      const optimisticEntry: import('@/types/transactions').TransactionHistoryEntry = {
        id: 'optimistic-mark-paid',
        transaction_id: transactionId,
        business_id: transaction.business_id,
        changed_at: new Date().toISOString(),
        changed_by_user_id: null,
        change_summary: [
          { field: 'status', old_value: transaction.status, new_value: 'paid' },
          { field: 'amount_tendered', old_value: transaction.amount_tendered ?? null, new_value: transaction.total },
        ],
      };
      setHistoryEntries((prev) => [optimisticEntry, ...prev]);
      toast.success(t('transactions.markedAsPaid') ?? 'Marked as paid');
      // Refetch to get server entry with "who"; only replace if server has a matching entry so we never lose the row
      setTimeout(async () => {
        const entries = await fetchTransactionHistory(transactionId);
        const serverHasMarkPaid = entries.some(
          (e) =>
            Array.isArray(e.change_summary) &&
            e.change_summary.some((c: { field: string; new_value: unknown }) => c.field === 'status' && c.new_value === 'paid')
        );
        setHistoryEntries((prev) => {
          const hadOptimistic = prev.some((e) => e.id === 'optimistic-mark-paid');
          if (hadOptimistic && !serverHasMarkPaid) return prev;
          if (hadOptimistic && serverHasMarkPaid) return entries;
          return entries;
        });
      }, 600);
    } else toast.error(t('common.genericError'));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/${businessSlug}/transactions`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{displayId}</h1>
          {!isFullyPaid && (
            <Button variant="outline" size="sm" onClick={handleMarkAsPaid} className="gap-1">
              <CheckCircle className="h-4 w-4" />
              {t('transactions.markAsPaid') ?? 'Mark as paid'}
            </Button>
          )}
          <Badge variant={transaction.status === 'refunded' || transaction.status === 'void' ? 'destructive' : 'default'}>
            {transaction.status === 'void' || transaction.status === 'refunded' || transaction.status === 'partial_refund'
              ? (STATUS_LABELS[transaction.status] ?? transaction.status)
              : getPaymentStatusLabel(transaction.amount_tendered ?? 0, transaction.total)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1">
            <Pencil className="h-4 w-4" />
            {t('common.edit') ?? 'Edit'}
          </Button>
          <DropdownMenu open={receiptMenuOpen} onOpenChange={setReceiptMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onMouseEnter={() => {
                  if (receiptLeaveTimerRef.current) {
                    clearTimeout(receiptLeaveTimerRef.current);
                    receiptLeaveTimerRef.current = null;
                  }
                  setReceiptMenuOpen(true);
                }}
                onMouseLeave={() => {
                  receiptLeaveTimerRef.current = setTimeout(() => setReceiptMenuOpen(false), 600);
                }}
              >
                <Receipt className="h-4 w-4" />
                {t('transactions.receipt') ?? 'Receipt'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onMouseEnter={() => {
                if (receiptLeaveTimerRef.current) {
                  clearTimeout(receiptLeaveTimerRef.current);
                  receiptLeaveTimerRef.current = null;
                }
                setReceiptMenuOpen(true);
              }}
              onMouseLeave={() => {
                receiptLeaveTimerRef.current = setTimeout(() => setReceiptMenuOpen(false), 600);
              }}
            >
              <DropdownMenuItem onClick={async () => {
                setReceiptMenuOpen(false);
                const receiptSettings = await fetchReceiptSettings();
                const footer = receiptSettings?.footer_text ?? receiptSettings?.thank_you_message ?? undefined;
                viewReceipt({ businessName: settings?.business_name ?? 'Pet Hub', headerText: receiptSettings?.header_text ?? undefined, footerText: footer ?? undefined, receiptPhone: receiptSettings?.receipt_phone ?? undefined, receiptLocation: receiptSettings?.receipt_location ?? undefined, transaction, lineItems, displayId });
              }}>
                <Eye className="h-4 w-4 mr-2" />
                {t('transactions.view') ?? 'View'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setReceiptMenuOpen(false); handlePrint(); }}>
                <Printer className="h-4 w-4 mr-2" />
                {t('transactions.print') ?? 'Print'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setReceiptMenuOpen(false); openEmailDialog('receipt'); }}>
                <Mail className="h-4 w-4 mr-2" />
                {t('transactions.email') ?? 'Email'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu open={invoiceMenuOpen} onOpenChange={setInvoiceMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onMouseEnter={() => {
                  if (invoiceLeaveTimerRef.current) {
                    clearTimeout(invoiceLeaveTimerRef.current);
                    invoiceLeaveTimerRef.current = null;
                  }
                  setInvoiceMenuOpen(true);
                }}
                onMouseLeave={() => {
                  invoiceLeaveTimerRef.current = setTimeout(() => setInvoiceMenuOpen(false), 600);
                }}
              >
                <FileText className="h-4 w-4" />
                {t('transactions.invoice') ?? 'Invoice'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onMouseEnter={() => {
                if (invoiceLeaveTimerRef.current) {
                  clearTimeout(invoiceLeaveTimerRef.current);
                  invoiceLeaveTimerRef.current = null;
                }
                setInvoiceMenuOpen(true);
              }}
              onMouseLeave={() => {
                invoiceLeaveTimerRef.current = setTimeout(() => setInvoiceMenuOpen(false), 600);
              }}
            >
              <DropdownMenuItem onClick={async () => {
                setInvoiceMenuOpen(false);
                const [receiptRes, bizRes] = await Promise.all([fetchReceiptSettings(), supabase.from('businesses' as any).select('logo_url').eq('id', transaction.business_id).maybeSingle()]);
                const biz = bizRes.data as { logo_url?: string | null } | null;
                viewInvoice({ businessName: settings?.business_name ?? 'Pet Hub', businessPhone: receiptRes?.receipt_phone ?? undefined, businessAddress: receiptRes?.receipt_location ?? undefined, logoUrl: biz?.logo_url ?? undefined, transaction, lineItems, displayId, customerName });
              }}>
                <Eye className="h-4 w-4 mr-2" />
                {t('transactions.view') ?? 'View'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setInvoiceMenuOpen(false); handlePrintInvoice(); }}>
                <Printer className="h-4 w-4 mr-2" />
                {t('transactions.print') ?? 'Print'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setInvoiceMenuOpen(false); openEmailDialog('invoice'); }}>
                <Mail className="h-4 w-4 mr-2" />
                {t('transactions.email') ?? 'Email'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canRefund && (
            <Button variant="outline" size="sm" onClick={() => setRefundOpen(true)} className="gap-1">
              <DollarSign className="h-4 w-4" />
              {t('transactions.issueRefund')}
            </Button>
          )}
          {canVoid && (
            <Button variant="destructive" size="sm" onClick={handleVoid} className="gap-1">
              <XCircle className="h-4 w-4" />
              {t('transactions.void')}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.detail')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('transactions.date')}</span>
              <p>{format(new Date(transaction.created_at), 'PPp')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('transactions.customer')}</span>
              <p>
                {transaction.customer_id ? (
                  <Link to={`/${businessSlug}/clients`} className="text-primary hover:underline">
                    {customerName}
                  </Link>
                ) : (
                  customerName
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('transactions.paymentMethod')}</span>
              <p>{PAYMENT_METHOD_LABELS[transaction.payment_method] ?? transaction.payment_method}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">{t('transactions.item')}</th>
                  <th className="text-right py-2">{t('transactions.qty')}</th>
                  <th className="text-right py-2">{t('transactions.price')}</th>
                  <th className="text-right py-2">{t('transactions.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} className="border-b">
                    <td className="py-2">{li.name}</td>
                    <td className="text-right">{li.quantity}</td>
                    <td className="text-right">${fromCents(li.unit_price).toFixed(2)}</td>
                    <td className="text-right font-medium">${fromCents(li.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 text-sm border-t pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('transactions.subtotal')}</span>
              <span>${fromCents(transaction.subtotal).toFixed(2)}</span>
            </div>
            {transaction.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('transactions.discount')}</span>
                <span>-${fromCents(transaction.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {transaction.tax_snapshot?.map((tax) => (
              <div key={tax.label} className="flex justify-between">
                <span className="text-muted-foreground">{normalizeTaxLabelForDisplay(tax.label)}</span>
                <span>${fromCents(tax.amount).toFixed(2)}</span>
              </div>
            ))}
            {transaction.tip_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('transactions.tip')}</span>
                <span>${fromCents(transaction.tip_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2">
              <span>{t('transactions.totalDue')}</span>
              <span>${fromCents(transaction.total).toFixed(2)}</span>
            </div>
            {transaction.amount_tendered != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('transactions.amountPaid')}</span>
                <span>${fromCents(transaction.amount_tendered).toFixed(2)}</span>
              </div>
            )}
          </div>

          {transaction.notes && (
            <p className="text-sm text-muted-foreground border-t pt-2">{transaction.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Transaction history: created + status/amount changes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.history') ?? 'Transaction history'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {[
              ...(transaction ? [{ id: '__created__', changed_at: transaction.created_at, change_summary: [{ field: t('transactions.historyCreated') ?? 'Created', old_value: null, new_value: null }], changed_by_user_id: null, changed_by_display: null }] : []),
              ...historyEntries,
            ]
              .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
              .map((entry) => (
                <li key={entry.id} className="border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{format(new Date(entry.changed_at), 'PPp')}</span>
                  {entry.changed_by_display && <span className="ml-2 text-muted-foreground">· {entry.changed_by_display}</span>}
                  <ul className="mt-1 list-disc list-inside">
                    {entry.id === '__created__' ? (
                      <li>{t('transactions.historyCreated') ?? 'Transaction created'}</li>
                    ) : (() => {
                      const markedPaidLine = getMarkedAsPaidLine(entry.change_summary ?? []);
                      if (markedPaidLine) return <li>{markedPaidLine}</li>;
                      return Array.isArray(entry.change_summary) && entry.change_summary.map((c: { field: string; old_value: unknown; new_value: unknown }, i: number) => (
                        <li key={i}>{formatHistoryChangeLine(c)}</li>
                      ));
                    })()}
                  </ul>
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={emailDialogOpen} onOpenChange={(open) => { if (!open) { setEmailDialogType(null); setEmailTo(''); } setEmailDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('transactions.email')} {emailDialogType === 'invoice' ? t('transactions.invoice') : t('transactions.receipt')}</DialogTitle>
            <DialogDescription>{t('transactions.sendTo')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">{t('transactions.sendTo')}</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailDialogOpen(false); setEmailDialogType(null); setEmailTo(''); }}>{t('common.cancel')}</Button>
            <Button onClick={handleEmailDialogSend}>{t('transactions.email')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('transactions.issueRefund')}</DialogTitle>
            <DialogDescription>
              {t('transactions.refundAmount')} (max ${fromCents(transaction.total).toFixed(2)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('transactions.refundAmount')}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transactions.refundReason')}</Label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder={t('transactions.refundReason')} />
            </div>
            {lineItems.some((li) => li.type === 'product') && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="restock"
                  checked={restockProducts}
                  onChange={(e) => setRestockProducts(e.target.checked)}
                />
                <Label htmlFor="restock">{t('transactions.returnToInventory')}</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRefundSubmit} disabled={submitting}>
              {submitting ? t('common.saving') : t('transactions.issueRefund')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailReceiptOpen} onOpenChange={setEmailReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('transactions.emailReceipt')}</DialogTitle>
            <DialogDescription>{t('transactions.walkInEmailDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="walk-in-email">{t('transactions.emailAddress')}</Label>
              <Input
                id="walk-in-email"
                type="email"
                placeholder="customer@example.com"
                value={walkInEmail}
                onChange={(e) => setWalkInEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWalkInEmailSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailReceiptOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleWalkInEmailSubmit}>
              {t('transactions.sendReceipt')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.edit') ?? 'Edit transaction'}</DialogTitle>
            <DialogDescription>
              Correct payment amount, method, or notes (e.g. if cash received didn&apos;t match).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('transactions.paymentMethod')}</Label>
              <select
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value as Transaction['payment_method'])}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('transactions.totalDue')} ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={editTotal}
                onChange={(e) => setEditTotal(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transactions.amountPaid')} ($) — optional</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={editAmountTendered}
                onChange={(e) => setEditAmountTendered(e.target.value)}
                placeholder={transaction ? (transaction.total / 100).toFixed(2) : '0.00'}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditSave}>
              {t('common.save') ?? 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
