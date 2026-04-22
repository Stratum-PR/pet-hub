import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { Calendar, Cat, Dog, Scale, Syringe, Cake, X, ExternalLink, FileText, User, Mail, Phone } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DetailModalActionBar } from '@/components/DetailModalActionBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { t } from '@/lib/translations';
import { formatPhoneNumberDisplay } from '@/lib/phoneFormat';
import { calculateVaccinationStatus } from '@/lib/petHelpers';
import {
  profileDialogShellClassName,
  profileDialogTabsChromeClassName,
  profileDialogTabsListClassName,
  profileDialogTabsTriggerClassName,
  profileTabPanelClassName,
  profileTabsBodyShellClassName,
} from '@/lib/profileDialogLayout';
import { ProfileDialogPrimaryHero } from '@/components/ProfileDialogPrimaryHero';
import type { Client, Pet } from '@/types';
import type { Transaction } from '@/types/transactions';

type AppointmentLike = {
  id: string;
  pet_id?: string | null;
  client_id?: string | null;
  appointment_date?: string | null;
  scheduled_date?: string | null;
  status?: string | null;
  service_type?: string | null;
  price?: number | null;
  notes?: string | null;
  transaction_id?: string | null;
};

interface PetProfileDialogProps {
  open: boolean;
  pet: Pet | null;
  clients: Client[];
  appointments: AppointmentLike[];
  transactions: Transaction[];
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewOwner: (clientId: string) => void;
}

