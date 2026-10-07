import { useMemo, useState } from 'react';
import { formatT } from '@/lib/timeFormat';
import { format, formatDistanceToNow } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { Check, Clock, Inbox, Loader2, Mail, MessageSquare, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Appointment, BusinessClient, Pet, Service } from '@/hooks/useBusinessData';
import type { Employee } from '@/types';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { appointmentStartHHmm, parseAppointmentDate } from '@/lib/calendarHelpers';
import { isPendingStatus, isTerminalAppointmentStatus, normalizeAppointmentStatus } from '@/lib/appointmentStatus';
import { formatTime12h, normalizeHHmm, overlaps, staffOffersAll } from '@/lib/groomerAvailability';
import { minutesToHHmm, timeToMinutes } from '@/lib/businessHours';

export type RequestDecision =
  | { kind: 'confirm'; staffId: string | null }
  | { kind: 'propose'; date: string; time: string; note: string }
  | { kind: 'decline'; note: string };

interface Props {
  appointments: Appointment[];
  pets: Pet[];
  clients: BusinessClient[];
  services: Service[];
  employees: Employee[];
  onDecide: (apt: Appointment, decision: RequestDecision) => Promise<boolean>;
}

const DECLINE_REASONS = ['declineFull', 'declineService', 'declineInfo'] as const;

function serviceIdsOf(a: Appointment): string[] {
  if (Array.isArray(a.service_ids) && a.service_ids.length) return a.service_ids;
  return a.service_id ? [a.service_id] : [];
}

