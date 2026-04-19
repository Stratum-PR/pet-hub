/**
 * CRM-style client profile (overview, profile form, pets, transactions, appointments).
 *
 * Phase 2 (not implemented — requires schema/product decisions): arbitrary client tags,
 * client profile photos, marketing channel / device analytics, verified badges, ratings.
 * See plan: client profile card design.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BusinessClient } from '@/hooks/useBusinessData';
import { ClientForm } from '@/components/ClientForm';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { resolveDemoLocalTransactionEntries } from '@/hooks/useTransactions';
import { devConsole } from '@/lib/clientDebug';
import { Calendar, Dog, Mail, Phone, Plus, X } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DetailModalActionBar } from '@/components/DetailModalActionBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  profileDialogShellClassName,
  profileTabPanelClassName,
  profileTabsBodyShellClassName,
} from '@/lib/profileDialogLayout';
import { t } from '@/lib/translations';
import { formatPhoneNumberDisplay } from '@/lib/phoneFormat';
import type { Appointment, Client, Pet } from '@/types';
import type { Transaction, TransactionLineItem } from '@/types/transactions';

type ClientRow = Client & {
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

const PURCHASE_DONUT_COLORS = [
  'hsl(var(--primary))',
  'hsl(280 65% 55%)',
  'hsl(42 90% 48%)',
  'hsl(150 45% 42%)',
  'hsl(200 60% 48%)',
  'hsl(330 55% 52%)',
];

type PurchaseDonutSlice = {
  name: string;
  value: number;
  pct: number;
  cents: number;
  color: string;
};

function ClientPurchaseDonut({ title, data }: { title: string; data: PurchaseDonutSlice[] }) {
  if (data.length === 0) {
    return (
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">—</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="48%"
              innerRadius={34}
              outerRadius={54}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={`${entry.name}-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as PurchaseDonutSlice;
                return (
                  <div className="rounded-md border border-border bg-card px-2 py-1.5 text-xs shadow-sm max-w-[14rem]">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      — ×{row.value} ({row.pct}%) · ${(row.cents / 100).toFixed(2)}
                    </span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {data.map((entry) => (
          <span key={entry.name} className="flex max-w-[10rem] items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="truncate">{entry.name}</span>
            <span className="shrink-0 tabular-nums">{entry.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function rowsToDonutData(rows: { name: string; qty: number; cents: number }[]): PurchaseDonutSlice[] {
  const total = rows.reduce((s, r) => s + r.qty, 0);
  if (total <= 0) return [];
  return rows.map((r, i) => ({
    name: r.name,
    value: r.qty,
    cents: r.cents,
    pct: Math.round((r.qty / total) * 100),
    color: PURCHASE_DONUT_COLORS[i % PURCHASE_DONUT_COLORS.length],
  }));
}

export type ClientProfileSavePayload = Omit<
  BusinessClient,
  'id' | 'created_at' | 'updated_at' | 'business_id'
> & { staff_notes_business?: string | null };

function mapLineItemRow(row: any): TransactionLineItem {
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

function normalizeAppointmentStatus(status: string | undefined): string {
  return (status ?? '').toLowerCase().replace(/-/g, '_');
}

function appointmentDate(apt: Appointment): Date {
  const raw =
    apt.scheduled_date ||
    (apt.appointment_date ? `${apt.appointment_date}T00:00:00` : apt.created_at);
  return new Date(raw);
}

function belongsToClient(apt: Appointment, clientId: string, petIds: Set<string>): boolean {
  if (apt.client_id && apt.client_id === clientId) return true;
  if (apt.pet_id && petIds.has(apt.pet_id)) return true;
  return false;
}

function isUpcomingBooked(apt: Appointment, from: Date = new Date()): boolean {
  const s = normalizeAppointmentStatus(apt.status);
  if (['cancelled', 'canceled', 'completed', 'no_show'].includes(s)) return false;
  const booked =
    s === 'scheduled' || s === 'confirmed' || s === 'in_progress' || s === 'inprogress';
  if (!booked) return false;
  return appointmentDate(apt) >= startOfDay(from);
}

function isCompleted(apt: Appointment): boolean {
  return normalizeAppointmentStatus(apt.status) === 'completed';
}

function isNoShow(apt: Appointment): boolean {
  const s = normalizeAppointmentStatus(apt.status);
  return s === 'no_show';
}

function initials(first?: string, last?: string): string {
  const a = (first?.[0] ?? '').toUpperCase();
  const b = (last?.[0] ?? '').toUpperCase();
  return (a + b) || '?';
}

export interface ClientProfileDialogProps {
  open: boolean;
  client: ClientRow | null;
  pets: Pet[];
  appointments: Appointment[];
  transactions: Transaction[];
  onOpenChange: (open: boolean) => void;
  onSaveClientProfile: (data: ClientProfileSavePayload) => Promise<ClientRow | null>;
  onDelete: () => void;
  onAddPet: () => void;
  onOpenPet: (pet: Pet, clientId: string) => void;
  onOpenTransaction: (txn: Transaction) => void;
}

export function ClientProfileDialog({
  open,
  client,
  pets,
  appointments,
  transactions,
  onOpenChange,
  onSaveClientProfile,
  onDelete,
  onAddPet,
  onOpenPet,
  onOpenTransaction,
}: ClientProfileDialogProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const businessId = useBusinessId();
  const { user } = useAuth();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [txnLineItemsById, setTxnLineItemsById] = useState<Record<string, TransactionLineItem[]>>({});
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setDismissedAlerts(new Set());
    setActiveTab('overview');
  }, [client?.id]);

  const clientPets = useMemo(
    () => (client ? pets.filter((p) => p.client_id === client.id) : []),
    [pets, client],
  );

  const petIds = useMemo(() => new Set(clientPets.map((p) => p.id)), [clientPets]);

  const clientTxns = useMemo(() => {
    if (!client) return [];
    return (transactions ?? [])
      .filter((txn) => txn.customer_id === client.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions, client]);

  useEffect(() => {
    if (!open || !client) {
      setTxnLineItemsById({});
      return;
    }
    const ids = clientTxns.map((t) => t.id);
    if (ids.length === 0) {
      setTxnLineItemsById({});
      return;
    }
    let cancelled = false;
    const merged: Record<string, TransactionLineItem[]> = {};
    if (businessId) {
      for (const entry of resolveDemoLocalTransactionEntries(businessId, user?.id)) {
        if (ids.includes(entry.transaction.id) && entry.lineItems?.length) {
          merged[entry.transaction.id] = entry.lineItems;
        }
      }
    }
    const serverIds = ids.filter((id) => !id.startsWith('local-'));
    if (serverIds.length === 0) {
      setTxnLineItemsById(merged);
      return;
    }
    setTxnLineItemsById(merged);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('transaction_line_items' as any)
          .select('*')
          .in('transaction_id', serverIds);
        if (cancelled) return;
        if (error) {
          if (import.meta.env.DEV) {
            devConsole.warn('[ClientProfileDialog] Failed to load transaction line items');
          }
          return;
        }
        const out = { ...merged };
        if (data) {
          for (const row of data as any[]) {
            const item = mapLineItemRow(row);
            const tid = item.transaction_id;
            if (!out[tid]) out[tid] = [];
            out[tid].push(item);
          }
        }
        setTxnLineItemsById(out);
      } catch {
        /* keep optimistic merged state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, client?.id, clientTxns, businessId, user?.id]);

  const clientAppts = useMemo(() => {
    if (!client) return [];
    return appointments.filter((a) => belongsToClient(a, client.id, petIds));
  }, [appointments, client, petIds]);

  const spendKpis = useMemo(() => {
    const count = clientTxns.length;
    const totalCents = clientTxns.reduce((sum, x) => sum + (Number(x.total) || 0), 0);
    const avgCents = count > 0 ? Math.round(totalCents / count) : 0;
    return { count, totalCents, avgCents };
  }, [clientTxns]);

  const visitKpis = useMemo(() => {
    const total = clientAppts.length;
    const completed = clientAppts.filter(isCompleted).length;
    const noShow = clientAppts.filter(isNoShow).length;
    const upcoming = clientAppts
      .filter((a) => isUpcomingBooked(a))
      .sort((a, b) => appointmentDate(a).getTime() - appointmentDate(b).getTime())[0];
    return { total, completed, noShow, next: upcoming ?? null };
  }, [clientAppts]);

  const petById = useMemo(() => {
    const m = new Map<string, Pet>();
    clientPets.forEach((p) => m.set(p.id, p));
    return m;
  }, [clientPets]);

  const alerts = useMemo(() => {
    if (!client) return [];
    const now = new Date();
    const month = now.getMonth() + 1;
    type AlertItem = { id: string; kind: 'apt' | 'vac' | 'bday'; message: string; action?: string; onAction?: () => void };
    const out: AlertItem[] = [];

    const upcomingSorted = clientAppts
      .filter((a) => isUpcomingBooked(a))
      .sort((a, b) => appointmentDate(a).getTime() - appointmentDate(b).getTime());
    const nextApt = upcomingSorted[0];
    if (nextApt) {
      const pet = nextApt.pet_id ? petById.get(nextApt.pet_id) : undefined;
      const petName = pet?.name ?? t('clients.profile.alertPetUnknown');
      const when = format(appointmentDate(nextApt), 'EEE MMM d');
      out.push({
        id: `apt-${nextApt.id}`,
        kind: 'apt',
        message: t('clients.profile.alertNextAppt', { when, pet: petName, service: nextApt.service_type }),
        action: t('clients.profile.alertBook'),
        onAction: () => {
          const path = businessSlug ? `/${businessSlug}/appointments` : '/appointments';
          navigate(path);
          onOpenChange(false);
        },
      });
    }

    for (const p of clientPets) {
      if (p.vaccination_status === 'out_of_date') {
        out.push({
          id: `vac-${p.id}`,
          kind: 'vac',
          message: t('clients.profile.alertVac', { pet: p.name }),
          action: t('clients.profile.alertViewPet'),
          onAction: () => onOpenPet(p, client.id),
        });
      }
    }

    for (const p of clientPets) {
      if (p.birth_month != null && p.birth_month === month) {
        out.push({
          id: `bday-${p.id}`,
          kind: 'bday',
          message: t('clients.profile.alertBirthday', { pet: p.name }),
          action: t('clients.profile.alertViewPet'),
          onAction: () => onOpenPet(p, client.id),
        });
      }
    }

    return out.slice(0, 4);
  }, [client, clientAppts, clientPets, petById, businessSlug, navigate, onOpenChange, onOpenPet]);

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

  const dismissAlert = useCallback((id: string) => {
    setDismissedAlerts((prev) => new Set([...prev, id]));
  }, []);

  const { serviceDonutData, productDonutData } = useMemo(() => {
    const add = (map: Map<string, { qty: number; cents: number }>, name: string, qty: number, cents: number) => {
      const key = name.trim() || '—';
      const cur = map.get(key) ?? { qty: 0, cents: 0 };
      cur.qty += qty;
      cur.cents += cents;
      map.set(key, cur);
    };
    const services = new Map<string, { qty: number; cents: number }>();
    const products = new Map<string, { qty: number; cents: number }>();
    for (const txn of clientTxns) {
      const lines = txnLineItemsById[txn.id];
      if (!lines?.length) continue;
      for (const li of lines) {
        const qty = Number(li.quantity) || 0;
        const cents = Number(li.line_total) || 0;
        if (li.type === 'service') add(services, li.name, qty, cents);
        else add(products, li.name, qty, cents);
      }
    }
    const sortSlice = (map: Map<string, { qty: number; cents: number }>) =>
      [...map.entries()]
        .map(([name, v]) => ({ name, qty: v.qty, cents: v.cents }))
        .sort((a, b) => b.qty - a.qty || b.cents - a.cents)
        .slice(0, 6);
    const topServices = sortSlice(services);
    const topProducts = sortSlice(products);
    return {
      serviceDonutData: rowsToDonutData(topServices),
      productDonutData: rowsToDonutData(topProducts),
    };
  }, [clientTxns, txnLineItemsById]);

  const derivedBadges = useMemo(() => {
    if (!client) return [];
    const badges: string[] = [];
    if (clientPets.length >= 2) badges.push(t('clients.profile.badgeMultiPet'));
    const created = new Date(client.created_at);
    if (!Number.isNaN(created.getTime())) {
      const now = new Date();
      if (created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) {
        badges.push(t('clients.profile.badgeNewThisMonth'));
      }
    }
    return badges;
  }, [client, clientPets.length]);

  if (!client) return null;

  const createdAt = new Date(client.created_at);
  const clientSince = Number.isNaN(createdAt.getTime()) ? '—' : format(createdAt, 'MMM d, yyyy');
  const updatedAt = new Date(client.updated_at);
  const clientUpdated = Number.isNaN(updatedAt.getTime()) ? '—' : format(updatedAt, 'MMM d, yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={profileDialogShellClassName}>
        <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <DetailModalActionBar
            editLabel={t('common.edit')}
            deleteLabel={t('common.delete')}
            onEdit={() => setActiveTab('profile')}
            onDelete={onDelete}
          />
          <DialogHeader className="text-left space-y-0.5 pb-2 pr-10">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {client.first_name} {client.last_name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{t('clients.profile.modalSubtitle')}</p>
          </DialogHeader>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          key={client.id}
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <TabsList className="mb-3 h-auto w-full shrink-0 flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              {t('clients.profile.tabOverview')}
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm">
              {t('clients.profile.tabProfile')}
            </TabsTrigger>
            <TabsTrigger value="pets" className="text-xs sm:text-sm">
              {t('clients.profile.tabPets')}
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">
              {t('clients.profile.tabTransactions')}
            </TabsTrigger>
            <TabsTrigger value="appointments" className="text-xs sm:text-sm">
              {t('clients.profile.tabAppointments')}
            </TabsTrigger>
          </TabsList>

          <div className={profileTabsBodyShellClassName}>
          <TabsContent value="overview" className={profileTabPanelClassName}>
            <div className="space-y-4 min-w-0">
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0 border border-border/50">
                    <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                      {initials(client.first_name, client.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-semibold text-foreground">
                      {[client.first_name, client.last_name].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('clients.profile.clientSince', { date: clientSince })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('clients.profile.recordUpdated')}: {clientUpdated}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 text-sm text-muted-foreground sm:items-end sm:text-right">
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Phone className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="break-all tabular-nums">{formatPhoneNumberDisplay(client.phone)}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Mail className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="break-all">{client.email || '—'}</span>
                  </div>
                </div>
              </div>

                {visibleAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {visibleAlerts.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
                      >
                        <span className="flex-1 min-w-[12rem] text-foreground">{a.message}</span>
                        {a.action && a.onAction ? (
                          <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={a.onAction}>
                            {a.action}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          aria-label={t('clients.profile.dismissAlert')}
                          onClick={() => dismissAlert(a.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('clients.profile.kpiLifetime')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1">
                      <p className="text-2xl font-semibold tabular-nums">
                        ${(spendKpis.totalCents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('clients.profile.kpiCheckoutCount', { n: spendKpis.count })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('clients.profile.kpiAvgTicket', {
                          amount: `$${(spendKpis.avgCents / 100).toFixed(2)}`,
                        })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-border/60">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('clients.profile.kpiVisits')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1">
                      <p className="text-2xl font-semibold tabular-nums">{visitKpis.total}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('clients.profile.kpiVisitBreakdown', {
                          done: visitKpis.completed,
                          noShow: visitKpis.noShow,
                        })}
                      </p>
                      {visitKpis.next ? (
                        <p className="text-xs font-medium text-foreground pt-1">
                          {t('clients.profile.kpiNextVisit', {
                            when: format(appointmentDate(visitKpis.next), 'MMM d, yyyy'),
                          })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-1">{t('clients.profile.kpiNoUpcoming')}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{t('clients.profile.recentCheckouts')}</h3>
                  </div>
                  {clientTxns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('clients.profile.noTransactions')}</p>
                  ) : (
                    <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-card/50">
                      {clientTxns.slice(0, 6).map((txn) => {
                        const totalDollars = (Number(txn.total) / 100).toFixed(2);
                        const displayId =
                          txn.transaction_number != null
                            ? `TXN-${String(txn.transaction_number).padStart(5, '0')}`
                            : txn.id.slice(0, 8);
                        return (
                          <li key={txn.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                              onClick={() => onOpenTransaction(txn)}
                            >
                              <span className="font-mono text-xs">{displayId}</span>
                              <span className="text-muted-foreground text-xs">
                                {format(new Date(txn.created_at), 'MMM d, yyyy')}
                              </span>
                              <span className="font-medium tabular-nums">${totalDollars}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{t('clients.profile.petsAtAGlance')}</h3>
                    {clientPets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('clients.profile.noPets')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {clientPets.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-2 text-left hover:bg-muted/40"
                              onClick={() => onOpenPet(p, client.id)}
                            >
                              <Avatar className="h-10 w-10 shrink-0">
                                {p.photo_url ? <AvatarImage src={p.photo_url} alt="" /> : null}
                                <AvatarFallback className="text-xs">
                                  <Dog className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {(() => {
                                    if (!p.last_grooming_date) return t('clients.profile.noGroomDate');
                                    const d = new Date(p.last_grooming_date);
                                    return Number.isNaN(d.getTime())
                                      ? t('clients.profile.noGroomDate')
                                      : t('clients.profile.lastGroom', {
                                          date: format(d, 'MMM d, yyyy'),
                                        });
                                  })()}
                                  {' · '}
                                  {p.vaccination_status === 'out_of_date'
                                    ? t('clients.profile.vacReview')
                                    : p.vaccination_status === 'up_to_date'
                                      ? t('clients.profile.vacOk')
                                      : t('clients.profile.vacUnknown')}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card/30 p-3">
                    <h3 className="text-sm font-semibold mb-3">{t('clients.profile.purchaseInsightsTitle')}</h3>
                    {clientTxns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('clients.profile.purchaseInsightsNeedTxns')}</p>
                    ) : serviceDonutData.length === 0 && productDonutData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('clients.profile.purchaseInsightsNoLines')}</p>
                    ) : (
                      <div className="grid min-h-0 gap-6 sm:grid-cols-2">
                        <ClientPurchaseDonut
                          title={t('clients.profile.topServicesHeading')}
                          data={serviceDonutData}
                        />
                        <ClientPurchaseDonut
                          title={t('clients.profile.topProductsHeading')}
                          data={productDonutData}
                        />
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="profile" className={profileTabPanelClassName}>
            <div className="space-y-4">
              <ClientForm
                embedded
                profileView
                fieldIdPrefix="client-profile-"
                initialData={client as unknown as BusinessClient}
                isEditing
                onSubmit={(data) => {
                  void onSaveClientProfile(data);
                }}
              />

              <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={onAddPet}>
                <Plus className="h-4 w-4" />
                {t('clients.addPetForClient')}
              </Button>

              {derivedBadges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {derivedBadges.map((b) => (
                    <Badge key={b} variant="secondary" className="font-normal">
                      {b}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <p className="text-[11px] leading-snug text-muted-foreground border-t border-border/40 pt-3">
                {t('clients.profile.phase2Hint')}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="pets" className={profileTabPanelClassName}>
            {clientPets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('clients.profile.noPets')}</p>
            ) : (
              <ul className="space-y-3">
                {clientPets.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-border/60 bg-muted/10 p-4 flex flex-wrap gap-4 justify-between"
                  >
                    <div className="flex gap-3 min-w-0">
                      <Avatar className="h-12 w-12 shrink-0">
                        {p.photo_url ? <AvatarImage src={p.photo_url} alt="" /> : null}
                        <AvatarFallback>
                          <Dog className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.species
                            ? `${p.species.charAt(0).toUpperCase()}${p.species.slice(1)}`
                            : ''}{' '}
                          {p.breed || p.breeds?.name ? `· ${p.breeds?.name ?? p.breed}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.weight != null ? t('clients.profile.petWeight', { w: p.weight }) : null}
                        </p>
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenPet(p, client.id)}>
                      {t('clients.profile.openPet')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="transactions" className={profileTabPanelClassName}>
            {clientTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('clients.profile.noTransactions')}</p>
            ) : (
              <ul className="space-y-2">
                {clientTxns.map((txn) => {
                  const totalDollars = (Number(txn.total) / 100).toFixed(2);
                  const displayId =
                    txn.transaction_number != null
                      ? `TXN-${String(txn.transaction_number).padStart(5, '0')}`
                      : txn.id.slice(0, 8);
                  const lines = txnLineItemsById[txn.id] ?? [];
                  return (
                    <li key={txn.id} className="overflow-hidden rounded-lg border border-border/50">
                      <button
                        type="button"
                        className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        onClick={() => onOpenTransaction(txn)}
                      >
                        <span className="font-mono text-xs">{displayId}</span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          {format(new Date(txn.created_at), 'MMM d, yyyy')}
                        </span>
                        <span className="font-medium tabular-nums shrink-0">${totalDollars}</span>
                      </button>
                      {lines.length > 0 ? (
                        <ul className="space-y-1 border-t border-border/40 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                          {lines.map((li) => (
                            <li key={li.id} className="flex justify-between gap-2">
                              <span className="min-w-0 truncate">
                                {t('clients.profile.txnLineSummary', {
                                  name: li.name,
                                  qty: li.quantity,
                                  amount: `$${(Number(li.line_total) / 100).toFixed(2)}`,
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="appointments" className={profileTabPanelClassName}>
            {clientAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('clients.profile.noAppointments')}</p>
            ) : (
              <ul className="space-y-2">
                {[...clientAppts]
                  .sort((a, b) => appointmentDate(b).getTime() - appointmentDate(a).getTime())
                  .map((apt) => {
                    const pet = apt.pet_id ? petById.get(apt.pet_id) : undefined;
                    const st = normalizeAppointmentStatus(apt.status);
                    return (
                      <li
                        key={apt.id}
                        className="rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>{format(appointmentDate(apt), 'MMM d, yyyy')}</span>
                          <Badge variant="outline" className="font-normal text-xs capitalize">
                            {st.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-full sm:max-w-[50%]">
                          {pet?.name ? `${pet.name} · ` : ''}
                          {apt.service_type}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
