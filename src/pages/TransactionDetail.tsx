import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Printer, Mail, DollarSign, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTransactions } from '@/hooks/useTransactions';
import { useClients } from '@/hooks/useSupabaseData';
import { useSettings } from '@/hooks/useSupabaseData';
import { printReceipt } from '@/components/ReceiptPrint';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Transaction, TransactionLineItem } from '@/types/transactions';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  ath_movil: 'ATH Móvil',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
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

export function TransactionDetail() {
  const { businessSlug, transactionId } = useParams<{ businessSlug: string; transactionId: string }>();
  const location = useLocation();
  const { fetchTransactionById, updateTransactionStatus, createRefund, fetchReceiptSettings } = useTransactions();
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
      transaction,
      lineItems,
      displayId,
    });
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

  const handleVoid = async () => {
    if (!transactionId || !transaction) return;
    const ok = await updateTransactionStatus(transactionId, 'void');
    if (ok) {
      setTransaction((t) => (t ? { ...t, status: 'void' } : null));
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

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/${businessSlug}/transactions`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{displayId}</h1>
          <Badge variant={transaction.status === 'refunded' || transaction.status === 'void' ? 'destructive' : 'default'}>
            {STATUS_LABELS[transaction.status] ?? transaction.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
            <Printer className="h-4 w-4" />
            {t('transactions.printReceipt')}
          </Button>
          <Button variant="outline" size="sm" onClick={openEmailReceipt} className="gap-1">
            <Mail className="h-4 w-4" />
            {t('transactions.emailReceipt')}
          </Button>
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
              <p>{format(new Date(transaction.created_at), 'PPpp')}</p>
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
                <span className="text-muted-foreground">{tax.label}</span>
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
              <span>{t('transactions.total')}</span>
              <span>${fromCents(transaction.total).toFixed(2)}</span>
            </div>
          </div>

          {transaction.notes && (
            <p className="text-sm text-muted-foreground border-t pt-2">{transaction.notes}</p>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
