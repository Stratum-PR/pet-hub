import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTransactions } from '@/hooks/useTransactions';
import { useClients, useAppointments, useServices } from '@/hooks/useSupabaseData';
import { useInventory } from '@/hooks/useInventory';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import type { TransactionLineItemInput } from '@/types/transactions';
import type { PaymentMethod } from '@/types/transactions';

function toCents(d: number): number {
  return Math.round(d * 100);
}
function fromCents(c: number): number {
  return c / 100;
}

export function TransactionCreate() {
  const { businessSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlAppointmentId = searchParams.get('appointmentId');
  const { clients } = useClients();
  const { products } = useInventory();
  const { services } = useServices();
  const { appointments } = useAppointments();
  const { createTransaction, computeTax } = useTransactions();
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

  // Prefill from appointment when opened via ?appointmentId=...
  useEffect(() => {
    if (!urlAppointmentId || prefilledFromAppointment.current || appointments.length === 0) return;
    const apt = appointments.find((a: { id: string }) => a.id === urlAppointmentId) as { client_id?: string; service_id?: string; total_price?: number; price?: number } | undefined;
    if (!apt) return;
    prefilledFromAppointment.current = true;
    const clientId = (apt as { client_id?: string }).client_id ?? null;
    setCustomerId(clientId);
    setAppointmentId(urlAppointmentId);
    const priceDollars = Number((apt as { total_price?: number }).total_price ?? (apt as { price?: number }).price ?? 0);
    const unitPriceCents = Math.round(priceDollars * 100);
    const serviceId = (apt as { service_id?: string }).service_id;
    let name: string;
    let refId: string;
    let up: number;
    if (serviceId) {
      const svc = services.find((s: { id: string }) => s.id === serviceId);
      if (svc) {
        name = svc.name;
        refId = svc.id;
        up = Math.round(Number(svc.price) * 100);
      } else {
        name = `Appointment ${urlAppointmentId.slice(0, 8)}`;
        refId = 'appointment';
        up = unitPriceCents;
      }
    } else {
      name = `Appointment ${urlAppointmentId.slice(0, 8)}`;
      refId = 'appointment';
      up = unitPriceCents;
    }
    setLineItems([{ type: 'service', reference_id: refId, name, quantity: 1, unit_price: up, line_total: up }]);
  }, [urlAppointmentId, appointments, services]);

  const subtotalCents = useMemo(() => lineItems.reduce((s, li) => s + li.line_total, 0), [lineItems]);
  const taxableCents = Math.max(0, subtotalCents - toCents(discountAmount));
  const [taxTotalCents, setTaxTotalCents] = useState(0);
  const [taxSnapshot, setTaxSnapshot] = useState<{ label: string; rate: number; amount: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    computeTax(taxableCents).then(({ taxSnapshot: snap, totalTaxCents }) => {
      if (!cancelled) {
        setTaxSnapshot(snap);
        setTaxTotalCents(totalTaxCents);
      }
    });
    return () => { cancelled = true; };
  }, [taxableCents, computeTax]);

  const tipCents = toCents(tipAmount);
  const totalCents = taxableCents + taxTotalCents + tipCents;
  const changeCents = paymentMethod === 'cash' && amountTendered ? Math.max(0, toCents(Number(amountTendered)) - totalCents) : 0;

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

  const handleSave = async () => {
    if (lineItems.length === 0) {
      toast.error(t('transactions.addAtLeastOneItem'));
      return;
    }
    setSaving(true);
    const result = await createTransaction({
      customer_id: customerId,
      appointment_id: appointmentId,
      line_items: lineItems,
      discount_amount: toCents(discountAmount),
      discount_label: discountLabel || null,
      tip_amount: tipCents,
      payment_method: paymentMethod,
      payment_method_secondary: null,
      amount_tendered: paymentMethod === 'cash' ? toCents(Number(amountTendered || 0)) : totalCents,
      change_given: paymentMethod === 'cash' ? changeCents : null,
      status: totalCents <= toCents(Number(amountTendered || 0)) ? 'paid' : 'partial',
      notes: notes || null,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const created = result.data;
    const createdLineItems = (result as { lineItems?: typeof lineItems }).lineItems;
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('transactions.newTransaction')}</h1>
        <Button variant="outline" onClick={() => navigate(`/${businessSlug}/transactions`)}>
          {t('common.cancel')}
        </Button>
      </div>

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
                      Walk-in
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
                  <Plus className="h-4 w-4" /> Add service
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search services..." />
                  <CommandList>
                    {services.filter((s) => s.is_active !== false).map((s) => (
                      <CommandItem
                        key={s.id}
                        onSelect={() => addService(s.id, s.name, Number(s.price))}
                      >
                        {s.name} — ${Number(s.price).toFixed(2)}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Add product
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search products..." />
                  <CommandList>
                    {products.map((p) => (
                      <CommandItem
                        key={p.id}
                        onSelect={() => addProduct(p.id, p.name, p.price, 1, p.quantity)}
                      >
                        {p.name} — ${p.price.toFixed(2)} (stock: {p.quantity})
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
                placeholder="e.g. Loyalty"
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
                <span>{tax.label} ({tax.rate}%)</span>
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
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="ath_movil">ATH Móvil</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Label>{t('transactions.amountTendered')} ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
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
        <Button onClick={handleSave} disabled={saving || lineItems.length === 0}>
          {saving ? t('common.saving') : t('transactions.saveTransaction')}
        </Button>
        <Button variant="outline" onClick={() => navigate(`/${businessSlug}/transactions`)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