function RequestCard({
  apt,
  all,
  pets,
  clients,
  services,
  employees,
  onDecide,
}: { apt: Appointment; all: Appointment[] } & Omit<Props, 'appointments'>) {
  const { language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const pet = pets.find((p) => p.id === apt.pet_id);
  const client = clients.find((c) => c.id === apt.client_id);
  const svcIds = serviceIdsOf(apt);
  const svcNames = svcIds.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(', ') || apt.service_type || '—';
  const day = parseAppointmentDate(apt);
  const start = appointmentStartHHmm(apt);
  const end = normalizeHHmm(apt.end_time) || minutesToHHmm(timeToMinutes(start) + 60);
  const requestedStaff = apt.staff_id ? employees.find((e) => e.id === apt.staff_id) : null;
  const eligible = employees.filter((e) => staffOffersAll(e, svcIds));

  /** Groomers who already have something at that time. */
  const busyStaff = useMemo(() => {
    const key = String(apt.appointment_date ?? '').slice(0, 10);
    const slot = { start: timeToMinutes(start), end: timeToMinutes(end) };
    const ids = new Set<string>();
    for (const o of all) {
      if (o.id === apt.id || isTerminalAppointmentStatus(o.status) || isPendingStatus(o.status)) continue;
      if (String(o.appointment_date ?? '').slice(0, 10) !== key || !o.staff_id) continue;
      const os = timeToMinutes(appointmentStartHHmm(o));
      const oe = normalizeHHmm(o.end_time) ? timeToMinutes(normalizeHHmm(o.end_time)) : os + 60;
      if (overlaps(slot, { start: os, end: oe })) ids.add(o.staff_id);
    }
    return ids;
  }, [all, apt, start, end]);

  const firstFree = eligible.find((e) => !busyStaff.has(e.id))?.id ?? null;
  const [mode, setMode] = useState<'idle' | 'propose' | 'decline'>('idle');
  const [staffId, setStaffId] = useState<string>(apt.staff_id ?? firstFree ?? '');
  const [propDate, setPropDate] = useState(String(apt.appointment_date ?? '').slice(0, 10));
  const [propTime, setPropTime] = useState(start);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const conflict = !!staffId && busyStaff.has(staffId);

  const run = async (d: RequestDecision) => {
    setBusy(true);
    const ok = await onDecide(apt, d);
    setBusy(false);
    if (ok) setMode('idle');
  };

  const pref = client?.contact_preference ?? 'email';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{pet?.name ?? t('apptBook.unknownPet')}</span>
            {pet?.breed ? <span className="text-sm text-muted-foreground">· {pet.breed}</span> : null}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {client ? `${client.first_name} ${client.last_name}` : t('apptBook.unknownOwner')}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {client?.phone ? (
              <a className="inline-flex items-center gap-1 hover:text-foreground" href={`tel:${client.phone}`}>
                <Phone className="h-3 w-3" /> {formatPhoneNumber(client.phone)}
              </a>
            ) : null}
            {client?.email ? (
              <a className="inline-flex items-center gap-1 hover:text-foreground" href={`mailto:${client.email}`}>
                <Mail className="h-3 w-3" /> {client.email}
              </a>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> {t(`bookingDialog.pref_${pref}`)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold capitalize">
            {day ? format(day, 'EEE d MMM', { locale }) : '—'} · {formatTime12h(start)}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('requests.received', {
              ago: formatDistanceToNow(new Date(apt.created_at), { addSuffix: true, locale }),
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">{t('requests.services')}</div>
          <div className="font-medium">{svcNames}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t('requests.requestedGroomer')}</div>
          <div className="font-medium">
            {requestedStaff ? formatStaffNameAggregated(requestedStaff.name) : t('requests.noPreference')}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t('requests.estimate')}</div>
          <div className="font-medium tabular-nums">${Number(apt.total_price ?? apt.price ?? 0).toFixed(2)}</div>
        </div>
        {apt.notes ? (
          <div className="sm:col-span-3">
            <div className="text-xs text-muted-foreground">{t('requests.clientNotes')}</div>
            <div className="whitespace-pre-wrap">{apt.notes}</div>
          </div>
        ) : null}
      </div>

      {mode === 'idle' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={staffId || undefined} onValueChange={setStaffId}>
            <SelectTrigger className="h-9 w-56" aria-label={t('requests.assignGroomer')}>
              <SelectValue placeholder={t('requests.assignGroomer')} />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {formatStaffNameAggregated(e.name)}
                  {busyStaff.has(e.id) ? ` · ${t('requests.busyAtThatTime')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={busy || !staffId || conflict} onClick={() => void run({ kind: 'confirm', staffId })}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
            {t('requests.confirm')}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setMode('propose')}>
            <Clock className="mr-1 h-4 w-4" /> {t('requests.proposeTime')}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => setMode('decline')}>
            <X className="mr-1 h-4 w-4" /> {t('requests.decline')}
          </Button>
          {conflict ? <span className="text-xs text-amber-700 dark:text-amber-400">{t('requests.conflictHint')}</span> : null}
        </div>
      ) : null}

      {mode === 'propose' ? (
        <div className="mt-3 space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap gap-2">
            <Input type="date" className="h-9 w-44" value={propDate} onChange={(e) => setPropDate(e.target.value)} aria-label={t('requests.newDate')} />
            <Input type="time" step={900} className="h-9 w-32" value={propTime} onChange={(e) => setPropTime(e.target.value)} aria-label={t('requests.newTime')} />
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('requests.proposeNotePlaceholder')} className="min-h-[60px]" maxLength={500} />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !propDate || !propTime} onClick={() => void run({ kind: 'propose', date: propDate, time: normalizeHHmm(propTime), note })}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t('requests.sendProposal')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'decline' ? (
        <div className="mt-3 space-y-2 rounded-lg border border-destructive/30 p-3">
          <div className="flex flex-wrap gap-1.5">
            {DECLINE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                onClick={() => setNote(t(`requests.${r}`))}
              >
                {t(`requests.${r}`)}
              </button>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('requests.declineNotePlaceholder')} className="min-h-[60px]" maxLength={500} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => void run({ kind: 'decline', note })}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t('requests.confirmDecline')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppointmentRequestsPanel(props: Props) {
  const { language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const pending = useMemo(
    () =>
      props.appointments
        .filter((a) => isPendingStatus(a.status))
        .sort((a, b) => `${a.appointment_date}${a.start_time}`.localeCompare(`${b.appointment_date}${b.start_time}`)),
    [props.appointments],
  );
  const recent = useMemo(() => {
    const since = Date.now() - 14 * 864e5;
    return props.appointments
      .filter((a) => a.booking_source === 'online' && a.decided_at && new Date(a.decided_at).getTime() > since)
      .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)))
      .slice(0, 15);
  }, [props.appointments]);

  const deciderName = (a: Appointment) => {
    const e = a.decided_by_staff_id ? props.employees.find((x) => x.id === a.decided_by_staff_id) : null;
    return e ? formatStaffNameAggregated(e.name) : t('requests.deciderUnknown');
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t('requests.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('requests.subtitle')}</p>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">{t('requests.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((apt) => (
            <RequestCard key={apt.id} apt={apt} all={props.appointments} {...props} />
          ))}
        </div>
      )}

      {recent.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('requests.recentlyDecided')}</h3>
          <div className="divide-y rounded-xl border">
            {recent.map((a) => {
              const pet = props.pets.find((p) => p.id === a.pet_id);
              const st = normalizeAppointmentStatus(a.status);
              const declined = st === 'canceled' || st === 'cancelled';
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{pet?.name ?? '—'}</span>{' '}
                    <span className="text-muted-foreground">
                      · {(() => {
                        const d = parseAppointmentDate(a);
                        return d ? format(d, 'EEE d MMM', { locale }) : '—';
                      })()}{' '}
                      {formatTime12h(appointmentStartHHmm(a))}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={declined ? 'destructive' : 'secondary'} className="text-[11px]">
                      {declined ? t('requests.declined') : t('requests.confirmed')}
                    </Badge>
                    {t('requests.decidedBy', {
                      name: deciderName(a),
                      when: formatT(new Date(a.decided_at as string), 'd MMM, h:mm a', { locale }),
                    })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('requests.internalOnly')}</p>
        </div>
      ) : null}
    </div>
  );
}

