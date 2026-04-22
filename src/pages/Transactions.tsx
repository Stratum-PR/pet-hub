import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Transaction, TransactionLineItem } from '@/types/transactions';
import { useNavigate, Link } from 'react-router-dom';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { Plus, CheckCircle, LayoutGrid, List, Loader2 } from 'lucide-react';
import { usePageLoadRef } from '@/hooks/usePageLoad';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchFilter } from '@/components/SearchFilter';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useTransactions, resolveDemoLocalTransactionEntries } from '@/hooks/useTransactions';
import { useClientNames, useSettings } from '@/hooks/useSupabaseData';
import { useNotifications } from '@/hooks/useNotifications';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getPaymentStatusLabel } from '@/types/transactions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { devConsole } from '@/lib/clientDebug';
import { useLanguage } from '@/contexts/LanguageContext';

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
  useLanguage(); // Ensure instant re-render on language toggle
  const businessSlug = useResolvedBusinessSlug();
  const navigate = useNavigate();
  const { user } = useAuth();
  const demoBrowseOnly = useDemoBrowseOnly();
  const businessId = useBusinessId();
  const { transactions: rawTransactions, loading, loadingMore, hasMore, loadMore, updateTransaction, error: fetchError, refetch } =
    useTransactions();

  const transactionNavigateState = useCallback(
    (txn: Transaction): { transaction: Transaction; lineItems?: TransactionLineItem[] } => {
      if (businessId && txn.id.startsWith('local-')) {
        const entries = resolveDemoLocalTransactionEntries(businessId, user?.id);
        const entry = entries.find((e) => e.transaction.id === txn.id);
        if (entry) {
          return { transaction: entry.transaction, lineItems: entry.lineItems };
        }
      }
      return { transaction: txn };
    },
    [businessId, user?.id],
  );

  const goToTransaction = useCallback(
    (txn: Transaction) => {
      const path = businessSlug ? `/${businessSlug}/transactions/${txn.id}` : `/transactions/${txn.id}`;
      const st = transactionNavigateState(txn);
      navigate(path, { state: st });
    },
    [businessSlug, navigate, transactionNavigateState],
  );
  const { clients } = useClientNames();
  const { settings } = useSettings();
  const { createNotification } = useNotifications(settings);
  const [searchTerm, setSearchTerm] = useState('');
  const TRANSACTION_VIEW_KEY = 'pet-hub-transactions-view';
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(TRANSACTION_VIEW_KEY) === 'list' ? 'list' : 'cards';
  });
  const pageLoadRef = usePageLoadRef();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TRANSACTION_VIEW_KEY, viewMode);
  }, [viewMode]);

  const getCustomerName = useCallback((customerId: string | null) => {
    if (!customerId) return 'Walk-in';
    const c = clients.find((x) => x.id === customerId);
    return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || '—' : '—';
  }, [clients]);

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
    const result = await updateTransaction(txn.id, { amount_tendered: txn.total, status: 'paid', change_given: 0 });
    if (result.ok) toast.success(t('transactions.markedAsPaid') ?? 'Marked as paid');
    else {
      if (result.error) devConsole.error('[Transactions] mark as paid', result.error);
      toast.error(result.error || t('common.genericError'));
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rawTransactions;
    return rawTransactions.filter((txn) => {
      const num = txn.transaction_number != null ? `TXN-${String(txn.transaction_number).padStart(5, '0')}` : '';
      const customerName = getCustomerName(txn.customer_id).toLowerCase();
      const idMatch = txn.id.toLowerCase().includes(term);
      const totalDollars = centsToDollars(txn.total);
      const tenderedDollars = centsToDollars(txn.amount_tendered ?? 0);
      return (
        num.toLowerCase().includes(term) ||
        customerName.includes(term) ||
        idMatch ||
        totalDollars.includes(term) ||
        tenderedDollars.includes(term)
      );
    });
  }, [rawTransactions, searchTerm, getCustomerName]);

  return (
    <div ref={pageLoadRef} className="min-w-0 space-y-6 animate-fade-in" data-transition-root>
      <div
        className="flex w-full min-w-0 flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center"
        data-page-toolbar
        data-page-search
      >
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder={t('transactions.searchPlaceholder')}
        />
        <div className="inline-flex rounded-xl border border-input bg-background/80 backdrop-blur-sm p-0.5 shrink-0">
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
              viewMode === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setViewMode('cards')}
            aria-label="Card view"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
              viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List className="w-4 h-4 shrink-0" />
          </button>
        </div>
        {demoBrowseOnly ? (
          <Button type="button" className="gap-2 shadow-sm shrink-0" disabled title={t('demo.workspaceReadOnlyAction')}>
            <Plus className="w-4 h-4" />
            {t('transactions.newTransaction')}
          </Button>
        ) : (
          <Button asChild className="gap-2 shadow-sm shrink-0">
            <Link to={businessSlug ? `/${businessSlug}/transactions/new` : '/transactions/new'}>
              <Plus className="w-4 h-4" />
              {t('transactions.newTransaction')}
            </Link>
          </Button>
        )}
      </div>

      <div data-page-content>
        <Card>
          <CardContent className="p-0">
          {loading ? (
            <div className="relative flex min-h-[220px] flex-col items-center justify-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin shrink-0" aria-hidden />
              <span className="text-sm">Loading transactions</span>
            </div>
          ) : fetchError ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-destructive font-medium">Failed to load transactions.</p>
              <p className="text-muted-foreground text-sm">{fetchError}</p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : rawTransactions.length > 0 && filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center px-4">{t('transactions.noSearchResults')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center px-4">
              {t('transactions.emptyListHint')}
            </p>
          ) : viewMode === 'cards' ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
              data-page-cards-grid
            >
              {filtered.map((txn) => {
                const name = getCustomerName(txn.customer_id);
                const displayId =
                  txn.transaction_number != null
                    ? `TXN-${String(txn.transaction_number).padStart(5, '0')}`
                    : txn.id.slice(0, 8);
                const go = () => goToTransaction(txn);
                return (
                  <Card
                    key={txn.id}
                    className="border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={go}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm font-medium break-all">{displayId}</div>
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">
                            {format(new Date(txn.created_at), 'PPp')}
                          </p>
                          <p className="mt-2 font-medium break-words">{name}</p>
                        </div>
                        {!isFullyPaid(txn) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs shrink-0"
                            disabled={demoBrowseOnly}
                            title={demoBrowseOnly ? t('demo.workspaceReadOnlyAction') : undefined}
                            onClick={(e) => handleMarkAsPaid(e, txn)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            {t('transactions.markAsPaid')}
                          </Button>
                        ) : null}
                      </div>
                      <div className="space-y-1 text-sm pt-3 border-t">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t('transactions.amountPaid')}</span>
                          <span>${centsToDollars(txn.amount_tendered ?? 0)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t('transactions.totalDue')}</span>
                          <span className="font-semibold">${centsToDollars(txn.total)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
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
                        <span className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[txn.payment_method] || txn.payment_method}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <>
              <ul className="space-y-3 p-4 lg:hidden" data-transactions-list-mobile>
                {filtered.map((txn) => {
                  const name = getCustomerName(txn.customer_id);
                  const displayId =
                    txn.transaction_number != null
                      ? `TXN-${String(txn.transaction_number).padStart(5, '0')}`
                      : txn.id.slice(0, 8);
                  const statusLabel =
                    txn.status === 'void' || txn.status === 'refunded' || txn.status === 'partial_refund'
                      ? (STATUS_LABELS[txn.status] || txn.status)
                      : getPaymentStatusLabel(txn.amount_tendered ?? 0, txn.total);
                  return (
                    <li key={txn.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <div
                        role="button"
                        tabIndex={0}
                        className="min-w-0 cursor-pointer space-y-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => goToTransaction(txn)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToTransaction(txn);
                          }
                        }}
                      >
                        <div className="font-mono text-sm font-medium break-all">{displayId}</div>
                        <p className="text-xs text-muted-foreground break-words">
                          {format(new Date(txn.created_at), 'PPp')}
                        </p>
                        <p className="font-medium break-words">{name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            {t('transactions.amountPaid')}: ${centsToDollars(txn.amount_tendered ?? 0)}
                          </span>
                          <span className="font-semibold text-foreground">
                            {t('transactions.totalDue')}: ${centsToDollars(txn.total)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge
                            variant={
                              txn.status === 'refunded' || txn.status === 'partial_refund' || txn.status === 'void'
                                ? 'destructive'
                                : (txn.amount_tendered ?? 0) >= txn.total
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {statusLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground break-words">
                            {PAYMENT_METHOD_LABELS[txn.payment_method] || txn.payment_method}
                          </span>
                        </div>
                      </div>
                      {!isFullyPaid(txn) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full gap-1 sm:w-auto"
                          disabled={demoBrowseOnly}
                          title={demoBrowseOnly ? t('demo.workspaceReadOnlyAction') : undefined}
                          onClick={(e) => handleMarkAsPaid(e, txn)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                          {t('transactions.markAsPaid')}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden min-w-0 overflow-x-auto p-0 lg:block" data-table-load>
                <table className="w-full min-w-0 text-sm table-fixed">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="w-[18%] px-2 py-3 text-left text-xs font-medium sm:text-sm">ID</th>
                      <th className="w-[18%] px-2 py-3 text-left text-xs font-medium sm:text-sm">
                        {t('transactions.date')}
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-medium sm:text-sm">
                        {t('transactions.customer')}
                      </th>
                      <th className="w-[10%] px-2 py-3 text-right text-xs font-medium whitespace-nowrap sm:text-sm">
                        {t('transactions.amountPaid')}
                      </th>
                      <th className="w-[10%] px-2 py-3 text-right text-xs font-medium whitespace-nowrap sm:text-sm">
                        {t('transactions.totalDue')}
                      </th>
                      <th className="w-[14%] px-2 py-3 text-left text-xs font-medium sm:text-sm">
                        {t('transactions.status')}
                      </th>
                      <th className="w-[12%] px-2 py-3 text-left text-xs font-medium sm:text-sm">
                        {t('transactions.payment')}
                      </th>
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
                          className="cursor-pointer border-t hover:bg-muted/50"
                          onClick={() => goToTransaction(txn)}
                        >
                          <td className="px-2 py-3 align-top">
                            <div className="space-y-2 font-mono text-xs break-all sm:text-sm">
                              <span className="block">{displayId}</span>
                              {!isFullyPaid(txn) ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={demoBrowseOnly}
                                  title={demoBrowseOnly ? t('demo.workspaceReadOnlyAction') : undefined}
                                  onClick={(e) => handleMarkAsPaid(e, txn)}
                                >
                                  <CheckCircle className="mr-1 h-3.5 w-3.5 shrink-0" />
                                  {t('transactions.markAsPaid')}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-3 align-top break-words text-xs sm:text-sm">
                            {format(new Date(txn.created_at), 'PPp')}
                          </td>
                          <td className="px-2 py-3 align-top break-words">{name}</td>
                          <td className="px-2 py-3 align-top text-right whitespace-nowrap">
                            ${centsToDollars(txn.amount_tendered ?? 0)}
                          </td>
                          <td className="px-2 py-3 align-top text-right font-medium whitespace-nowrap">
                            ${centsToDollars(txn.total)}
                          </td>
                          <td className="px-2 py-3 align-top">
                            <Badge
                              variant={
                                txn.status === 'refunded' || txn.status === 'partial_refund' || txn.status === 'void'
                                  ? 'destructive'
                                  : (txn.amount_tendered ?? 0) >= txn.total
                                    ? 'default'
                                    : 'secondary'
                              }
                              className="max-w-full whitespace-normal text-left"
                            >
                              {txn.status === 'void' || txn.status === 'refunded' || txn.status === 'partial_refund'
                                ? (STATUS_LABELS[txn.status] || txn.status)
                                : getPaymentStatusLabel(txn.amount_tendered ?? 0, txn.total)}
                            </Badge>
                          </td>
                          <td className="px-2 py-3 align-top break-words text-xs sm:text-sm">
                            {PAYMENT_METHOD_LABELS[txn.payment_method] || txn.payment_method}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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
