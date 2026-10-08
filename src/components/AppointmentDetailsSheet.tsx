import { useState } from 'react';
import { formatT } from '@/lib/timeFormat';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  CreditCard,
  Globe,
  Inbox,
  Loader2,
  Mail,
  Phone,
  Play,
  ReceiptText,
  UserX,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { openQuickCharge } from '@/components/QuickChargeDialog';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Appointment, BusinessClient, Pet, Service } from '@/hooks/useBusinessData';
import type { Employee } from '@/types';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { appointmentStartHHmm, parseAppointmentDate } from '@/lib/calendarHelpers';
import {
  appointmentStatusDotClass,
  appointmentStatusLabelKey,
  canMarkAsNoShow,
  isTerminalAppointmentStatus,
  normalizeAppointmentStatus,
} from '@/lib/appointmentStatus';
import { formatTime12h, normalizeHHmm } from '@/lib/groomerAvailability';

interface Props {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pets: Pet[];
  clients: BusinessClient[];
  services: Service[];
  employees: Employee[];
  canMarkNoShow: boolean;
  businessSlug: string | null;
  /** Show the "Cobrar" button (managers with checkout access). */
  canCharge?: boolean;
  /** Returns true on success. */
  onSetStatus: (apt: Appointment, status: 'confirmed' | 'in_progress' | 'completed' | 'canceled' | 'no_show') => Promise<boolean>;
  onEdit: (apt: Appointment) => void;
  onOpenRequests: () => void;
}

