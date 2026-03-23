import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Search, CheckCircle } from 'lucide-react';
import { usePageLoadRef } from '@/hooks/usePageLoad';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useTransactions } from '@/hooks/useTransactions';
import { useClientNames } from '@/hooks/useSupabaseData';
import { useNotifications } from '@/hooks/useNotifications';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getPaymentStatusLabel } from '@/types/transactions';
import { PawStagedLoadingArea } from '@/components/PawStagedLoading';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type TransactionStatus =
  | 'pending'
  | 'in_progress'
  | 'paid'
  | 'partial'
  | 'refunded'
  | 'partial_refund'
  | 'void';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Unpaid',
  in_progress: 'In Progress',
  paid: 'Paid',
  partial: 'Partial',
  refunded: 'Refunded',
  partial_refund: 'Partial Refund',
  void: 'Void',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  ath_movil: 'ATH Móvil',
  other: 'Other',
};

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function Transactions() {
  const { businessSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const businessId = useBusinessId();
  const { transactions: rawTransactions, loading, loadingMore, hasMore, loadMore, updateTransaction, error: fetchError, refetch } = useTransactions();
  const { clients } = useClientNames();
  const { createNotification } = useNotifications();
  const [search, setSearch] = useState('');
  const pageLoadRef = usePageLoadRef();

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return 'Walk-in';
    const c = clients.find((x) => x.id === customerId);
    return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || '—' : '—';
  };

  const notifiedUnpaidRef = useRef(false);
  useEffect(() => {
    if (!businessId || !createNotification || !user?.id || rawTransactions.length === 0) return;
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const weeklyAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const run = async () => {
      // Weekly reminder: only create if we haven't created any "payment" notification in the last 7 days.
      const { data: recentPaymentNotifs } = await supabase
        .from('notifications' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .eq('notification_type', 'payment')
        .gte('created_at', weeklyAgoIso)
        .limit(1);

      if (recentPaymentNotifs && recentPaymentNotifs.length > 0) return;

      const unpaid = rawTransactions.filter(
        (t) => t.status === 'partial' && new Date(t.created_at).getTime() < twentyFourHoursAgo
      );
      if (unpaid.length === 0) return;

      // Keep local guard to avoid rapid duplicate inserts while the effect is recomputing.
      if (notifiedUnpaidRef.current) return;
      notifiedUnpaidRef.current = true;

      try {
        const targetTransactionId = unpaid[0].id;

        // Extra safety: don't recreate for the same transaction within the last 24 hours.
        const { data: existing } = await supabase
          .from('notifications' as any)
          .select('id')
          .eq('user_id', user.id)
          .eq('business_id', businessId)
          .eq('notification_type', 'payment')
          .eq('transaction_id', targetTransactionId)
          .gte('created_at', new Date(twentyFourHoursAgo).toISOString())
          .limit(1);

        if (existing && existing.length > 0) return;

        await createNotification(
          `${unpaid.length} transaction(s) have unpaid balance for more than 24 hours.`,
          businessId,
          { transactionId: targetTransactionId, type: 'payment' }
        );
      } finally {
        // Allow re-attempt after navigation / recompute. Weekly gate will block until 7 days pass.
        notifiedUnpaidRef.current = false;
      }
    };

    void run();
  }, [businessId, createNotification, rawTransactions, user?.id]);

  const isFullyPaid = (txn: (typeof rawTransactions)[0]) =>
    (txn.amount_tendered ?? 0) >= txn.total || txn.status === 'paid' || txn.status === 'void' || txn.status === 'refunded' || txn.status === 'partial_refund';

  const handleMarkAsPaid = async (e: React.MouseEvent, txn: (typeof rawTransactions)[0]) => {
    e.stopPropagation();
    const ok = await updateTransaction(txn.id, { amount_tendered: txn.total, status: 'paid', change_given: 0 });
    if (ok) toast.success(t('transactions.markedAsPaid') ?? 'Marked as paid');
    else toast.error(t('common.genericError'));
  };

  const filtered = rawTransactions.filter((txn) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const num = txn.transaction_number != null ? `TXN-${String(txn.transaction_number).padStart(5, '0')}` : '';
    const customerName = getCustomerName(txn.customer_id).toLowerCase();
    return num.toLowerCase().includes(term) || customerName.includes(term) || txn.id.toLowerCase().includes(term);
  });

  return (
    <div ref={pageLoadRef} className="space-y-6 animate-fade-in" data-transition-root>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap min-w-0" data-page-toolbar data-page-search>
        <div className="relative w-full sm:max-w-sm flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by transaction ID or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-border/50 bg-white/70 backdrop-blur-sm dark:bg-background/50"
          />
        </div>
        <Button asChild className="gap-2 shadow-sm shrink-0">
          <Link to={businessSlug ? `/${businessSlug}/transactions/new` : '/transactions/new'}>
            <Plus className="w-4 h-4" />
            New Transaction
          </Link>
        </Button>
      </div>

      <div data-page-content>
        <Card>
          <CardContent className="p-0">
          {loading ? (
            <div className="relative min-h-[220px] py-6">
              <PawStagedLoadingArea label="Loading transactions" compact size="md" />
            </div>
          ) : fetchError ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-destructive font-medium">Failed to load transactions.</p>
              <p className="text-muted-foreground text-sm">{fetchError}</p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center px-4">
              {t('transactions.emptyListHint')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border-0 bg-card" data-table-load>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">ID</th>
                    <th className="text-left py-3 px-2 font-medium">Date & time</th>
                    <th className="text-left py-3 px-2 font-medium">Customer</th>
                    <th className="text-right py-3 px-2 font-medium">{t('transactions.amountPaid')}</th>
                    <th className="text-right py-3 px-2 font-medium">{t('transactions.totalDue')}</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((txn) => {
                    const name = getCustomerName(txn.customer_id);
                    const displayId =
                      txn.transaction_number != null
                        ? `TXN-${String(txn.transaction_number).padStart(5, '0')}`
                        : txn.id.slice(0, 8);
                    return (
                      <tr
                        key={txn.id}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(businessSlug ? `/${businessSlug}/transactions/${txn.id}` : `/transactions/${txn.id}`)}
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2 font-mono">
                            <span>{displayId}</span>
                            {!isFullyPaid(txn) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={(e) => handleMarkAsPaid(e, txn)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Mark as paid
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">{format(new Date(txn.created_at), 'PPp')}</td>
                        <td className="py-3 px-2">{name}</td>
                        <td className="py-3 px-2 text-right">${centsToDollars(txn.amount_tendered ?? 0)}</td>
                        <td className="py-3 px-2 text-right font-medium">${centsToDollars(txn.total)}</td>
                        <td className="py-3 px-2">
                          <Badge
                            variant={
                              txn.status === 'refunded' || txn.status === 'partial_refund' || txn.status === 'void'
                                ? 'destructive'
                                : (txn.amount_tendered ?? 0) >= txn.total
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {txn.status === 'void' || txn.status === 'refunded' || txn.status === 'partial_refund'
                              ? (STATUS_LABELS[txn.status] || txn.status)
                              : getPaymentStatusLabel(txn.amount_tendered ?? 0, txn.total)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">{PAYMENT_METHOD_LABELS[txn.payment_method] || txn.payment_method}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && hasMore && (
            <div className="flex justify-center pt-4 pb-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
