import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Inbox,
  Link2,
  List,
  Loader2,
  Plus,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { t } from '@/lib/translations';
import type { CalendarStaff } from '@/types/calendar';
import { AppointmentBookSidebar, type ApptBookWeekJumpOffset } from '@/components/AppointmentBookSidebar';
import { AppointmentBookDayGrid } from '@/components/AppointmentBookDayGrid';
import { AppointmentBookWeekView } from '@/components/AppointmentBookWeekView';
import { AppointmentBookListView } from '@/components/AppointmentBookListView';
import { AppointmentRequestsPanel, type RequestDecision } from '@/components/AppointmentRequestsPanel';
import { AppointmentDetailsSheet } from '@/components/AppointmentDetailsSheet';
import { GroomerServicesSettings } from '@/components/GroomerServicesSettings';
import { BookingFormDialog } from '@/components/BookingFormDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { useAppointments, usePets, useServices, useClients, type Appointment } from '@/hooks/useBusinessData';
import { useEmployeeShifts, useEmployees, useSettings } from '@/hooks/useSupabaseData';
import { useStaffServiceRates } from '@/hooks/useStaffServiceRates';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import {
  convertAppointmentsToCalendar,
  convertAppointmentsToCalendarInRange,
  convertEmployeesToCalendar,
  appointmentStartHHmm,
  parseAppointmentDate,
} from '@/lib/calendarHelpers';
import {
  getStoredApptBookCalendarScope,
  setStoredApptBookCalendarScope,
  getStoredSelectedServiceIds,
  setStoredSelectedServiceIds,
  getStoredSelectedEmployeeIds,
  setStoredSelectedEmployeeIds,
  clearApptBookCategoryFilterStorage,
  setStoredApptBookServiceFilter,
  type ApptBookCalendarScope,
} from '@/lib/apptBookCalendarPrefs';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import {
  dateToDayKey,
  firstOpenDayInWeek,
  isOpenBusinessDay,
  minutesToHHmm,
  parseBusinessHours,
  timeToMinutes,
} from '@/lib/businessHours';
import {
  bookableStaff,
  businessUsesShifts,
  normalizeHHmm,
  UNASSIGNED_STAFF_ID,
  workingWindows,
  type Interval,
} from '@/lib/groomerAvailability';
import { isPendingStatus, isTerminalAppointmentStatus } from '@/lib/appointmentStatus';
import { staffIdForBusinessOrNull } from '@/lib/staffFkGuard';
import { notifyAppointmentClient, type AppointmentNotificationKind } from '@/lib/appointmentNotifications';
import { devConsole } from '@/lib/clientDebug';

type ApptBookTab = 'calendar' | 'list' | 'requests' | 'settings';

const TAB_SEGMENTS: Record<ApptBookTab, string> = {
  calendar: 'calendar',
  list: 'appointments',
  requests: 'requests',
  settings: 'settings',
};

function tabFromPath(pathname: string): ApptBookTab {
  const parts = pathname.split('/').filter(Boolean);
  const seg = parts[parts.indexOf('appt-book') + 1];
  if (seg === 'appointments') return 'list';
  if (seg === 'requests') return 'requests';
  if (seg === 'settings') return 'settings';
  return 'calendar';
}

