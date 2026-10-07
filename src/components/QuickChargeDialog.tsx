import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Smartphone,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClients, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import { useTransactions } from '@/hooks/useTransactions';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { getPaymentStatusFromAmount, type PaymentMethod, type TransactionLineItemInput } from '@/types/transactions';
import { validateCreatePayload } from '@/lib/transactionValidation';
import { normalizeTaxLabelForDisplay } from '@/lib/taxLabels';
import { devConsole } from '@/lib/clientDebug';
import { AthMovilChargeDialog } from '@/components/AthMovilChargeDialog';
import { callPayments, type AthMode, type PaymentAttempt } from '@/lib/payments';

/** What a caller knows when it opens the charge panel (all optional: a walk-in sale passes nothing). */
export interface QuickChargeRequest {
  appointmentId?: string | null;
  clientId?: string | null;
  serviceIds?: string[];
  /** Appointment total in dollars, used only when its services can't be found. */
  fallbackPrice?: number | null;
  /** Shown under the title, e.g. "Max · Baño completo". */
  label?: string | null;
}

const OPEN_EVENT = 'grumi-open-quick-charge';
export const QUICK_CHARGE_DONE_EVENT = 'grumi-quick-charge-done';

/** Opens the charge panel from anywhere in the app (it lives in Layout). */
export function openQuickCharge(request: QuickChargeRequest = {}) {
  window.dispatchEvent(new CustomEvent<QuickChargeRequest>(OPEN_EVENT, { detail: request }));
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const toCents = (dollars: number) => Math.round(dollars * 100);
const TIP_PERCENTS = [0, 10, 15, 20] as const;
const METHODS: { id: PaymentMethod; icon: typeof Banknote; label: () => string }[] = [
  { id: 'cash', icon: Banknote, label: () => t('transactions.paymentCash') },
  { id: 'ath_movil', icon: Smartphone, label: () => 'ATH Móvil' },
  { id: 'card', icon: CreditCard, label: () => t('transactions.paymentCard') },
  { id: 'other', icon: MoreHorizontal, label: () => t('transactions.paymentOther') },
];

/** Mounted once in Layout; listens for openQuickCharge(). */
export function QuickChargeHost() {
  const [request, setRequest] = useState<QuickChargeRequest | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    const h = (e: Event) => {
      setRequest((e as CustomEvent<QuickChargeRequest>).detail ?? {});
      setSession((s) => s + 1);
    };
    window.addEventListener(OPEN_EVENT, h);
    return () => window.removeEventListener(OPEN_EVENT, h);
  }, []);

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && setRequest(null)}>
      {request ? <QuickChargeContent key={session} request={request} onClose={() => setRequest(null)} /> : null}
    </Dialog>
  );
}

type Done = { id: string; totalCents: number; method: PaymentMethod; changeCents: number; isTest: boolean };

