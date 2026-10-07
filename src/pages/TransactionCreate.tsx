import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { Plus, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTransactions } from '@/hooks/useTransactions';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { useClients, useAppointments, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import type { TransactionLineItemInput, PaymentMethod } from '@/types/transactions';
import { getPaymentStatusFromAmount } from '@/types/transactions';
import { normalizeTaxLabelForDisplay } from '@/lib/taxLabels';
import { validateCreatePayload } from '@/lib/transactionValidation';
import { devConsole } from '@/lib/clientDebug';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AthMovilChargeDialog } from '@/components/AthMovilChargeDialog';
import { callPayments, type AthMode, type PaymentAttempt } from '@/lib/payments';

function toCents(d: number): number {
  return Math.round(d * 100);
}
function fromCents(c: number): number {
  return c / 100;
}

export function TransactionCreate() {
  const businessSlug = useResolvedBusinessSlug();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlAppointmentId = searchParams.get('appointmentId');
  const { clients } = useClients();
  const { products } = useInventory();
  const { services } = useServices();
  const { appointments } = useAppointments();
  const { createTransaction, computeTax } = useTransactions();
  const demoBrowseOnly = useDemoBrowseOnly();
  const prefilledFromAppointment = useRef(false);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<TransactionLineItemInput[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  // ATH Móvil: charge through the app (test or real mode) when the business turned it on in Settings → Pagos.
  const [athMode, setAthMode] = useState<AthMode>('off');
  const [athOpen, setAthOpen] = useState(false);
  const [paidUnsaved, setPaidUnsaved] = useState<PaymentAttempt | null>(null);

  useEffect(() => {
    if (demoBrowseOnly) return;
    void callPayments<{ athmovil: { mode: AthMode } }>('settings_get').then(({ data }) => {
      if (data) setAthMode(data.athmovil.mode);
    });
  }, [demoBrowseOnly]);

  // A charge that was paid but whose transaction wasn't saved (e.g. the page closed): offer to finish it.
  useEffect(() => {
    if (!urlAppointmentId || demoBrowseOnly) return;
    void callPayments<{ payments: PaymentAttempt[] }>('unlinked_for_appointment', { appointmentId: urlAppointmentId }).then(
      ({ data }) => {
        if (data?.payments?.[0]) setPaidUnsaved(data.payments[0]);
      },
    );
  }, [urlAppointmentId, demoBrowseOnly]);

  // Prefill from appointment when opened via ?appointmentId=...
  useEffect(() => {
    if (!urlAppointmentId || prefilledFromAppointment.current || appointments.length === 0) return;
    const apt = appointments.find((a: { id: string }) => a.id === urlAppointmentId) as {
      client_id?: string;
      service_id?: string | null;
      service_type?: string | null;
      total_price?: number;
      price?: number;
    } | undefined;
    if (!apt) return;
    prefilledFromAppointment.current = true;
    const clientId = (apt as { client_id?: string }).client_id ?? null;
    setCustomerId(clientId);
    setAppointmentId(urlAppointmentId);
    const priceDollars = Number((apt as { total_price?: number }).total_price ?? (apt as { price?: number }).price ?? 0);
    const unitPriceCents = Math.round(priceDollars * 100);
    const serviceId = apt.service_id ?? null;
    const serviceTypeFirst = String(apt.service_type ?? '')
      .split(',')
      .map((s) => s.trim())
      .find(Boolean);

    let name: string;
    let refId: string;
    let up: number;

    // Multi-service bookings: one line per service at its list price.
    const allIds = ((apt as { service_ids?: string[] | null }).service_ids ?? []).filter(Boolean);
    const allSvcs = allIds.map((id) => services.find((s: { id: string }) => s.id === id)).filter(Boolean) as { id: string; name: string; price: number }[];
    if (allSvcs.length > 1) {
      setLineItems(allSvcs.map((s) => {
        const c = Math.round(Number(s.price) * 100);
        return { type: 'service' as const, reference_id: s.id, name: s.name, quantity: 1, unit_price: c, line_total: c };
      }));
      return;
    }

    if (serviceId) {
      const svc = services.find((s: { id: string }) => s.id === serviceId);
      if (svc) {
        name = svc.name;
        refId = svc.id;
        up = Math.round(Number(svc.price) * 100);
      } else if (serviceTypeFirst) {
        name = serviceTypeFirst;
        refId = serviceId;
        up = unitPriceCents;
      } else {
        name = 'Service';
        refId = serviceId;
        up = unitPriceCents;
      }
    } else if (serviceTypeFirst) {
      name = serviceTypeFirst;
      refId = 'service_type';
      up = unitPriceCents;
    } else {
      name = 'Service';
      refId = 'appointment';
      up = unitPriceCents;
    }
    setLineItems([{ type: 'service', reference_id: refId, name, quantity: 1, unit_price: up, line_total: up }]);
  }, [urlAppointmentId, appointments, services]);

  const subtotalCents = useMemo(() => lineItems.reduce((s, li) => s + li.line_total, 0), [lineItems]);
  const discountCents = toCents(discountAmount);
  const serviceSubtotalCents = useMemo(() => lineItems.filter((li) => li.type === 'service').reduce((s, li) => s + li.line_total, 0), [lineItems]);
  const productSubtotalCents = useMemo(() => lineItems.filter((li) => li.type === 'product').reduce((s, li) => s + li.line_total, 0), [lineItems]);
  const serviceTaxableCents = subtotalCents <= 0 ? 0 : Math.round(Math.max(0, serviceSubtotalCents - (discountCents * serviceSubtotalCents) / subtotalCents));
  const productTaxableCents = subtotalCents <= 0 ? 0 : Math.round(Math.max(0, productSubtotalCents - (discountCents * productSubtotalCents) / subtotalCents));
  const taxableCents = serviceTaxableCents + productTaxableCents;
  const [taxTotalCents, setTaxTotalCents] = useState(0);
  const [taxSnapshot, setTaxSnapshot] = useState<{ label: string; rate: number; amount: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    computeTax(serviceTaxableCents, productTaxableCents).then(({ taxSnapshot: snap, totalTaxCents }) => {
      if (!cancelled) {
        setTaxSnapshot(snap);
        setTaxTotalCents(totalTaxCents);
      }
    });
    return () => { cancelled = true; };
  }, [serviceTaxableCents, productTaxableCents, computeTax]);

  const tipCents = toCents(tipAmount);
  const totalCents = taxableCents + taxTotalCents + tipCents;
  const effectiveAmountTendered = amountTendered === '' ? totalCents / 100 : Number(amountTendered || 0);
  const changeCents = paymentMethod === 'cash' && (amountTendered !== '' || totalCents > 0) ? Math.max(0, toCents(effectiveAmountTendered) - totalCents) : 0;

  /** Cents last written by auto-sync; used so we can bump the field when tax/tip loads without clobbering manual edits. */
  const autoSyncTotalCentsRef = useRef<number | null>(null);
  useEffect(() => {
    if (paymentMethod !== 'cash') return;
    if (totalCents <= 0) {
      setAmountTendered('');
      autoSyncTotalCentsRef.current = null;
      return;
    }
    setAmountTendered((prev) => {
      const parsed = prev === '' ? null : toCents(Number(prev));
      const ref = autoSyncTotalCentsRef.current;
      if (prev === '' || (parsed != null && ref != null && parsed === ref)) {
        autoSyncTotalCentsRef.current = totalCents;
        return (totalCents / 100).toFixed(2);
      }
      return prev;
    });
  }, [totalCents, paymentMethod]);

  const addService = (serviceId: string, name: string, priceDollars: number, qty: number = 1) => {
    const up = Math.round(priceDollars * 100);
    const lineTotal = up * qty;
    setLineItems((prev) => [...prev, { type: 'service', reference_id: serviceId, name, quantity: qty, unit_price: up, line_total: lineTotal }]);
  };

  const addProduct = (productId: string, name: string, priceDollars: number, qty: number = 1, available: number) => {
    const take = Math.min(qty, available);
    if (take <= 0) {
      toast.error(t('transactions.insufficientStock'));
      return;
    }
    const up = Math.round(priceDollars * 100);
    setLineItems((prev) => [...prev, { type: 'product', reference_id: productId, name, quantity: take, unit_price: up, line_total: up * take }]);
  };

  const removeLine = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineQty = (index: number, qty: number) => {
    if (qty < 1) return;
    setLineItems((prev) => {
      const next = [...prev];
      const li = next[index];
      next[index] = { ...li, quantity: qty, line_total: li.unit_price * qty };
      return next;
    });
  };

  const buildPayload = (athPaid?: PaymentAttempt) => {
    const paidCents = athPaid ? athPaid.amountPaidCents ?? athPaid.amountCents : null;
    const tendered = paidCents ?? (paymentMethod === 'cash' ? toCents(Number(amountTendered || totalCents / 100)) : totalCents);
    const athNote = athPaid?.receiptReference ? `ATH Móvil ref. ${athPaid.receiptReference}` : null;
    return {
      customer_id: customerId,
      appointment_id: appointmentId,
      line_items: lineItems,
      discount_amount: toCents(discountAmount),
      discount_label: discountLabel || null,
      tip_amount: tipCents,
      payment_method: athPaid ? ('ath_movil' as PaymentMethod) : paymentMethod,
      payment_method_secondary: null,
      amount_tendered: tendered,
      change_given: !athPaid && paymentMethod === 'cash' ? changeCents : null,
      status: getPaymentStatusFromAmount(tendered, totalCents),
      notes: [notes || null, athNote].filter(Boolean).join(' · ') || null,
    };
  };

  const athActive = paymentMethod === 'ath_movil' && athMode !== 'off';

  /** Validate, then either open the ATH Móvil charge or save directly. */
  const handlePrimary = () => {
    if (athActive) {
      const validation = validateCreatePayload(buildPayload() as Parameters<typeof validateCreatePayload>[0]);
      if (validation.valid === false) {
        toast.error(validation.error);
        return;
      }
      setAthOpen(true);
      return;
    }
    void handleSave();
  };

  const handleSave = async (athPaid?: PaymentAttempt) => {
    const payload = buildPayload(athPaid);
    const validation = validateCreatePayload(payload as any);
    if (validation.valid === false) {
      toast.error(validation.error);
      return;
    }
    setSaving(true);
    const result = await createTransaction(payload as any);
    setSaving(false);
    if (result.error) {
      devConsole.error('[TransactionCreate] createTransaction', result.error);
      if (athPaid) {
        // Money was received; keep the payment so "Guardar" retries without charging again.
        setPaidUnsaved(athPaid);
        toast.error(t('payments.charge.paidNotSaved'));
      } else {
        toast.error(t('common.genericError'));
      }
      return;
    }
    const created = result.data;
    const createdLineItems = (result as { lineItems?: typeof lineItems }).lineItems;
    if (created && athPaid) {
      await callPayments('link_transaction', { paymentId: athPaid.id, transactionId: created.id });
      setPaidUnsaved(null);
    }
    if (created) {
      toast.success(t('transactions.created'));
      navigate(`/${businessSlug}/transactions/${created.id}`, {
        state: created.id.startsWith('local-') && createdLineItems
          ? { transaction: created, lineItems: createdLineItems }
          : undefined,
      });
    } else {
      toast.error(t('common.genericError'));
    }
  };

  const customerName = customerId ? (() => {
    const c = clients.find((x) => x.id === customerId);
    return c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email : '—';
  })() : 'Walk-in';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={() => navigate(`/${businessSlug}/transactions`)}>
          {t('common.cancel')}
        </Button>
      </div>

      {demoBrowseOnly && (
        <Alert variant="warning">
          <AlertDescription>{t('demo.workspaceReadOnlyAction')}</AlertDescription>
        </Alert>
      )}

      {paidUnsaved ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {t('payments.charge.paidUnsavedBanner', { amount: `$${fromCents(paidUnsaved.amountPaidCents ?? paidUnsaved.amountCents).toFixed(2)}` })}
            </span>
            <Button size="sm" disabled={saving || lineItems.length === 0} onClick={() => void handleSave(paidUnsaved)}>
              {t('transactions.saveTransaction')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.customer')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-between">
                {customerName}
                <Search className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('transactions.searchCustomer')} />
                <CommandList>
                  <CommandEmpty>{t('transactions.noCustomers')}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { setCustomerId(null); setAppointmentId(null); }}>
                      {t('transactions.walkIn')}
                    </CommandItem>
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        onSelect={() => setCustomerId(c.id)}
                      >
                        {(c.first_name && c.last_name) ? `${c.first_name} ${c.last_name}` : c.email}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.lineItems')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> {t('transactions.addServiceLine')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('transactions.searchServices')} />
                  <CommandList>
                    {services.filter((s) => s.is_active !== false).map((s) => (
                      <CommandItem
                        key={s.id}
                        onSelect={() => addService(s.id, s.name, Number(s.price))}
                      >
                        {s.name} · ${Number(s.price).toFixed(2)}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> {t('transactions.addProductLine')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('transactions.searchProducts')} />
                  <CommandList>
                    {products.map((p) => (
                      <CommandItem
                        key={p.id}
                        onSelect={() => addProduct(p.id, p.name, p.price, 1, p.quantity)}
                      >
                        {p.name} · ${p.price.toFixed(2)} (stock: {p.quantity})
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('transactions.addItemsHint')}</p>
          ) : (
            <ul className="space-y-2">
              {lineItems.map((li, i) => (
                <li key={i} className="flex items-center gap-2 py-2 border-b">
                  <span className="flex-1 truncate">{li.name}</span>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={li.quantity}
                    onChange={(e) => updateLineQty(i, Number(e.target.value) || 1)}
                  />
                  <span className="w-24 text-right">${fromCents(li.unit_price).toFixed(2)}</span>
                  <span className="w-24 text-right font-medium">${fromCents(li.line_total).toFixed(2)}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.adjustments')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-2">
              <Label>{t('transactions.discount')} ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transactions.discountLabel')}</Label>
              <Input
                placeholder={t('transactions.discountLabelExample')}
                value={discountLabel}
                onChange={(e) => setDiscountLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transactions.tip')} ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={tipAmount || ''}
                onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.summary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>{t('transactions.subtotal')}</span>
            <span>${fromCents(subtotalCents).toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('transactions.discount')}</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          {taxSnapshot.length > 0 ? (
            taxSnapshot.map((tax) => (
              <div key={tax.label} className="flex justify-between">
                <span>{normalizeTaxLabelForDisplay(tax.label)} ({tax.rate}%)</span>
                <span>${fromCents(tax.amount).toFixed(2)}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('transactions.tax')}</span>
              <span>$0.00</span>
            </div>
          )}
          {tipCents > 0 && (
            <div className="flex justify-between">
              <span>{t('transactions.tip')}</span>
              <span>${fromCents(tipCents).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t">
            <span>{t('transactions.total')}</span>
            <span>${fromCents(totalCents).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions.payment')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('transactions.paymentMethod')}</Label>
            <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('transactions.paymentCash')}</SelectItem>
                <SelectItem value="card">{t('transactions.paymentCard')}</SelectItem>
                <SelectItem value="ath_movil">ATH Móvil</SelectItem>
                <SelectItem value="other">{t('transactions.paymentOther')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === 'ath_movil' ? (
            <p className="text-xs text-muted-foreground">
              {athMode === 'off' ? t('payments.charge.athOffHint') : athMode === 'simulator' ? t('payments.charge.athTestHint') : t('payments.charge.athLiveHint')}
            </p>
          ) : null}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Label>{t('transactions.amountTendered')} ($)</Label>
              <p className="text-xs text-muted-foreground">{t('transactions.amountTenderedIncludesTaxTip')}</p>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                placeholder={totalCents > 0 ? fromCents(totalCents).toFixed(2) : undefined}
              />
              {changeCents > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('transactions.changeDue')}: ${fromCents(changeCents).toFixed(2)}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('transactions.notes')}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('transactions.notesPlaceholder')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handlePrimary} disabled={demoBrowseOnly || saving || lineItems.length === 0 || !!paidUnsaved}>
          {saving ? t('common.saving') : athActive ? t('payments.charge.chargeWithAth') : t('transactions.saveTransaction')}
        </Button>
        <Button variant="outline" onClick={() => navigate(`/${businessSlug}/transactions`)}>
          {t('common.cancel')}
        </Button>
      </div>

      <AthMovilChargeDialog
        open={athOpen}
        onOpenChange={setAthOpen}
        amountCents={totalCents}
        mode={athMode}
        defaultPhone={clients.find((c) => c.id === customerId)?.phone ?? null}
        appointmentId={appointmentId}
        customerId={customerId}
        description={lineItems.map((li) => li.name).join(', ').slice(0, 60)}
        onPaid={(p) => {
          window.setTimeout(() => setAthOpen(false), 1200);
          void handleSave(p);
        }}
      />
    </div>
  );
}