function FilterHeader({
  title,
  onAll,
  onNone,
  className,
}: {
  title: string;
  onAll: () => void;
  onNone: () => void;
  className?: string;
}) {
  return (
    <div className={`mb-1 flex items-center justify-between gap-2 ${className ?? ''}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className="flex items-center gap-1 text-xs">
        <button type="button" className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10" onClick={onAll}>
          {t('apptBook.filterAll')}
        </button>
        <button type="button" className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10" onClick={onNone}>
          {t('apptBook.filterNone')}
        </button>
      </span>
    </div>
  );
}

function FilterRow({
  label,
  checked,
  onToggle,
  onOnly,
  color,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  onOnly: () => void;
  color?: string;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={checked} onCheckedChange={onToggle} />
        {color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /> : null}
        <span className="truncate">{label}</span>
      </label>
      <button
        type="button"
        onClick={onOnly}
        className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-primary opacity-0 hover:bg-primary/10 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
      >
        {t('apptBook.filterOnly')}
      </button>
    </div>
  );
}

export function AppointmentBook() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const businessSlug = useResolvedBusinessSlug();
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const apptBookBase = `${businessSlug ? `/${businessSlug}` : ''}/appt-book`;
  const { language } = useLanguage();
  const dateFnsLocale = language === 'es' ? esLocale : enUS;
  const { role, profile, staffId: myStaffId, user } = useAuth();
  const isManager = role === 'manager' || role === 'super_admin' || !!profile?.is_super_admin;

  const tab = tabFromPath(location.pathname);
  const goTab = useCallback(
    (next: ApptBookTab) => navigate(`${apptBookBase}/${TAB_SEGMENTS[next]}${next === 'list' ? location.search : ''}`),
    [apptBookBase, navigate, location.search],
  );

  // Canonical URL: /…/appt-book → /…/appt-book/calendar
  useEffect(() => {
    const segs = location.pathname.split('/').filter(Boolean);
    const idx = segs.indexOf('appt-book');
    if (idx >= 0 && !segs[idx + 1]) navigate(`${apptBookBase}/calendar${location.search}`, { replace: true });
  }, [location.pathname, location.search, apptBookBase, navigate]);

  // Daycare mode is hidden for now: drop any stored preference for it.
  useEffect(() => {
    setStoredApptBookServiceFilter('All Services');
  }, []);

  // ---------------- data ----------------
  const {
    appointments,
    loading: appointmentsLoading,
    error: appointmentsError,
    addAppointment,
    updateAppointment,
    refetch: refetchAppointments,
  } = useAppointments();
  const { pets, loading: petsLoading, error: petsError, refetch: refetchPets, addPet } = usePets();
  const { employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees, updateEmployee } =
    useEmployees({ includeSensitive: false });
  const { services, loading: servicesLoading, error: servicesError, refetch: refetchServices } = useServices();
  const { clients, error: clientsError, refetch: refetchClients, addClient } = useClients();
  const { settings, updateSetting } = useSettings();
  const { rates, saveRate } = useStaffServiceRates();

  // Until the business is known the hooks report "not loading" with empty lists; keep the spinner up
  // so History doesn't flash "No appointments match your filters".
  const loading = !businessId || appointmentsLoading || petsLoading || employeesLoading || servicesLoading;
  const fetchError = appointmentsError ?? petsError ?? employeesError ?? servicesError ?? clientsError;
  useEffect(() => {
    if (fetchError) devConsole.warn('[AppointmentBook] load error', fetchError);
  }, [fetchError]);
  const refetchAll = () => {
    void refetchAppointments();
    void refetchPets();
    void refetchEmployees();
    void refetchServices();
    void refetchClients();
  };

  const hoursPerDay = useMemo(() => parseBusinessHours(settings?.business_hours), [settings?.business_hours]);
  const activeServices = useMemo(() => services.filter((s) => s.is_active !== false), [services]);

  // ---------------- date & scope ----------------
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [calendarScope, setCalendarScope] = useState<ApptBookCalendarScope>(() => getStoredApptBookCalendarScope());
  const [weekJumpOffset, setWeekJumpOffset] = useState<ApptBookWeekJumpOffset | null>(null);
  const [weekJumpNoAvailability, setWeekJumpNoAvailability] = useState(false);
  useEffect(() => setStoredApptBookCalendarScope(calendarScope), [calendarScope]);

  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);
  const weekEnd = useMemo(() => endOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);
  const shiftRange = useMemo(() => ({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);
  const { shifts } = useEmployeeShifts({ dateRange: shiftRange });
  const usesShifts = useMemo(() => businessUsesShifts(shifts, weekStart, weekEnd), [shifts, weekStart, weekEnd]);

  const clearWeekJump = useCallback(() => {
    setWeekJumpOffset(null);
    setWeekJumpNoAvailability(false);
  }, []);
  const goToDate = useCallback(
    (d: Date) => {
      clearWeekJump();
      setSelectedDate(startOfDay(d));
    },
    [clearWeekJump],
  );
  const step = calendarScope === 'by-week' ? 7 : 1;

  const applyWeekJump = useCallback(
    (offset: ApptBookWeekJumpOffset) => {
      const target = addWeeks(startOfWeek(startOfDay(new Date()), { weekStartsOn: 0 }), offset);
      const firstOpen = firstOpenDayInWeek(target, hoursPerDay);
      setWeekJumpOffset(offset);
      setWeekJumpNoAvailability(!firstOpen);
      setSelectedDate(startOfDay(firstOpen ?? target));
    },
    [hoursPerDay],
  );

  // ---------------- filters ----------------
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string> | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string> | null>(null);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => {
    if (loading || hydrated.current) return;
    hydrated.current = true;
    const ss = getStoredSelectedServiceIds();
    const validSs = (ss ?? []).filter((id) => activeServices.some((s) => s.id === id));
    if (validSs.length) setSelectedServiceIds(new Set(validSs));
    const se = getStoredSelectedEmployeeIds();
    const validSe = (se ?? []).filter((id) => employees.some((e) => e.id === id));
    if (validSe.length) setSelectedStaffIds(new Set(validSe));
  }, [loading, activeServices, employees]);
  useEffect(() => {
    if (!hydrated.current) return;
    clearApptBookCategoryFilterStorage();
    if (selectedServiceIds?.size) setStoredSelectedServiceIds([...selectedServiceIds]);
    if (selectedStaffIds?.size) setStoredSelectedEmployeeIds([...selectedStaffIds]);
  }, [selectedServiceIds, selectedStaffIds]);
  // null = everything shown; a Set (even empty) = only those. An empty Set lets people clear all and pick one.
  const activeFilterCount = (selectedServiceIds ? 1 : 0) + (selectedStaffIds ? 1 : 0);
  const clearFilters = () => {
    setSelectedServiceIds(null);
    setSelectedStaffIds(null);
  };
  const toggleIn = (set: Set<string> | null, id: string, all: string[]): Set<string> | null => {
    const next = new Set(set ?? all);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return all.every((x) => next.has(x)) ? null : next;
  };

  // ---------------- columns ----------------
  const groomers = useMemo(() => {
    const base = showAllStaff ? employees.filter((e) => e.status === 'active') : bookableStaff(employees);
    return convertEmployeesToCalendar(base);
  }, [employees, showAllStaff]);

  const windowsByStaff = useMemo(() => {
    const out: Record<string, Interval[]> = {};
    const dayHours = hoursPerDay[dateToDayKey(selectedDate)];
    for (const e of employees) {
      if (e.status !== 'active') continue;
      out[e.id] = workingWindows({ staffId: e.id, day: selectedDate, dayHours, shifts, usesShifts });
    }
    return out;
  }, [employees, hoursPerDay, selectedDate, shifts, usesShifts]);

  // ---------------- calendar rows ----------------
  const calendarRows = useMemo(() => {
    if (loading) return [];
    const rows =
      calendarScope === 'by-week'
        ? convertAppointmentsToCalendarInRange(appointments, pets, employees, services, weekStart, weekEnd)
        : convertAppointmentsToCalendar(appointments, pets, employees, services, selectedDate);
    return rows.filter((r) => {
      if (selectedServiceIds && !(r.serviceIds ?? []).some((id) => selectedServiceIds.has(id))) return false;
      if (selectedStaffIds && r.staffId !== UNASSIGNED_STAFF_ID && !selectedStaffIds.has(r.staffId)) return false;
      return true;
    });
  }, [loading, calendarScope, appointments, pets, employees, services, weekStart, weekEnd, selectedDate, selectedServiceIds, selectedStaffIds]);

  const columns = useMemo((): CalendarStaff[] => {
    let cols = groomers;
    // Staff outside the groomer list who still have bookings in view stay visible.
    const extra = employees.filter(
      (e) => !cols.some((c) => c.id === e.id) && calendarRows.some((r) => r.staffId === e.id),
    );
    if (extra.length) cols = [...cols, ...convertEmployeesToCalendar(extra)];
    if (selectedStaffIds) cols = cols.filter((c) => selectedStaffIds.has(c.id));
    if (calendarRows.some((r) => r.staffId === UNASSIGNED_STAFF_ID)) {
      cols = [{ id: UNASSIGNED_STAFF_ID, name: t('apptBook.unassigned') }, ...cols];
    }
    return cols;
  }, [groomers, employees, calendarRows, selectedStaffIds]);

  // ---------------- summaries ----------------
  const todayKey = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const pendingCount = useMemo(
    () =>
      appointments.filter((a) => isPendingStatus(a.status) && String(a.appointment_date ?? '').slice(0, 10) >= todayKey)
        .length,
    [appointments, todayKey],
  );
  const busyDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of appointments) {
      if (isTerminalAppointmentStatus(a.status)) continue;
      const k = String(a.appointment_date ?? '').slice(0, 10);
      if (k) set.add(k);
    }
    return set;
  }, [appointments]);
  const daySummary = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    const list = appointments.filter((a) => String(a.appointment_date ?? '').slice(0, 10) === key);
    const booked = list.filter(
      (a) => !isPendingStatus(a.status) && (!isTerminalAppointmentStatus(a.status) || a.status === 'completed'),
    );
    return {
      appointments: booked.length,
      pending: list.filter((a) => isPendingStatus(a.status)).length,
      revenue: booked.reduce((s, a) => s + Number(a.total_price ?? a.price ?? 0), 0),
    };
  }, [appointments, selectedDate]);

  // ---------------- dialogs ----------------
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ staffId: string | null; date: Date | null; time: string | null }>({
    staffId: null,
    date: null,
    time: null,
  });
  const openCreate = useCallback(
    (opts?: { staffId?: string | null; date?: Date | null; time?: string | null }) => {
      setPrefill({
        staffId: opts?.staffId && opts.staffId !== UNASSIGNED_STAFF_ID ? opts.staffId : null,
        date: startOfDay(opts?.date ?? selectedDate),
        time: opts?.time ?? null,
      });
      setCreateOpen(true);
    },
    [selectedDate],
  );

  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsApt = appointments.find((a) => a.id === detailsId) ?? null;
  const [editing, setEditing] = useState<Appointment | null>(null);

  // Deep links: ?appointment=<id> opens it; ?pet=<id> shows that pet's history (from profiles, dashboard, notifications).
  useEffect(() => {
    const id = searchParams.get('appointment');
    if (!id || loading) return;
    const next = new URLSearchParams(searchParams);
    next.delete('appointment');
    setSearchParams(next, { replace: true });
    const apt = appointments.find((a) => a.id === id);
    if (!apt) {
      toast.error(t('apptBook.openAppointmentFailed'));
      return;
    }
    const d = parseAppointmentDate(apt);
    if (d) setSelectedDate(startOfDay(d));
    setDetailsId(apt.id);
  }, [searchParams, setSearchParams, appointments, loading]);
  const petFilterId = searchParams.get('pet');
  const historyScope = searchParams.get('scope') === 'history' || !!petFilterId;

  // ---------------- actions ----------------
  const notifyAndToast = useCallback(
    async (aptId: string, kind: AppointmentNotificationKind, successKey: string) => {
      const r = await notifyAppointmentClient(aptId, kind, { demo: demoBrowseOnly });
      if (r.sent) toast.success(`${t(successKey)} · ${t(r.channel === 'sms' ? 'notify.sentSms' : 'notify.sentEmail')}`);
      else if (r.skipped === 'demo') toast.success(`${t(successKey)} · ${t('notify.demoSkipped')}`);
      else if (r.skipped === 'client_opted_out' || r.skipped === 'no_contact')
        toast.success(`${t(successKey)} · ${t('notify.notNotified')}`);
      else toast.warning(`${t(successKey)} · ${t('notify.failed')}`);
    },
    [demoBrowseOnly],
  );

  const decide = useCallback(
    async (apt: Appointment, d: RequestDecision): Promise<boolean> => {
      // Who decided is stored for internal audit only; it is never sent to the client.
      const decidedBy = await staffIdForBusinessOrNull(myStaffId, businessId);
      const audit = {
        decided_at: new Date().toISOString(),
        decided_by_staff_id: decidedBy,
        decided_by_profile_id: decidedBy ? null : user?.id ?? null,
      };
      let patch: Partial<Appointment>;
      let kind: AppointmentNotificationKind;
      let successKey: string;
      if (d.kind === 'confirm') {
        patch = { status: 'confirmed', staff_id: d.staffId, decision_note: null, ...audit };
        kind = 'confirmed';
        successKey = 'requests.confirmedToast';
      } else if (d.kind === 'decline') {
        patch = { status: 'canceled', decision_note: d.note.trim() || null, ...audit };
        kind = 'declined';
        successKey = 'requests.declinedToast';
      } else {
        const start = appointmentStartHHmm(apt);
        const end = normalizeHHmm(apt.end_time);
        const dur = end ? timeToMinutes(end) - timeToMinutes(start) : 60;
        const [y, m, dd] = d.date.split('-').map(Number);
        const [hh, mm] = d.time.split(':').map(Number);
        const local = new Date(y, m - 1, dd, hh, mm, 0, 0);
        patch = {
          appointment_date: d.date,
          start_time: d.time,
          end_time: minutesToHHmm(Math.min(timeToMinutes(d.time) + Math.max(dur, 15), 24 * 60 - 1)),
          scheduled_date: local.toISOString(),
          decision_note: d.note.trim() || null,
          ...audit,
        };
        kind = 'proposed_time';
        successKey = 'requests.proposedToast';
      }
      const saved = await updateAppointment(apt.id, patch);
      if (!saved) {
        toast.error(t('bookingDialog.errSave'));
        return false;
      }
      await notifyAndToast(apt.id, kind, successKey);
      return true;
    },
    [myStaffId, businessId, user?.id, updateAppointment, notifyAndToast],
  );

  const setStatus = async (
    apt: Appointment,
    status: 'confirmed' | 'in_progress' | 'completed' | 'canceled' | 'no_show',
  ): Promise<boolean> => {
    const saved = await updateAppointment(apt.id, { status });
    if (!saved) {
      toast.error(t('bookingDialog.errSave'));
      return false;
    }
    if (status === 'canceled') await notifyAndToast(apt.id, 'canceled', 'details.canceledToast');
    else toast.success(t('details.statusUpdated'));
    return true;
  };

  const updateOffered = async (staffId: string, ids: string[]) =>
    !!(await updateEmployee(staffId, { offered_service_ids: ids }));

  // ---------------- booking link ----------------
  const bookingLink = businessSlug ? `${window.location.origin}/${businessSlug}/reservar` : '';
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('apptBook.copyFailed'));
    }
  };

  const isBookableDate = useCallback((d: Date) => isOpenBusinessDay(startOfDay(d), hoursPerDay), [hoursPerDay]);
  const toolbarDateLabel =
    calendarScope === 'by-week'
      ? `${format(weekStart, 'd MMM', { locale: dateFnsLocale })} – ${format(weekEnd, 'd MMM yyyy', { locale: dateFnsLocale })}`
      : format(selectedDate, 'EEEE, d MMMM yyyy', { locale: dateFnsLocale });

  // ---------------- render ----------------
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-background -mx-4 max-sm:pb-2 sm:-mx-6 sm:flex-row sm:items-stretch sm:overflow-hidden">
      {tab === 'calendar' ? (
        <AppointmentBookSidebar
          className="max-sm:order-2 max-sm:border-r-0 max-sm:border-t"
          selectedDate={selectedDate}
          onDateChange={goToDate}
          busyDayKeys={busyDayKeys}
          daySummary={loading ? null : daySummary}
          onOpenRequests={() => goTab('requests')}
          dateLocale={dateFnsLocale}
          showWeekJumpControls={!loading}
          weekJumpOffset={weekJumpOffset}
          onWeekJump={applyWeekJump}
          weekJumpNoAvailability={weekJumpNoAvailability}
          isBookableDate={isBookableDate}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col max-sm:order-1 sm:overflow-hidden">
        {/* Tabs + primary actions */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-6">
          <Tabs value={tab} onValueChange={(v) => goTab(v as ApptBookTab)}>
            <TabsList className="h-9">
              <TabsTrigger value="calendar" className="gap-1.5 px-2.5 text-xs sm:text-sm" title={t('appointments.calendar')}>
                <CalendarDays className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('appointments.calendar')}</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 px-2.5 text-xs sm:text-sm" title={t('apptBook.listAndHistory')}>
                <List className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('apptBook.listAndHistory')}</span>
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-1.5 px-2.5 text-xs sm:text-sm" title={t('apptBook.onlineRequests')}>
                <Inbox className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('apptBook.onlineRequests')}</span>
                {pendingCount > 0 ? (
                  <Badge className="ml-1 h-5 min-w-5 justify-center bg-amber-500 px-1.5 text-[11px] text-white hover:bg-amber-500">
                    {pendingCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 px-2.5 text-xs sm:text-sm" title={t('apptBook.settings')}>
                <Settings className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('apptBook.settings')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            {bookingLink ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" aria-label={t('apptBook.bookingLink')}>
                    <Link2 className="h-4 w-4" />
                    <span className="hidden md:inline">{t('apptBook.bookingLink')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-2">
                  <p className="text-sm font-medium">{t('apptBook.bookingLinkTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('apptBook.bookingLinkHint')}</p>
                  <Input readOnly value={bookingLink} className="h-8 text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => void copyLink()}>
                      {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                      {copied ? t('apptBook.copied') : t('apptBook.copy')}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={bookingLink} target="_blank" rel="noreferrer" aria-label={t('apptBook.openLink')}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            <Button size="sm" onClick={() => openCreate()} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('apptBook.newAppointment')}</span>
            </Button>
          </div>
        </div>

        {fetchError ? (
          <div className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">{t('apptBook.loadError')}</p>
            <Button variant="outline" size="sm" onClick={refetchAll}>
              {t('apptBook.retry')}
            </Button>
          </div>
        ) : null}

        {/* Calendar toolbar: one row */}
        {tab === 'calendar' ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-6">
            <Button variant="outline" size="sm" onClick={() => goToDate(new Date())}>
              {t('appointments.today')}
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToDate(subDays(selectedDate, step))}
                aria-label={t('apptBook.navigatePrevious')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => goToDate(addDays(selectedDate, step))}
                aria-label={t('apptBook.navigateNext')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold capitalize sm:text-base">{toolbarDateLabel}</h2>
            <Tabs value={calendarScope} onValueChange={(v) => setCalendarScope(v as ApptBookCalendarScope)}>
              <TabsList className="h-8">
                <TabsTrigger value="by-day" className="px-3 text-xs">
                  {t('apptBook.byDay')}
                </TabsTrigger>
                <TabsTrigger value="by-week" className="px-3 text-xs">
                  {t('apptBook.byWeek')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={activeFilterCount ? 'secondary' : 'outline'} size="sm" className="gap-1.5">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t('apptBook.filters')}
                  {activeFilterCount ? (
                    <Badge variant="default" className="h-5 min-w-5 justify-center px-1 text-[11px]">
                      {activeFilterCount}
                    </Badge>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="max-h-[60vh] overflow-y-auto p-3">
                  <FilterHeader
                    title={t('apptBook.specialist')}
                    onAll={() => setSelectedStaffIds(null)}
                    onNone={() => setSelectedStaffIds(new Set())}
                  />
                  <div className="space-y-0.5">
                    {groomers.map((g) => (
                      <FilterRow
                        key={g.id}
                        label={formatStaffNameAggregated(g.name)}
                        checked={!selectedStaffIds || selectedStaffIds.has(g.id)}
                        onToggle={() => setSelectedStaffIds((prev) => toggleIn(prev, g.id, groomers.map((x) => x.id)))}
                        onOnly={() => setSelectedStaffIds(new Set([g.id]))}
                      />
                    ))}
                  </div>
                  <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 text-sm text-muted-foreground">
                    {t('apptBook.showAllStaff')}
                    <Switch checked={showAllStaff} onCheckedChange={setShowAllStaff} />
                  </label>
                  <FilterHeader
                    className="mt-4"
                    title={t('apptBook.bookingCategory')}
                    onAll={() => setSelectedServiceIds(null)}
                    onNone={() => setSelectedServiceIds(new Set())}
                  />
                  <div className="space-y-0.5">
                    {activeServices.map((sv) => (
                      <FilterRow
                        key={sv.id}
                        label={sv.name}
                        color={sv.color ?? '#7DD3FC'}
                        checked={!selectedServiceIds || selectedServiceIds.has(sv.id)}
                        onToggle={() =>
                          setSelectedServiceIds((prev) => toggleIn(prev, sv.id, activeServices.map((x) => x.id)))
                        }
                        onOnly={() => setSelectedServiceIds(new Set([sv.id]))}
                      />
                    ))}
                  </div>
                </div>
                {activeFilterCount ? (
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                      {t('apptBook.clearFilters')}
                    </Button>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        {/* Body */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-sm:flex-none max-sm:overflow-visible">
          {loading && (tab === 'calendar' || tab === 'list') ? (
            <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : tab === 'calendar' ? (
            calendarScope === 'by-week' ? (
              <AppointmentBookWeekView
                weekDays={weekDays}
                employees={columns}
                appointments={calendarRows}
                selectedDate={selectedDate}
                dateLocale={dateFnsLocale}
                onAppointmentClick={(apt) => setDetailsId(apt.id)}
                onCellClick={(staffId, day) => openCreate({ staffId, date: day })}
              />
            ) : (
              <AppointmentBookDayGrid
                appointments={calendarRows}
                employees={columns}
                hoursPerDay={hoursPerDay}
                selectedDate={selectedDate}
                windowsByStaff={windowsByStaff}
                onAppointmentClick={(apt) => setDetailsId(apt.id)}
                onSlotClick={(staffId, time) => openCreate({ staffId, date: selectedDate, time })}
                onStaffQuickBook={(staffId) => openCreate({ staffId })}
              />
            )
          ) : tab === 'list' ? (
            <AppointmentBookListView
              key={`${petFilterId ?? ''}-${historyScope}`}
              appointments={appointments}
              pets={pets}
              clients={clients}
              services={services}
              employees={employees}
              calendarEmployees={groomers}
              selectedDate={selectedDate}
              onSelectDate={goToDate}
              onPreviousDay={() => goToDate(subDays(selectedDate, 1))}
              onNextDay={() => goToDate(addDays(selectedDate, 1))}
              onToday={() => goToDate(new Date())}
              filters={{ service: 'All Services', staff: 'All Employees', view: 'day' }}
              onFilterChange={() => {}}
              onEdit={(apt) => setDetailsId(apt.id)}
              initialScope="all"
              petFilterId={petFilterId}
              onClearPetFilter={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('pet');
                setSearchParams(next, { replace: true });
              }}
            />
          ) : tab === 'requests' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AppointmentRequestsPanel
                appointments={appointments}
                pets={pets}
                clients={clients}
                services={services}
                employees={bookableStaff(employees)}
                onDecide={decide}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
                <h2 className="text-lg font-semibold">{t('apptBook.bookingDisplay')}</h2>
                <label className="mt-3 flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t('apptBook.showStaffPhotos')}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t('apptBook.showStaffPhotosHint')}</span>
                  </span>
                  <Switch
                    checked={settings.booking_show_staff_photos !== 'false'}
                    disabled={!isManager}
                    onCheckedChange={async (on) => {
                      const res = await updateSetting('booking_show_staff_photos', on ? 'true' : 'false');
                      if (!res.ok) {
                        devConsole.warn('[AppointmentBook] booking_show_staff_photos', res.error);
                        toast.error(t('common.genericError'));
                      }
                    }}
                  />
                </label>
              </div>
              <GroomerServicesSettings
                employees={bookableStaff(employees)}
                services={services}
                rates={rates}
                canEdit={isManager}
                onUpdateOffered={updateOffered}
                onSaveRate={saveRate}
              />
            </div>
          )}
        </div>
      </div>

      <BookingFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
        pets={pets}
        services={services}
        appointments={appointments}
        preselectedStaffId={prefill.staffId}
        preselectedDate={prefill.date}
        preselectedTime={prefill.time}
        onAddAppointment={(payload) => addAppointment(payload as never)}
        onAddClient={(c) => addClient(c)}
        onAddPet={(p) => addPet(p) as never}
        onSuccess={(row) => {
          const d = row ? parseAppointmentDate(row as Appointment) : null;
          if (d) setSelectedDate(startOfDay(d));
        }}
      />

      <AppointmentDetailsSheet
        appointment={detailsApt}
        open={!!detailsApt}
        onOpenChange={(o) => !o && setDetailsId(null)}
        pets={pets}
        clients={clients}
        services={services}
        employees={employees}
        canMarkNoShow={isManager}
        businessSlug={businessSlug}
        onSetStatus={setStatus}
        onEdit={(apt) => {
          setDetailsId(null);
          setEditing(apt);
        }}
        onOpenRequests={() => {
          setDetailsId(null);
          goTab('requests');
        }}
      />

      <EditAppointmentDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        appointment={editing}
        clients={clients}
        pets={pets}
        services={services}
        employees={employees}
        appointments={appointments}
        onUpdate={updateAppointment}
        onSuccess={() => setEditing(null)}
      />
    </div>
  );
}