function QuickChargeContent({ request, onClose }: { request: QuickChargeRequest; onClose: () => void }) {
  useLanguage();
  const navigate = useNavigate();
  const slug = useResolvedBusinessSlug();
  const demoBrowseOnly = useDemoBrowseOnly();
  const { clients } = useClients();
  const { services } = useServices();
  const { products } = useInventory();
  const { createTransaction, computeTax } = useTransactions();

  const [clientId, setClientId] = useState<string | null>(request.clientId ?? null);
  const [items, setItems] = useState<TransactionLineItemInput[]>([]);
  const [tipPercent, setTipPercent] = useState<number | null>(0);
  const [tipCustom, setTipCustom] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [received, setReceived] = useState('');
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [athMode, setAthMode] = useState<AthMode>('off');
  const [athOpen, setAthOpen] = useState(false);
  const [paidUnsaved, setPaidUnsaved] = useState<PaymentAttempt | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (demoBrowseOnly) return;
    void callPayments<{ athmovil: { mode: AthMode } }>('settings_get').then(({ data }) => {
      if (data) setAthMode(data.athmovil.mode);
    });
    if (request.appointmentId) {
      void callPayments<{ payments: PaymentAttempt[] }>('unlinked_for_appointment', { appointmentId: request.appointmentId }).then(
        ({ data }) => data?.payments?.[0] && setPaidUnsaved(data.payments[0]),
      );
    }
  }, [demoBrowseOnly, request.appointmentId]);

  // Prefill the appointment's services once the service list loads.
  useEffect(() => {
    if (prefilled.current) return;
    const ids = request.serviceIds ?? [];
    if (ids.length === 0 && request.fallbackPrice == null) {
      prefilled.current = true;
      return;
    }
    if (ids.length > 0 && services.length === 0) return;
    prefilled.current = true;
    const found = ids.map((id) => services.find((s) => s.id === id)).filter(Boolean) as { id: string; name: string; price: number }[];
    if (found.length > 0) {
      setItems(found.map((s) => line('service', s.id, s.name, toCents(Number(s.price)))));
    } else if (request.fallbackPrice != null && Number(request.fallbackPrice) > 0) {
      setItems([line('service', 'appointment', request.label || t('quickCharge.serviceFallback'), toCents(Number(request.fallbackPrice)))]);
    }
  }, [services, request]);

  const subtotal = items.reduce((s, li) => s + li.line_total, 0);
  const discountCents = Math.min(subtotal, Math.max(0, toCents(Number(discount) || 0)));
  const serviceSub = items.filter((li) => li.type === 'service').reduce((s, li) => s + li.line_total, 0);
  const productSub = subtotal - serviceSub;
  const serviceTaxable = subtotal > 0 ? Math.round(serviceSub - (discountCents * serviceSub) / subtotal) : 0;
  const productTaxable = subtotal > 0 ? Math.round(productSub - (discountCents * productSub) / subtotal) : 0;
  const [tax, setTax] = useState<{ total: number; lines: { label: string; rate: number; amount: number }[] }>({ total: 0, lines: [] });
  useEffect(() => {
    let cancelled = false;
    void computeTax(serviceTaxable, productTaxable).then(({ taxSnapshot, totalTaxCents }) => {
      if (!cancelled) setTax({ total: totalTaxCents, lines: taxSnapshot });
    });
    return () => {
      cancelled = true;
    };
  }, [serviceTaxable, productTaxable, computeTax]);

  // Tip is a percent of the pre-tax services and products after discount.
  const tipBase = serviceTaxable + productTaxable;
  const tipCents = tipPercent == null ? Math.max(0, toCents(Number(tipCustom) || 0)) : Math.round((tipBase * tipPercent) / 100);
  const total = serviceTaxable + productTaxable + tax.total + tipCents;
  const receivedCents = received === '' ? total : toCents(Number(received) || 0);
  const changeCents = method === 'cash' ? Math.max(0, receivedCents - total) : 0;
  const shortCents = method === 'cash' ? Math.max(0, total - receivedCents) : 0;
  const athLive = method === 'ath_movil' && athMode !== 'off';

  const client = clients.find((c) => c.id === clientId);
  const clientName = client ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || client.email : t('transactions.walkIn');
  const activeServices = useMemo(() => services.filter((s) => (s as { is_active?: boolean | null }).is_active !== false), [services]);

  const addItem = (li: TransactionLineItemInput) =>
    setItems((prev) => {
      const i = prev.findIndex((p) => p.type === li.type && p.reference_id === li.reference_id && li.reference_id !== 'custom');
      if (i < 0) return [...prev, li];
      const next = [...prev];
      const q = next[i].quantity + 1;
      next[i] = { ...next[i], quantity: q, line_total: next[i].unit_price * q };
      return next;
    });

  const addCustom = () => {
    const cents = toCents(Number(customAmount) || 0);
    if (cents <= 0) return;
    addItem(line('service', 'custom', customName.trim() || t('quickCharge.customLine'), cents));
    setCustomName('');
    setCustomAmount('');
  };

  const buildPayload = (athPaid?: PaymentAttempt) => {
    const paid = athPaid ? athPaid.amountPaidCents ?? athPaid.amountCents : method === 'cash' ? receivedCents : total;
    const ref = athPaid?.receiptReference ? `ATH Móvil ref. ${athPaid.receiptReference}` : null;
    return {
      customer_id: clientId,
      appointment_id: request.appointmentId ?? null,
      line_items: items,
      discount_amount: discountCents,
      discount_label: discountCents > 0 ? t('transactions.discount') : null,
      tip_amount: tipCents,
      payment_method: athPaid ? ('ath_movil' as PaymentMethod) : method,
      payment_method_secondary: null,
      amount_tendered: paid,
      change_given: !athPaid && method === 'cash' ? changeCents : null,
      status: getPaymentStatusFromAmount(paid, total),
      notes: [notes.trim() || null, ref].filter(Boolean).join(' · ') || null,
    };
  };

  const save = useCallback(
    async (athPaid?: PaymentAttempt) => {
      const payload = buildPayload(athPaid);
      const check = validateCreatePayload(payload as Parameters<typeof validateCreatePayload>[0]);
      if (check.valid === false) {
        toast.error(check.error);
        return;
      }
      setSaving(true);
      const result = await createTransaction(payload as Parameters<typeof createTransaction>[0]);
      if (result.error || !result.data) {
        setSaving(false);
        devConsole.error('[QuickCharge] createTransaction', result.error);
        if (athPaid) setPaidUnsaved(athPaid);
        toast.error(athPaid ? t('payments.charge.paidNotSaved') : t('common.genericError'));
        return;
      }
      let isTest = false;
      if (athPaid) {
        const { data } = await callPayments<{ ok: boolean; isTest?: boolean }>('link_transaction', {
          paymentId: athPaid.id,
          transactionId: result.data.id,
        });
        isTest = !!data?.isTest;
        setPaidUnsaved(null);
      }
      setSaving(false);
      setDone({ id: result.data.id, totalCents: total, method: payload.payment_method, changeCents: athPaid ? 0 : changeCents, isTest });
      window.dispatchEvent(new CustomEvent(QUICK_CHARGE_DONE_EVENT, { detail: { appointmentId: request.appointmentId ?? null } }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, clientId, discountCents, tipCents, method, receivedCents, changeCents, total, notes, request.appointmentId],
  );

  const charge = () => {
    if (items.length === 0) return;
    if (method === 'cash' && shortCents > 0) {
      toast.error(t('quickCharge.notEnoughCash'));
      return;
    }
    if (athLive) {
      const check = validateCreatePayload(buildPayload() as Parameters<typeof validateCreatePayload>[0]);
      if (check.valid === false) {
        toast.error(check.error);
        return;
      }
      setAthOpen(true);
      return;
    }
    void save();
  };

  if (done) {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('quickCharge.paidTitle')}</DialogTitle>
          <DialogDescription>{money(done.totalCents)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
          <p className="text-lg font-semibold">{t('quickCharge.paidTitle')}</p>
          <p className="text-3xl font-bold tabular-nums">{money(done.totalCents)}</p>
          <p className="text-sm text-muted-foreground">{METHODS.find((m) => m.id === done.method)?.label()}</p>
          {done.changeCents > 0 ? (
            <p className="mt-2 rounded-lg bg-amber-500/10 px-4 py-2 text-base font-semibold text-amber-900 dark:text-amber-100">
              {t('quickCharge.giveChange', { amount: money(done.changeCents) })}
            </p>
          ) : null}
          {done.isTest ? <p className="text-xs text-muted-foreground">{t('transactions.testSaleHint')}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              navigate(`/${slug}/transactions/${done.id}`);
            }}
          >
            {t('quickCharge.viewReceipt')}
          </Button>
          <Button onClick={onClose}>{t('quickCharge.done')}</Button>
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
      <DialogHeader className="border-b px-5 pb-3 pt-5 text-left">
        <DialogTitle className="text-xl">{t('quickCharge.title')}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm text-foreground hover:bg-muted">
                <User className="h-3.5 w-3.5" /> {clientName} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('transactions.searchCustomer')} />
                <CommandList>
                  <CommandEmpty>{t('transactions.noCustomers')}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => setClientId(null)}>{t('transactions.walkIn')}</CommandItem>
                    {clients.map((c) => (
                      <CommandItem key={c.id} value={`${c.first_name ?? ''} ${c.last_name ?? ''} ${c.phone ?? ''} ${c.id}`} onSelect={() => setClientId(c.id)}>
                        {`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {request.label ? <span className="truncate text-sm">{request.label}</span> : null}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {paidUnsaved ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <span>{t('payments.charge.paidUnsavedBanner', { amount: money(paidUnsaved.amountPaidCents ?? paidUnsaved.amountCents) })}</span>
            <Button size="sm" disabled={saving || items.length === 0} onClick={() => void save(paidUnsaved)}>
              {t('transactions.saveTransaction')}
            </Button>
          </div>
        ) : null}

        {/* Items */}
        <section className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('quickCharge.pickHint')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {items.map((li, i) => (
                <li key={`${li.reference_id}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {li.name}
                    {li.quantity > 1 ? <span className="text-muted-foreground"> ×{li.quantity}</span> : null}
                  </span>
                  <span className="tabular-nums">{money(li.line_total)}</span>
                  <button
                    type="button"
                    aria-label={t('common.delete')}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            {activeServices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addItem(line('service', s.id, s.name, toCents(Number(s.price))))}
                className="rounded-full border px-3 py-1.5 text-sm hover:border-primary hover:bg-primary/5"
              >
                {s.name} <span className="text-muted-foreground">{money(toCents(Number(s.price)))}</span>
              </button>
            ))}
            {products.length > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm hover:bg-muted">
                    <Package className="h-3.5 w-3.5" /> {t('quickCharge.product')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('transactions.searchProducts')} />
                    <CommandList>
                      <CommandEmpty>{t('quickCharge.noProducts')}</CommandEmpty>
                      {products.map((p) => (
                        <CommandItem
                          key={p.id}
                          disabled={p.quantity <= 0}
                          onSelect={() => addItem(line('product', p.id, p.name, toCents(p.price)))}
                        >
                          <span className="flex-1">{p.name}</span>
                          <span className="text-muted-foreground">{money(toCents(p.price))}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t('quickCharge.customLine')}
              className="h-9"
            />
            <Input
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              inputMode="decimal"
              placeholder="$0.00"
              className="h-9 w-24"
            />
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={addCustom} disabled={!(Number(customAmount) > 0)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Tip */}
        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t('transactions.tip')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {TIP_PERCENTS.map((p) => (
              <Chip key={p} active={tipPercent === p} onClick={() => setTipPercent(p)}>
                {p === 0 ? t('quickCharge.noTip') : `${p}%`}
              </Chip>
            ))}
            <Chip active={tipPercent == null} onClick={() => setTipPercent(null)}>
              {t('quickCharge.otherAmount')}
            </Chip>
            {tipPercent == null ? (
              <Input value={tipCustom} onChange={(e) => setTipCustom(e.target.value)} inputMode="decimal" placeholder="$0.00" className="h-8 w-24" autoFocus />
            ) : null}
          </div>
        </section>

        <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowMore((v) => !v)}>
          {showMore ? t('quickCharge.lessOptions') : t('quickCharge.moreOptions')}
        </button>
        {showMore ? (
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('transactions.discount')} ($)</Label>
              <Input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('transactions.notes')}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('transactions.notesPlaceholder')} />
            </div>
          </section>
        ) : null}

        {/* Totals */}
        <section className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <Row label={t('transactions.subtotal')} value={money(subtotal)} />
          {discountCents > 0 ? <Row label={t('transactions.discount')} value={`-${money(discountCents)}`} /> : null}
          {tax.lines.map((x) => (
            <Row key={x.label} label={`${normalizeTaxLabelForDisplay(x.label)} (${x.rate}%)`} value={money(x.amount)} />
          ))}
          {tipCents > 0 ? <Row label={t('transactions.tip')} value={money(tipCents)} /> : null}
          <div className="flex items-baseline justify-between border-t pt-2">
            <span className="font-semibold">{t('transactions.total')}</span>
            <span className="text-2xl font-bold tabular-nums">{money(total)}</span>
          </div>
        </section>

        {/* Payment method */}
        <section className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map(({ id, icon: Icon, label: methodLabel }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs font-medium transition-colors',
                  method === id ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-5 w-5" />
                {methodLabel()}
              </button>
            ))}
          </div>
          {method === 'cash' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Label className="mr-1 text-sm">{t('quickCharge.received')}</Label>
              <Chip active={received === ''} onClick={() => setReceived('')}>
                {t('quickCharge.exact')}
              </Chip>
              {[20, 50, 100]
                .filter((b) => toCents(b) > total)
                .map((b) => (
                  <Chip key={b} active={received === String(b)} onClick={() => setReceived(String(b))}>
                    ${b}
                  </Chip>
                ))}
              <Input
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                inputMode="decimal"
                placeholder={(total / 100).toFixed(2)}
                className="h-8 w-24"
              />
              {changeCents > 0 ? (
                <span className="ml-auto text-sm font-semibold">{t('quickCharge.change', { amount: money(changeCents) })}</span>
              ) : null}
            </div>
          ) : method === 'ath_movil' ? (
            <p className="text-xs text-muted-foreground">
              {athMode === 'off' ? t('payments.charge.athOffHint') : athMode === 'simulator' ? t('payments.charge.athTestHint') : t('payments.charge.athLiveHint')}
            </p>
          ) : method === 'card' ? (
            <p className="text-xs text-muted-foreground">{t('quickCharge.cardHint')}</p>
          ) : null}
        </section>
      </div>

      <div className="border-t p-4">
        <Button
          className="h-12 w-full text-base"
          disabled={demoBrowseOnly || saving || items.length === 0 || total <= 0 || !!paidUnsaved}
          onClick={charge}
        >
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {athLive ? t('quickCharge.chargeAth', { amount: money(total) }) : t('quickCharge.charge', { amount: money(total) })}
        </Button>
        {demoBrowseOnly ? <p className="mt-2 text-center text-xs text-muted-foreground">{t('demo.workspaceReadOnlyAction')}</p> : null}
      </div>

      <AthMovilChargeDialog
        open={athOpen}
        onOpenChange={setAthOpen}
        amountCents={total}
        mode={athMode}
        defaultPhone={client?.phone ?? null}
        appointmentId={request.appointmentId ?? null}
        customerId={clientId}
        description={items.map((li) => li.name).join(', ').slice(0, 60)}
        onPaid={(p) => {
          window.setTimeout(() => setAthOpen(false), 1200);
          void save(p);
        }}
      />
    </DialogContent>
  );
}

function line(type: 'service' | 'product', referenceId: string, name: string, unitCents: number): TransactionLineItemInput {
  return { type, reference_id: referenceId, name, quantity: 1, unit_price: unitCents, line_total: unitCents };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
