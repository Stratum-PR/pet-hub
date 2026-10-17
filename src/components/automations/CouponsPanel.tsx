import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Copy, Gift, Loader2, Pencil, Plus, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { devConsole } from '@/lib/clientDebug';
import { makeCouponCode, normalizeCouponCode, type CouponKind } from '@/lib/automations';
import {
  couponKeys,
  couponOffersTable,
  couponsTable,
  useCouponOffers,
  useCouponRedemptions,
  useIssuedCoupons,
  type CouponOffer,
} from '@/lib/coupons';
import { t } from '@/lib/translations';
import { offerLabel } from './automationText';

type Option = { id: string; name: string };
type ClientOption = { id: string; name: string };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CouponsPanel({
  businessId,
  canManage,
  services,
  products,
  clients,
}: {
  businessId: string;
  canManage: boolean;
  services: Option[];
  products: Option[];
  clients: ClientOption[];
}) {
  const queryClient = useQueryClient();
  const offersQuery = useCouponOffers(businessId);
  const codesQuery = useIssuedCoupons(businessId);
  const redemptionsQuery = useCouponRedemptions(businessId);
  const [editing, setEditing] = useState<Partial<CouponOffer> | null>(null);
  const [issuing, setIssuing] = useState(false);

  const offers = offersQuery.data ?? [];
  const codes = useMemo(() => codesQuery.data ?? [], [codesQuery.data]);
  const redemptions = useMemo(() => redemptionsQuery.data ?? [], [redemptionsQuery.data]);
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? '—';
  const offerById = (id: string) => offers.find((o) => o.id === id);
  const label = (o: CouponOffer) =>
    offerLabel(o, services.find((s) => s.id === o.service_id)?.name, products.find((p) => p.id === o.product_id)?.name);

  const stats = useMemo(() => {
    const out = new Map<string, { issued: number; redeemed: number; discount: number; sales: number }>();
    const get = (id: string) => {
      const v = out.get(id) ?? { issued: 0, redeemed: 0, discount: 0, sales: 0 };
      out.set(id, v);
      return v;
    };
    for (const c of codes) get(c.offer_id).issued += 1;
    for (const r of redemptions) {
      const v = get(r.offer_id);
      v.redeemed += 1;
      v.discount += Number(r.discount_cents ?? 0);
      v.sales += Number((r as { sale_cents?: number }).sale_cents ?? 0);
    }
    return out;
  }, [codes, redemptions]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: couponKeys.offers(businessId) });
    void queryClient.invalidateQueries({ queryKey: couponKeys.codes(businessId) });
    void queryClient.invalidateQueries({ queryKey: ['coupon_offers', 'any', businessId] });
  };

  const toggleActive = async (o: CouponOffer) => {
    const { error } = await couponOffersTable().update({ active: !o.active }).eq('id', o.id);
    if (error) toast.error(t('common.genericError'));
    refresh();
  };

  const voidCode = async (id: string) => {
    const { error } = await couponsTable().update({ status: 'void' }).eq('id', id);
    if (error) toast.error(t('common.genericError'));
    refresh();
  };

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(code);
    toast.success(t('cpn.copied'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('cpn.subtitle')}</p>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offers.length === 0} onClick={() => setIssuing(true)}>
              <Ticket className="mr-2 h-4 w-4" />
              {t('cpn.issue')}
            </Button>
            <Button size="sm" onClick={() => setEditing({ kind: 'percent', value: 10, code_mode: 'unique', valid_days: 30, one_per_client: true, online_booking: true, active: true })}>
              <Plus className="mr-2 h-4 w-4" />
              {t('cpn.new')}
            </Button>
          </div>
        )}
      </div>

      {offers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t('cpn.empty')}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {offers.map((o) => {
            const s = stats.get(o.id) ?? { issued: 0, redeemed: 0, discount: 0, sales: 0 };
            return (
              <li key={o.id}>
                <Card className={o.active ? '' : 'opacity-60'}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          <Gift className="h-4 w-4 text-primary" />
                          {o.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{label(o)}</p>
                      </div>
                      {canManage && <Switch checked={o.active} onCheckedChange={() => void toggleActive(o)} aria-label={t('cpn.active')} />}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {o.code_mode === 'shared' ? (
                        <Badge variant="outline" className="cursor-pointer font-mono" onClick={() => copy(o.shared_code ?? '')}>
                          {o.shared_code} <Copy className="ml-1 h-3 w-3" />
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t('cpn.mode.unique')}</Badge>
                      )}
                      {o.online_booking && <Badge variant="secondary">{t('cpn.onlineBooking')}</Badge>}
                      {o.expires_on && (
                        <Badge variant="secondary">
                          {t('cpn.expiresOn')} {o.expires_on}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.code_mode === 'unique' ? `${s.issued} ${t('cpn.stats.issued')} · ` : ''}
                      {s.redeemed} {t('cpn.stats.redeemed')} · {money(s.discount)} {t('cpn.stats.discount')} · {money(s.sales)} {t('cpn.stats.sales')}
                    </p>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(o)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('cpn.edit')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">{t('cpn.codes')}</h3>
        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('cpn.codesEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs">
                <tr>
                  <th className="px-3 py-2">{t('cpn.sharedCode')}</th>
                  <th className="px-3 py-2">{t('cpn.client')}</th>
                  <th className="px-3 py-2">{t('cpn.offer')}</th>
                  <th className="px-3 py-2">{t('cpn.expiresOn')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {codes.slice(0, 200).map((c) => {
                  const expired = c.status === 'active' && c.expires_at && new Date(c.expires_at) < new Date();
                  const status = expired ? 'expired' : c.status;
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 font-mono">
                        <button type="button" onClick={() => copy(c.code)} className="hover:underline">
                          {c.code}
                        </button>
                      </td>
                      <td className="px-3 py-2">{clientName(c.client_id)}</td>
                      <td className="px-3 py-2">{offerById(c.offer_id)?.name ?? '—'}</td>
                      <td className="px-3 py-2">{c.expires_at ? format(new Date(c.expires_at), 'dd/MM/yyyy') : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={status === 'redeemed' ? 'default' : status === 'active' ? 'secondary' : 'outline'}>{t(`cpn.status.${status}`)}</Badge>
                        {canManage && c.status === 'active' && (
                          <Button variant="ghost" size="sm" className="ml-2 h-7" onClick={() => void voidCode(c.id)}>
                            {t('cpn.void')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <OfferDialog
          businessId={businessId}
          offer={editing}
          services={services}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {issuing && (
        <IssueDialog
          businessId={businessId}
          offers={offers.filter((o) => o.active && o.code_mode === 'unique')}
          clients={clients}
          label={label}
          onClose={() => setIssuing(false)}
          onIssued={refresh}
        />
      )}
    </div>
  );
}

function OfferDialog({
  businessId,
  offer,
  services,
  products,
  onClose,
  onSaved,
}: {
  businessId: string;
  offer: Partial<CouponOffer>;
  services: Option[];
  products: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [o, setO] = useState<Partial<CouponOffer>>(offer);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<CouponOffer>) => setO((x) => ({ ...x, ...p }));
  const valid =
    !!o.name?.trim() &&
    (o.kind === 'percent' ? Number(o.value) > 0 && Number(o.value) <= 100 : o.kind === 'amount' ? Number(o.value) > 0 : o.kind === 'free_service' ? !!o.service_id : !!o.product_id) &&
    (o.code_mode === 'unique' || /^[A-Z0-9-]{3,20}$/.test(o.shared_code ?? ''));

  const save = async () => {
    setSaving(true);
    const row = {
      business_id: businessId,
      name: o.name!.trim(),
      kind: o.kind,
      value: o.kind === 'percent' || o.kind === 'amount' ? Number(o.value) : null,
      service_id: o.kind === 'free_service' ? o.service_id : null,
      product_id: o.kind === 'free_product' ? o.product_id : null,
      code_mode: o.code_mode,
      shared_code: o.code_mode === 'shared' ? o.shared_code : null,
      valid_days: o.code_mode === 'unique' ? Number(o.valid_days) || 30 : null,
      starts_on: o.starts_on || null,
      expires_on: o.expires_on || null,
      max_uses: o.code_mode === 'shared' && o.max_uses ? Number(o.max_uses) : null,
      one_per_client: !!o.one_per_client,
      online_booking: !!o.online_booking,
      active: o.active !== false,
    };
    const res = o.id ? await couponOffersTable().update(row).eq('id', o.id) : await couponOffersTable().insert({ ...row, created_by: user?.id ?? null });
    setSaving(false);
    if (res.error) {
      devConsole.error('[coupons] save offer', res.error);
      toast.error(res.error.code === '23505' ? t('cpn.codeTaken') : t('common.genericError'));
      return;
    }
    toast.success(t('cpn.saved'));
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{o.id ? t('cpn.edit') : t('cpn.new')}</DialogTitle>
          <DialogDescription className="sr-only">{t('cpn.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('cpn.name')}</Label>
            <Input value={o.name ?? ''} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Cumpleaños 10%" />
          </div>
          <div className="space-y-2">
            <Label>{t('cpn.kind')}</Label>
            <RadioGroup value={o.kind} onValueChange={(v) => set({ kind: v as CouponKind })} className="grid grid-cols-2 gap-2">
              {(['percent', 'amount', 'free_service', 'free_product'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <RadioGroupItem value={k} />
                  {t(`cpn.kind.${k}`)}
                </label>
              ))}
            </RadioGroup>
          </div>
          {(o.kind === 'percent' || o.kind === 'amount') && (
            <div className="space-y-1.5">
              <Label>{o.kind === 'percent' ? '%' : '$'}</Label>
              <Input type="number" min={1} max={o.kind === 'percent' ? 100 : 10000} className="w-32" value={String(o.value ?? '')} onChange={(e) => set({ value: Number(e.target.value) })} />
            </div>
          )}
          {o.kind === 'free_service' && (
            <div className="space-y-1.5">
              <Label>{t('cpn.service')}</Label>
              <Select value={o.service_id ?? ''} onValueChange={(v) => set({ service_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('auto.cond.pick')} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {o.kind === 'free_product' && (
            <div className="space-y-1.5">
              <Label>{t('cpn.product')}</Label>
              <Select value={o.product_id ?? ''} onValueChange={(v) => set({ product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('auto.cond.pick')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('cpn.codeMode')}</Label>
            <RadioGroup value={o.code_mode} onValueChange={(v) => set({ code_mode: v as 'unique' | 'shared' })} className="space-y-2">
              {(['unique', 'shared'] as const).map((m) => (
                <label key={m} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                  <RadioGroupItem value={m} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{t(`cpn.mode.${m}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`cpn.mode.${m}Help`)}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
          {o.code_mode === 'shared' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{t('cpn.sharedCode')}</Label>
                <Input className="font-mono uppercase" maxLength={20} value={o.shared_code ?? ''} onChange={(e) => set({ shared_code: normalizeCouponCode(e.target.value).replace(/[^A-Z0-9-]/g, '') })} placeholder="CUMPLE10" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('cpn.startsOn')}</Label>
                <Input type="date" value={o.starts_on ?? ''} onChange={(e) => set({ starts_on: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('cpn.expiresOn')}</Label>
                <Input type="date" value={o.expires_on ?? ''} onChange={(e) => set({ expires_on: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('cpn.maxUses')}</Label>
                <Input type="number" min={1} value={String(o.max_uses ?? '')} onChange={(e) => set({ max_uses: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t('cpn.validDays')}</Label>
              <Input type="number" min={1} max={365} className="w-32" value={String(o.valid_days ?? 30)} onChange={(e) => set({ valid_days: Number(e.target.value) })} />
            </div>
          )}
          <div className="space-y-2">
            {o.code_mode === 'shared' && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!o.one_per_client} onCheckedChange={(v) => set({ one_per_client: v })} />
                {t('cpn.onePerClient')}
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!o.online_booking} onCheckedChange={(v) => set({ online_booking: v })} />
              {t('cpn.onlineBooking')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={o.active !== false} onCheckedChange={(v) => set({ active: v })} />
              {t('cpn.active')}
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('auto.cancel')}
          </Button>
          <Button disabled={!valid || saving} onClick={() => void save()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('auto.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({
  businessId,
  offers,
  clients,
  label,
  onClose,
  onIssued,
}: {
  businessId: string;
  offers: CouponOffer[];
  clients: ClientOption[];
  label: (o: CouponOffer) => string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const { user } = useAuth();
  const [offerId, setOfferId] = useState(offers[0]?.id ?? '');
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const matches = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  const issue = async () => {
    const offer = offers.find((o) => o.id === offerId);
    const client = clients.find((c) => c.id === clientId);
    if (!offer || !client) return;
    setSaving(true);
    for (let i = 0; i < 5; i++) {
      const next = makeCouponCode(client.name.split(' ')[0]);
      const { error } = await couponsTable().insert({
        business_id: businessId,
        offer_id: offer.id,
        client_id: client.id,
        code: next,
        expires_at: new Date(Date.now() + (offer.valid_days ?? 30) * 86_400_000).toISOString(),
        created_by: user?.id ?? null,
      });
      if (!error) {
        setCode(next);
        toast.success(t('cpn.issued', { code: next }));
        onIssued();
        break;
      }
      if (error.code !== '23505') {
        devConsole.error('[coupons] issue', error);
        toast.error(t('common.genericError'));
        break;
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('cpn.issueTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('cpn.issue')}</DialogDescription>
        </DialogHeader>
        {code ? (
          <div className="space-y-3 text-center">
            <p className="font-mono text-2xl font-bold">{code}</p>
            <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success(t('cpn.copied')))}>
              <Copy className="mr-2 h-4 w-4" />
              {t('cpn.copy')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('cpn.offer')}</Label>
              <Select value={offerId} onValueChange={setOfferId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} · {label(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('cpn.client')}</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ana…" />
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClientId(c.id);
                        setSearch(c.name);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-muted ${clientId === c.id ? 'bg-muted font-medium' : ''}`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {code ? 'OK' : t('auto.cancel')}
          </Button>
          {!code && (
            <Button disabled={!offerId || !clientId || saving} onClick={() => void issue()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('cpn.issue')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