function normalizeDate(input?: string | null): Date | null {
  if (!input) return null;
  const value = input.includes('T') ? input : `${input}T00:00:00`;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function normalizeStatus(status?: string | null): string {
  return (status ?? '').toLowerCase().replace(/-/g, '_');
}

function formatMoney(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

function bookedDollarsFromAppointment(apt: AppointmentLike): number {
  const n = Number(apt.price);
  return Number.isFinite(n) ? n : 0;
}

function transactionChargedDollars(txn: Transaction | null | undefined): number | null {
  if (!txn) return null;
  if (txn.status === 'paid' || txn.status === 'partial') {
    return Number(txn.total) / 100;
  }
  return null;
}

function resolveTxnForAppointment(
  apt: AppointmentLike,
  txnById: Map<string, Transaction>,
  txnByAppointmentId: Map<string, Transaction>,
): Transaction | null {
  if (apt.transaction_id) {
    const direct = txnById.get(apt.transaction_id);
    if (direct) return direct;
  }
  return txnByAppointmentId.get(apt.id) ?? null;
}

function vaccinationStatusLabel(status: string | undefined | null): string {
  const s = normalizeStatus(status);
  if (s === 'up_to_date') return t('pets.profile.vaccStatusUpToDate');
  if (s === 'out_of_date') return t('pets.profile.vaccStatusOutOfDate');
  return t('pets.profile.vaccStatusUnknown');
}

export function PetProfileDialog({
  open,
  pet,
  clients,
  appointments,
  transactions,
  onOpenChange,
  onEdit,
  onDelete,
  onViewOwner,
}: PetProfileDialogProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [petProfileTab, setPetProfileTab] = useState<'overview' | 'appointments'>('overview');
  const today = startOfDay(new Date());

  useEffect(() => {
    setDismissedAlerts(new Set());
    setPetProfileTab('overview');
  }, [pet?.id]);

  const owner = useMemo(
    () => (pet?.client_id ? clients.find((c) => c.id === pet.client_id) ?? null : null),
    [clients, pet?.client_id],
  );

  const { txnById, txnByAppointmentId } = useMemo(() => {
    const byId = new Map<string, Transaction>();
    const byAppt = new Map<string, Transaction>();
    for (const txn of transactions ?? []) {
      byId.set(txn.id, txn);
      if (txn.appointment_id) {
        byAppt.set(txn.appointment_id, txn);
      }
    }
    return { txnById: byId, txnByAppointmentId: byAppt };
  }, [transactions]);

  const petAppointments = useMemo(() => {
    if (!pet) return [];
    return appointments
      .filter((a) => String(a.pet_id ?? '').trim() === String(pet.id).trim())
      .map((a) => {
        const date = normalizeDate(a.appointment_date || a.scheduled_date);
        const txn = resolveTxnForAppointment(a, txnById, txnByAppointmentId);
        const booked = bookedDollarsFromAppointment(a);
        const charged = transactionChargedDollars(txn);
        return { ...a, date, txn, bookedDollars: booked, chargedDollars: charged };
      })
      .filter((a) => a.date)
      .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());
  }, [appointments, pet, txnByAppointmentId, txnById]);

  const revenueTotals = useMemo(() => {
    let booked = 0;
    let charged = 0;
    for (const a of petAppointments) {
      booked += a.bookedDollars;
      if (a.chargedDollars != null) charged += a.chargedDollars;
    }
    return { booked, charged };
  }, [petAppointments]);

  const revenueByMonth = useMemo(() => {
    const map = new Map<string, { monthKey: string; label: string; booked: number; charged: number }>();
    for (const a of petAppointments) {
      const d = a.date as Date;
      const monthKey = format(d, 'yyyy-MM');
      const label = format(d, 'MMMM yyyy');
      const row = map.get(monthKey) ?? { monthKey, label, booked: 0, charged: 0 };
      row.booked += a.bookedDollars;
      if (a.chargedDollars != null) row.charged += a.chargedDollars;
      map.set(monthKey, row);
    }
    return [...map.values()].sort((x, y) => y.monthKey.localeCompare(x.monthKey));
  }, [petAppointments]);

  const nextAppointment = useMemo(
    () =>
      petAppointments
        .filter((a) => {
          const s = normalizeStatus(a.status);
          if (['cancelled', 'canceled', 'completed', 'no_show'].includes(s)) return false;
          return (a.date as Date) >= today;
        })
        .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime())[0] ?? null,
    [petAppointments, today],
  );

  const visitKpis = useMemo(() => {
    const total = petAppointments.length;
    const completed = petAppointments.filter((a) => normalizeStatus(a.status) === 'completed').length;
    const noShow = petAppointments.filter((a) => normalizeStatus(a.status) === 'no_show').length;
    return { total, completed, noShow };
  }, [petAppointments]);

  const derivedVaccination = useMemo(() => {
    if (!pet) return null;
    if (pet.vaccination_status && pet.vaccination_status !== 'unknown') {
      return pet.vaccination_status;
    }
    return calculateVaccinationStatus(pet.last_vaccination_date ?? null);
  }, [pet]);

  const lastVaccinationDisplay = useMemo(() => {
    if (!pet?.last_vaccination_date) return null;
    const d = parseISO(pet.last_vaccination_date.includes('T') ? pet.last_vaccination_date : `${pet.last_vaccination_date}T00:00:00`);
    return isValid(d) ? format(d, 'MMM d, yyyy') : pet.last_vaccination_date;
  }, [pet?.last_vaccination_date]);

  const alertItems = useMemo(() => {
    if (!pet) return [];
    const items: Array<{ id: string; message: string; action?: string; onAction?: () => void }> = [];
    if (nextAppointment) {
      items.push({
        id: `next-${nextAppointment.id}`,
        message: t('pets.profile.alertNextAppt', {
          when: format(nextAppointment.date as Date, 'EEE MMM d'),
          service: nextAppointment.service_type || t('pets.profile.serviceFallback'),
        }),
        action: t('pets.profile.openCalendar'),
        onAction: () => {
          const path = businessSlug ? `/${businessSlug}/appointments` : '/appointments';
          navigate(path);
          onOpenChange(false);
        },
      });
    }
    if (pet.vaccination_status === 'out_of_date' || derivedVaccination === 'out_of_date') {
      items.push({
        id: `vac-${pet.id}`,
        message: t('pets.profile.alertVacReview', { name: pet.name }),
      });
    }
    if (pet.birth_month && pet.birth_month === new Date().getMonth() + 1) {
      items.push({
        id: `birth-${pet.id}`,
        message: t('pets.profile.alertBirthday', { name: pet.name }),
      });
    }
    return items;
  }, [pet, nextAppointment, derivedVaccination, businessSlug, navigate, onOpenChange]);

  const visibleAlerts = alertItems.filter((x) => !dismissedAlerts.has(x.id));

  if (!pet) return null;

  const notesBlock = [pet.notes, pet.special_instructions].filter(Boolean).join('\n\n');

  const speciesLabel = (pet.species || '').toLowerCase();
  const breedLine = pet.breeds?.name ?? pet.breed ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={profileDialogShellClassName}>
        <ProfileDialogPrimaryHero
          avatar={
            <Avatar className="h-14 w-14 shrink-0 border-2 border-primary-foreground/25">
              {pet.photo_url ? <AvatarImage src={pet.photo_url} alt={pet.name} /> : null}
              <AvatarFallback className="bg-primary-foreground/15 text-primary-foreground">
                {pet.species === 'cat' ? <Cat className="h-7 w-7" /> : <Dog className="h-7 w-7" />}
              </AvatarFallback>
            </Avatar>
          }
          title={pet.name}
          subtitle={
            <span className="capitalize">
              {(pet.species ? speciesLabel : null) || t('pets.species')} · {breedLine}
            </span>
          }
          kpis={[
            { label: t('pets.profile.heroKpiVisitsLabel'), value: visitKpis.total },
            {
              label: t('pets.profile.heroKpiVaccLabel'),
              value: vaccinationStatusLabel(pet.vaccination_status ?? derivedVaccination),
            },
            { label: t('pets.profile.heroKpiRevenueLabel'), value: formatMoney(revenueTotals.charged) },
          ]}
          contactTel={owner?.phone ?? undefined}
          contactEmail={owner?.email || undefined}
          phoneAriaLabel={t('common.call')}
          emailAriaLabel={t('common.sendEmail')}
          onCalendar={() => {
            const path = businessSlug ? `/${businessSlug}/appointments` : '/appointments';
            navigate(path);
            onOpenChange(false);
          }}
          calendarLabel={t('pets.profile.heroCalendarAria')}
        >
          <DetailModalActionBar
            tone="on-primary"
            className="max-sm:pr-14 justify-end border-0 pb-0"
            editLabel={t('common.edit')}
            deleteLabel={t('common.delete')}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </ProfileDialogPrimaryHero>

        <Tabs
          key={pet.id}
          value={petProfileTab}
          onValueChange={(v) => setPetProfileTab(v as 'overview' | 'appointments')}
          className={profileDialogTabsChromeClassName}
        >
          <TabsList className={profileDialogTabsListClassName}>
            <TabsTrigger value="overview" className={profileDialogTabsTriggerClassName}>
              {t('pets.profile.tabOverview')}
            </TabsTrigger>
            <TabsTrigger value="appointments" className={profileDialogTabsTriggerClassName}>
              {t('pets.profile.tabAppointments')}
            </TabsTrigger>
          </TabsList>

          <div className={profileTabsBodyShellClassName}>
          <TabsContent value="overview" className={profileTabPanelClassName}>
            <div className="grid gap-6 md:grid-cols-[minmax(0,17.5rem)_1fr] md:items-start">
              <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 md:sticky md:top-0">
                <div className="min-w-0">
                  <p className="text-sm capitalize text-muted-foreground">{pet.species || t('pets.species')}</p>
                  <p className="truncate font-medium">{pet.breeds?.name ?? pet.breed ?? '—'}</p>
                </div>

                <div className="rounded-lg border border-border/50 bg-background/80 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    {t('pets.profile.ownerSection')}
                  </div>
                  {owner ? (
                    <>
                      <p className="text-sm font-medium leading-snug">
                        {owner.first_name} {owner.last_name}
                      </p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2 break-all">
                          <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{owner.email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="tabular-nums">{formatPhoneNumberDisplay(owner.phone)}</span>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => onViewOwner(owner.id)}>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        {t('pets.profile.openOwner')}
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('pets.profile.noOwner')}</p>
                  )}
                </div>

                <div className="rounded-lg border border-border/50 bg-background/80 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Syringe className="h-4 w-4 text-muted-foreground shrink-0" />
                    {t('pets.profile.vaccinationTitle')}
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('pets.profile.vaccinationStatus')}:</span>{' '}
                    <Badge variant="outline" className="font-normal">
                      {vaccinationStatusLabel(pet.vaccination_status ?? derivedVaccination)}
                    </Badge>
                  </p>
                  {lastVaccinationDisplay ? (
                    <p className="text-sm text-muted-foreground">
                      {t('pets.profile.lastVaccination')}: <span className="text-foreground">{lastVaccinationDisplay}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('pets.profile.noLastVaccination')}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 shrink-0" />
                    <span>
                      {pet.weight ?? '—'} {t('pets.lbs')}
                    </span>
                  </div>
                  {pet.birth_month ? (
                    <div className="flex items-center gap-2">
                      <Cake className="h-4 w-4 shrink-0" />
                      <span>{t('pets.profile.birthMonth', { month: pet.birth_month })}</span>
                    </div>
                  ) : null}
                </div>

                {notesBlock ? (
                  <div className="rounded-lg border border-border/50 bg-background/80 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      {t('pets.profile.notesTitle')}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notesBlock}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('pets.profile.noNotes')}</p>
                )}

                <Button type="button" variant="outline" className="w-full" onClick={onEdit}>
                  {t('pets.profile.editPet')}
                </Button>
              </div>

              <div className="space-y-4 min-w-0">
                {visibleAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 min-w-[12rem]">{alert.message}</span>
                    {alert.action && alert.onAction ? (
                      <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={alert.onAction}>
                        {alert.action}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label={t('pets.profile.dismissAlert')}
                      onClick={() => setDismissedAlerts((prev) => new Set([...prev, alert.id]))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('pets.profile.visitHistory')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1">
                      <p className="text-2xl font-semibold tabular-nums">{visitKpis.total}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('pets.profile.visitBreakdown', { done: visitKpis.completed, noShow: visitKpis.noShow })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('pets.profile.upcoming')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {nextAppointment ? (
                        <p className="text-sm font-medium">{format(nextAppointment.date as Date, 'MMM d, yyyy')}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('pets.profile.noUpcoming')}</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-sm sm:col-span-1">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('pets.profile.revenueCollected')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1">
                      <p className="text-2xl font-semibold tabular-nums">{formatMoney(revenueTotals.charged)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('pets.profile.revenueBookedSubtitle', { amount: formatMoney(revenueTotals.booked) })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <h3 className="text-sm font-semibold mb-2">{t('pets.profile.revenueByMonth')}</h3>
                  {revenueByMonth.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('pets.profile.noAppointments')}</p>
                  ) : (
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border/60">
                            <th className="py-2 pr-2 font-medium">{t('pets.profile.colMonth')}</th>
                            <th className="py-2 pr-2 font-medium tabular-nums">{t('pets.profile.colCharged')}</th>
                            <th className="py-2 font-medium tabular-nums">{t('pets.profile.colBooked')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueByMonth.map((row) => (
                            <tr key={row.monthKey} className="border-b border-border/40 last:border-0">
                              <td className="py-2 pr-2 capitalize">{row.label}</td>
                              <td className="py-2 pr-2 tabular-nums font-medium">{formatMoney(row.charged)}</td>
                              <td className="py-2 tabular-nums text-muted-foreground">{formatMoney(row.booked)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <h3 className="text-sm font-semibold mb-2">{t('pets.profile.recentAppointments')}</h3>
                  {petAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('pets.profile.noAppointments')}</p>
                  ) : (
                    <ul className="space-y-1 max-h-44 overflow-y-auto">
                      {petAppointments.slice(0, 8).map((apt) => (
                        <li
                          key={apt.id}
                          className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{format(apt.date as Date, 'MMM d, yyyy')}</span>
                          </span>
                          <span className="text-muted-foreground truncate max-w-[40%]">{apt.service_type || '—'}</span>
                          <span className="tabular-nums text-xs">
                            {formatMoney(apt.bookedDollars)}
                            {apt.chargedDollars != null ? (
                              <span className="text-foreground"> · {formatMoney(apt.chargedDollars)}</span>
                            ) : apt.txn ? (
                              <span className="text-muted-foreground"> · {t('pets.profile.pendingCheckout')}</span>
                            ) : null}
                          </span>
                          <Badge variant="outline" className="font-normal capitalize text-xs">
                            {normalizeStatus(apt.status).replace(/_/g, ' ') || '—'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appointments" className={profileTabPanelClassName}>
            {petAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('pets.profile.noAppointments')}</p>
            ) : (
              <ul className="space-y-3">
                {petAppointments.map((apt) => (
                  <li key={apt.id} className="rounded-lg border border-border/60 bg-card/40 px-3 py-3 text-sm space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{format(apt.date as Date, 'MMM d, yyyy')}</span>
                        <Badge variant="outline" className="font-normal capitalize">
                          {normalizeStatus(apt.status).replace(/_/g, ' ') || '—'}
                        </Badge>
                      </div>
                      <div className="text-right tabular-nums text-xs sm:text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('pets.profile.bookedLabel')}:</span>{' '}
                          <span className="font-medium">{formatMoney(apt.bookedDollars)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('pets.profile.chargedLabel')}:</span>{' '}
                          {apt.chargedDollars != null ? (
                            <span className="font-medium text-foreground">{formatMoney(apt.chargedDollars)}</span>
                          ) : apt.txn ? (
                            <span className="text-muted-foreground">{t('pets.profile.pendingCheckout')}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-muted-foreground">{apt.service_type || t('pets.profile.serviceFallback')}</p>
                    {apt.notes ? (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/50 pt-2">
                        <span className="font-medium text-foreground">{t('pets.profile.appointmentNotes')}:</span> {apt.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