export function AppointmentDetailsSheet({
  appointment: apt,
  open,
  onOpenChange,
  pets,
  clients,
  services,
  employees,
  canMarkNoShow,
  businessSlug,
  canCharge = false,
  onSetStatus,
  onEdit,
  onOpenRequests,
}: Props) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!apt) return null;

  const pet = pets.find((p) => p.id === apt.pet_id);
  const client = clients.find((c) => c.id === apt.client_id);
  const staff = apt.staff_id ? employees.find((e) => e.id === apt.staff_id) : null;
  const decider = apt.decided_by_staff_id ? employees.find((e) => e.id === apt.decided_by_staff_id) : null;
  const ids = Array.isArray(apt.service_ids) && apt.service_ids.length ? apt.service_ids : apt.service_id ? [apt.service_id] : [];
  const svc = ids.map((id) => services.find((s) => s.id === id)).filter(Boolean) as Service[];
  const day = parseAppointmentDate(apt);
  const start = appointmentStartHHmm(apt);
  const end = normalizeHHmm(apt.end_time);
  const status = normalizeAppointmentStatus(apt.status);
  const terminal = isTerminalAppointmentStatus(apt.status);
  const paidTxnId = apt.transaction_id ?? null;
  const openChargePanel = () => {
    onOpenChange(false);
    openQuickCharge({
      appointmentId: apt.id,
      clientId: apt.client_id ?? null,
      serviceIds: ids,
      fallbackPrice: apt.total_price ?? apt.price ?? null,
      label: [pet?.name, svc.map((s) => s.name).join(', ')].filter(Boolean).join(' · ') || null,
    });
  };
  // Services' list prices (before tax and tip); the charge panel shows the full total.
  const chargeDollars = svc.length ? svc.reduce((s, x) => s + Number(x.price || 0), 0) : Number(apt.total_price ?? apt.price ?? 0);

  const act = async (key: string, s: Parameters<Props['onSetStatus']>[1]) => {
    setBusy(key);
    const ok = await onSetStatus(apt, s);
    setBusy(null);
    // Finishing an appointment that hasn't been charged goes straight to the charge panel.
    if (ok && s === 'completed' && canCharge && !apt.transaction_id) openChargePanel();
    if (ok && (s === 'canceled' || s === 'no_show')) onOpenChange(false);
  };

  const prefix = businessSlug ? `/${businessSlug}` : '';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b p-5 text-left">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', appointmentStatusDotClass(apt.status))} />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(appointmentStatusLabelKey(apt.status))}
              </span>
              {apt.booking_source === 'online' ? (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Globe className="h-3 w-3" /> {t('apptBook.onlineBadge')}
                </Badge>
              ) : null}
            </div>
            <SheetTitle className="text-xl">
              {pet?.name ?? t('apptBook.unknownPet')}
              {pet?.breed ? <span className="ml-2 text-base font-normal text-muted-foreground">{pet.breed}</span> : null}
            </SheetTitle>
            <SheetDescription className="capitalize">
              {day ? format(day, 'EEEE d MMMM', { locale }) : '—'} · {formatTime12h(start)}
              {end ? ` – ${formatTime12h(end)}` : ''}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 p-5 text-sm">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">{t('details.client')}</dt>
              <dd className="font-medium">{client ? `${client.first_name} ${client.last_name}` : t('apptBook.unknownOwner')}</dd>
              <dt className="text-muted-foreground">{t('details.groomer')}</dt>
              <dd className="font-medium">{staff ? formatStaffNameAggregated(staff.name) : t('apptBook.unassigned')}</dd>
              <dt className="text-muted-foreground">{t('details.services')}</dt>
              <dd>
                {svc.length ? svc.map((s) => s.name).join(', ') : apt.service_type ?? '—'}
              </dd>
              <dt className="text-muted-foreground">{t('details.total')}</dt>
              <dd className="font-semibold tabular-nums">${Number(apt.total_price ?? apt.price ?? 0).toFixed(2)}</dd>
            </dl>

            {client?.phone || client?.email ? (
              <div className="flex flex-wrap gap-2">
                {client?.phone ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${client.phone}`}>
                      <Phone className="mr-1 h-4 w-4" /> {formatPhoneNumber(client.phone)}
                    </a>
                  </Button>
                ) : null}
                {client?.email ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`mailto:${client.email}`}>
                      <Mail className="mr-1 h-4 w-4" /> {t('details.email')}
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {apt.notes ? (
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t('details.notes')}</div>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2">{apt.notes}</p>
              </div>
            ) : null}

            {apt.decided_at ? (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                {t('requests.decidedBy', {
                  name: decider ? formatStaffNameAggregated(decider.name) : t('requests.deciderUnknown'),
                  when: formatT(new Date(apt.decided_at), 'd MMM, h:mm a', { locale }),
                })}{' '}
                · {t('requests.internalOnly')}
              </p>
            ) : null}
          </div>

          <div className="mt-auto space-y-2 border-t p-5">
            {status === 'pending' ? (
              <Button className="w-full" onClick={onOpenRequests}>
                <Inbox className="mr-2 h-4 w-4" /> {t('details.reviewRequest')}
              </Button>
            ) : null}
            {paidTxnId ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate(`${prefix}/transactions/${encodeURIComponent(paidTxnId)}`)}
              >
                <ReceiptText className="mr-2 h-4 w-4" /> {t('details.viewSale')}
              </Button>
            ) : canCharge && !['canceled', 'cancelled', 'no-show', 'pending'].includes(status) ? (
              <Button
                className="h-11 w-full text-base"
                onClick={openChargePanel}
              >
                <CreditCard className="mr-2 h-5 w-5" /> {t('details.charge')}
                {chargeDollars > 0 ? ` $${chargeDollars.toFixed(2)}` : ''}
              </Button>
            ) : null}
            {status === 'scheduled' ? (
              <Button className="w-full" variant="outline" disabled={!!busy} onClick={() => void act('confirm', 'confirmed')}>
                {busy === 'confirm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {t('details.markConfirmed')}
              </Button>
            ) : null}
            {status === 'scheduled' || status === 'confirmed' ? (
              <Button className="w-full" variant="outline" disabled={!!busy} onClick={() => void act('start', 'in_progress')}>
                {busy === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {t('details.start')}
              </Button>
            ) : null}
            {status === 'in-progress' ? (
              <Button className="w-full" variant="outline" disabled={!!busy} onClick={() => void act('complete', 'completed')}>
                {busy === 'complete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                {t('details.complete')}
              </Button>
            ) : null}
            {!terminal ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => onEdit(apt)}>
                  <CalendarClock className="mr-2 h-4 w-4" /> {t('details.reschedule')}
                </Button>
                {canMarkNoShow && canMarkAsNoShow(apt.status) ? (
                  <Button variant="outline" disabled={!!busy} onClick={() => void act('noshow', 'no_show')}>
                    <UserX className="mr-2 h-4 w-4" /> {t('details.noShow')}
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  className="col-span-2 text-destructive hover:text-destructive"
                  disabled={!!busy}
                  onClick={() => setConfirmCancel(true)}
                >
                  <Ban className="mr-2 h-4 w-4" /> {t('details.cancelAppointment')}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => onEdit(apt)}>
                {t('details.viewEdit')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('details.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('details.cancelBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('details.keep')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void act('cancel', 'canceled')}
            >
              {t('details.cancelAppointment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
